import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, {
  Polyline,
  PROVIDER_DEFAULT,
  Region,
} from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BottomSheetSummary } from "../../../src/components/map/BottomSheetSummary";
import { OwnerCachedMarker } from "../../../src/components/map/OwnerCachedMarker";
import { OwnerMarkerBitmapFactory } from "../../../src/components/map/OwnerMarkerBitmapFactory";
import {
  UserLocationMarker,
  UserMarkerBitmapFactory,
} from "../../../src/components/map/UserLocationMarker";
import { useLocations } from "../../../src/modules/locations/use-locations";
import { useLocationPermissionStore } from "../../../src/modules/location-permission/store";
import { showToast } from "../../../src/modules/ui/toast-store";
import { osrmApi, type RouteInfo } from "../../../src/services/osrm.api";
import { userApi } from "../../../src/services/user.api";
import type { LocationItem } from "../../../src/types/location";

function getLocationCoordinate(location: LocationItem) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeHeading(value: number) {
  const normalized = value % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

function shortestAngleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function smoothHeading(from: number, to: number) {
  return normalizeHeading(from + shortestAngleDelta(from, to) * 0.35);
}

function getLocationHeading(location: Location.LocationObject) {
  const heading = Number(location.coords.heading);
  const speed = Number(location.coords.speed);

  if (
    Number.isFinite(heading) &&
    heading >= 0 &&
    Number.isFinite(speed) &&
    speed > 0.8
  ) {
    return normalizeHeading(heading);
  }

  return null;
}

function getSensorHeading(value: Location.LocationHeadingObject) {
  const trueHeading = Number(value.trueHeading);

  if (Number.isFinite(trueHeading) && trueHeading >= 0) {
    return normalizeHeading(trueHeading);
  }

  const magneticHeading = Number(value.magHeading);
  return Number.isFinite(magneticHeading) && magneticHeading >= 0
    ? normalizeHeading(magneticHeading)
    : null;
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{
    focusLocationId?: string;
    startRoute?: string;
    requestKey?: string;
  }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const searchInputRef = useRef<TextInput>(null);
  const processedNavigationRef = useRef<string | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const { locations, keyword, setKeyword } = useLocations();
  const ensureLocationAccess = useLocationPermissionStore((state) => state.ensureAccess);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [ownerMarkerImages, setOwnerMarkerImages] = useState<Record<number, string>>({});
  const [favoriteLocationIds, setFavoriteLocationIds] = useState<number[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMarkerImage, setUserMarkerImage] = useState<string | null>(null);
  const [userHeading, setUserHeading] = useState(0);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [isUserZoomedIn, setIsUserZoomedIn] = useState(false);

  const [mapRegion] = useState<Region>({
    latitude: 10.027,
    longitude: 105.7755,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const favoriteLocationSet = useMemo(
    () => new Set(favoriteLocationIds),
    [favoriteLocationIds],
  );
  const searchResults = useMemo(
    () => (keyword.trim() ? locations.slice(0, 5) : []),
    [keyword, locations],
  );

  const loadFavorites = useCallback(async () => {
    try {
      const response = await userApi.getFavorites();
      setFavoriteLocationIds(
        (response.data || [])
          .map((item) => Number(item.location_id))
          .filter((item) => Number.isFinite(item)),
      );
    } catch {
      setFavoriteLocationIds([]);
    }
  }, []);

  const centerOnUser = useCallback(async () => {
    const ready = await ensureLocationAccess("ban do");
    if (!ready) return;

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(loc);
      const nextHeading = getLocationHeading(loc);

      if (nextHeading !== null) {
        setUserHeading((current) => smoothHeading(current, nextHeading));
      }

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch {
      showToast("Không thể lấy vị trí hiện tại.");
    }
  }, [ensureLocationAccess]);

  const toggleUserZoom = useCallback(async () => {
    const ready = await ensureLocationAccess("ban do");
    if (!ready) return;

    try {
      const loc =
        userLocation ??
        (await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }));
      const nextZoomedIn = !isUserZoomedIn;

      setUserLocation(loc);
      setIsUserZoomedIn(nextZoomedIn);
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          },
          zoom: nextZoomedIn ? 20 : 13,
          pitch: 0,
        },
        { duration: 500 },
      );
    } catch {
      showToast("Không thể lấy vị trí hiện tại.");
    }
  }, [ensureLocationAccess, isUserZoomedIn, userLocation]);

  const startWatchingUser = useCallback(async () => {
    const ready = await ensureLocationAccess("ban do");
    if (!ready) {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      if (headingWatcherRef.current) {
        headingWatcherRef.current.remove();
        headingWatcherRef.current = null;
      }
      setUserLocation(null);
      return;
    }

    if (!locationWatcherRef.current) {
      locationWatcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 2,
          timeInterval: 1000,
        },
        (nextLocation) => {
          setUserLocation(nextLocation);
          const nextHeading = getLocationHeading(nextLocation);

          if (nextHeading !== null) {
            setUserHeading((current) => smoothHeading(current, nextHeading));
          }
        },
      );
    }

    if (!headingWatcherRef.current) {
      headingWatcherRef.current = await Location.watchHeadingAsync((value) => {
        const nextHeading = getSensorHeading(value);

        if (nextHeading !== null) {
          setUserHeading((current) => smoothHeading(current, nextHeading));
        }
      });
    }
  }, [ensureLocationAccess]);

  const handleSelectLocation = useCallback(
    (location: LocationItem) => {
      const coordinate = getLocationCoordinate(location);

      if (!coordinate) {
        showToast("Địa điểm này chưa có tọa độ.");
        return;
      }

      setSelectedLocation(location);
      setSearchFocused(false);
      searchInputRef.current?.blur();

      if (!isRouting) {
        mapRef.current?.animateToRegion({
          latitude: coordinate.latitude - 0.005,
          longitude: coordinate.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    },
    [isRouting],
  );

  const toggleSelectedFavorite = useCallback(async () => {
    if (!selectedLocation) {
      return;
    }

    const locationId = Number(selectedLocation.location_id);
    const isFavorite = favoriteLocationSet.has(locationId);

    setFavoriteLocationIds((current) =>
      isFavorite
        ? current.filter((item) => item !== locationId)
        : current.includes(locationId)
          ? current
          : [...current, locationId],
    );

    try {
      await userApi.toggleFavorite(locationId, !isFavorite);
      showToast(isFavorite ? "Đã bỏ lưu địa điểm" : "Đã lưu địa điểm");
    } catch {
      await loadFavorites();
      showToast("Không thể cập nhật địa điểm đã lưu");
    }
  }, [favoriteLocationSet, loadFavorites, selectedLocation]);

  const startRouteToLocation = useCallback(
    async (target: LocationItem) => {
      const coordinate = getLocationCoordinate(target);
      if (!coordinate) {
        showToast("Địa điểm này chưa có tọa độ.");
        return;
      }

      const ready = await ensureLocationAccess("chỉ đường");
      if (!ready) return;

      try {
        const origin =
          userLocation ??
          (await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }));

        setUserLocation(origin);
        setSelectedLocation(target);

        const route = await osrmApi.getRoute(
          {
            latitude: origin.coords.latitude,
            longitude: origin.coords.longitude,
          },
          coordinate,
        );

        setRouteInfo(route);
        setIsRouting(true);
        mapRef.current?.fitToCoordinates(route.coordinates, {
          edgePadding: { top: 110, right: 45, bottom: 70, left: 45 },
          animated: true,
        });
      } catch {
        showToast("Không tìm được đường đi");
      }
    },
    [ensureLocationAccess, userLocation],
  );

  const handleOwnerMarkerReady = useCallback((locationId: number, uri: string) => {
    setOwnerMarkerImages((current) => {
      if (current[locationId] === uri) {
        return current;
      }

      return {
        ...current,
        [locationId]: uri,
      };
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void centerOnUser();
      void startWatchingUser();
      void loadFavorites();

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void startWatchingUser();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [centerOnUser, loadFavorites, startWatchingUser]),
  );

  useEffect(() => {
    const focusId = Number(params.focusLocationId);
    if (!Number.isFinite(focusId)) {
      return;
    }

    const navigationKey = `${focusId}:${params.startRoute || "0"}:${params.requestKey || "default"}`;
    if (processedNavigationRef.current === navigationKey) {
      return;
    }

    const target = locations.find(
      (location) => Number(location.location_id) === focusId,
    );
    if (!target) {
      return;
    }

    processedNavigationRef.current = navigationKey;

    if (params.startRoute === "1") {
      void startRouteToLocation(target);
    } else {
      handleSelectLocation(target);
    }
  }, [
    handleSelectLocation,
    locations,
    params.focusLocationId,
    params.requestKey,
    params.startRoute,
    startRouteToLocation,
  ]);

  useFocusEffect(
    useCallback(
      () => () => {
        if (locationWatcherRef.current) {
          locationWatcherRef.current.remove();
          locationWatcherRef.current = null;
        }
        if (headingWatcherRef.current) {
          headingWatcherRef.current.remove();
          headingWatcherRef.current = null;
        }
      },
      [],
    ),
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType="standard"
        initialRegion={mapRegion}
        maxZoomLevel={20}
        showsUserLocation={Boolean(userLocation) && !userMarkerImage}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {locations.map((location) => {
          const coordinate = getLocationCoordinate(location);

          if (!coordinate) {
            return null;
          }

          return (
            <OwnerCachedMarker
              key={location.location_id}
              coordinate={coordinate}
              location={location}
              imageUri={ownerMarkerImages[location.location_id]}
              selected={selectedLocation?.location_id === location.location_id}
              onSelect={handleSelectLocation}
            />
          );
        })}

        {userLocation && userMarkerImage ? (
          <UserLocationMarker
            location={userLocation}
            heading={userHeading}
            imageUri={userMarkerImage}
          />
        ) : null}

        {isRouting && routeInfo && (
          <Polyline
            coordinates={routeInfo.coordinates}
            strokeWidth={5}
            strokeColor="#0f766e"
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      <OwnerMarkerBitmapFactory
        locations={locations}
        onReady={handleOwnerMarkerReady}
      />
      <UserMarkerBitmapFactory onReady={setUserMarkerImage} />

      {isRouting && routeInfo && selectedLocation ? (
        <View style={[styles.routeHeader, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable
            style={styles.cancelRouteBtn}
            onPress={() => {
              setIsRouting(false);
              setRouteInfo(null);
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>Đến {selectedLocation.location_name}</Text>
            <Text style={styles.routeSub}>
              {(routeInfo.distance / 1000).toFixed(1)} km {"\u2022"}{" "}
              {routeInfo.duration > 0
                ? `${Math.round(routeInfo.duration / 60)} phút`
                : "đường thẳng"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#64748b" />
            <TextInput
              ref={searchInputRef}
              value={keyword}
              onChangeText={setKeyword}
              onFocus={() => setSearchFocused(true)}
              placeholder="Tìm kiếm địa điểm..."
              placeholderTextColor="#64748b"
              style={styles.searchInput}
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {keyword ? (
              <Pressable
                hitSlop={10}
                onPress={() => {
                  setKeyword("");
                  searchInputRef.current?.focus();
                }}
              >
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>

          {searchFocused && keyword.trim() ? (
            <View style={styles.searchResults}>
              {searchResults.length > 0 ? (
                searchResults.map((location) => (
                  <Pressable
                    key={location.location_id}
                    style={styles.searchResultItem}
                    onPress={() => handleSelectLocation(location)}
                  >
                    <Ionicons name="location-outline" size={18} color="#0f766e" />
                    <View style={styles.searchResultText}>
                      <Text style={styles.searchResultTitle} numberOfLines={1}>
                        {location.location_name}
                      </Text>
                      <Text style={styles.searchResultAddress} numberOfLines={1}>
                        {location.address}
                      </Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <Text style={styles.emptySearch}>Không tìm thấy địa điểm phù hợp.</Text>
              )}
            </View>
          ) : null}
        </View>
      )}

      <Pressable
        style={[
          styles.locateButton,
          { bottom: Math.max(insets.bottom + 20, 20) },
          selectedLocation && !isRouting && { bottom: Math.max(insets.bottom + 200, 200) },
        ]}
        onPress={() => void toggleUserZoom()}
      >
        <Ionicons name="locate" size={24} color="#0f766e" />
      </Pressable>

      {selectedLocation && !isRouting ? (
        <BottomSheetSummary
          isFavorite={favoriteLocationSet.has(selectedLocation.location_id)}
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onToggleFavorite={() => void toggleSelectedFavorite()}
          onRoute={() => void startRouteToLocation(selectedLocation)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 80,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 18,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.13,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    paddingVertical: 0,
  },
  searchResults: {
    marginTop: 7,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    overflow: "hidden",
    elevation: 8,
  },
  searchResultItem: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  searchResultText: {
    flex: 1,
  },
  searchResultTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  searchResultAddress: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  emptySearch: {
    padding: 14,
    color: "#64748b",
    fontSize: 13,
  },
  routeHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    zIndex: 80,
    shadowColor: "#0f172a",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  cancelRouteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  routeSub: {
    fontSize: 15,
    color: "#0f766e",
    fontWeight: "700",
  },
  locateButton: {
    position: "absolute",
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    zIndex: 70,
  },
});
