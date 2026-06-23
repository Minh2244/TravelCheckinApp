import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
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
import { UserHeadingMarker } from "../../../src/components/map/UserHeadingMarker";
import { useLocations } from "../../../src/modules/locations/use-locations";
import { useLocationPermissionStore } from "../../../src/modules/location-permission/store";
import { showToast } from "../../../src/modules/ui/toast-store";
import { osrmApi, type RouteInfo } from "../../../src/services/osrm.api";
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
  return normalizeHeading(from + shortestAngleDelta(from, to) * 0.5);
}

function getHeadingFromLocation(location: Location.LocationObject) {
  const heading = Number(location.coords.heading);
  return Number.isFinite(heading) && heading >= 0 ? normalizeHeading(heading) : null;
}

function getHeadingFromSensor(heading: Location.LocationHeadingObject) {
  const trueHeading = Number(heading.trueHeading);
  if (Number.isFinite(trueHeading) && trueHeading >= 0) {
    return normalizeHeading(trueHeading);
  }

  const magneticHeading = Number(heading.magHeading);
  return Number.isFinite(magneticHeading) && magneticHeading >= 0
    ? normalizeHeading(magneticHeading)
    : null;
}

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const headingWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const { locations } = useLocations();
  const ensureLocationAccess = useLocationPermissionStore((state) => state.ensureAccess);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [heading, setHeading] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationItem | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const [mapRegion] = useState<Region>({
    latitude: 10.027,
    longitude: 105.7755,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const centerOnUser = useCallback(async () => {
    const ready = await ensureLocationAccess("ban do");
    if (!ready) return;

    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation(loc);
      const nextHeading = getHeadingFromLocation(loc);
      if (nextHeading !== null) {
        setHeading((current) => smoothHeading(current, nextHeading));
      }

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch {
      showToast("Khong the lay vi tri hien tai.");
    }
  }, [ensureLocationAccess]);

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
          const nextHeading = getHeadingFromLocation(nextLocation);
          if (nextHeading !== null) {
            setHeading((current) => smoothHeading(current, nextHeading));
          }
        },
      );
    }

    if (!headingWatcherRef.current) {
      headingWatcherRef.current = await Location.watchHeadingAsync((nextHeadingRaw) => {
        const nextHeading = getHeadingFromSensor(nextHeadingRaw);
        if (nextHeading !== null) {
          setHeading((current) => smoothHeading(current, nextHeading));
        }
      });
    }
  }, [ensureLocationAccess]);

  const handleSelectLocation = useCallback(
    (location: LocationItem) => {
      const coordinate = getLocationCoordinate(location);

      if (!coordinate) {
        showToast("Dia diem nay chua co toa do.");
        return;
      }

      setSelectedLocation(location);

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

  useFocusEffect(
    useCallback(() => {
      void centerOnUser();
      void startWatchingUser();

      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") {
          void startWatchingUser();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [centerOnUser, startWatchingUser]),
  );

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
        showsUserLocation={false}
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
              selected={selectedLocation?.location_id === location.location_id}
              onSelect={handleSelectLocation}
            />
          );
        })}

        {userLocation ? (
          <UserHeadingMarker location={userLocation} heading={heading} />
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

      {isRouting && routeInfo && selectedLocation ? (
        <View style={[styles.routeHeader, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable style={styles.cancelRouteBtn} onPress={() => setIsRouting(false)}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <View style={styles.routeInfo}>
            <Text style={styles.routeTitle}>Den {selectedLocation.location_name}</Text>
            <Text style={styles.routeSub}>
              {(routeInfo.distance / 1000).toFixed(1)} km {"\u2022"}{" "}
              {routeInfo.duration > 0 ? `${Math.round(routeInfo.duration / 60)} phut` : "duong thang"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <Pressable
            style={styles.searchBar}
            onPress={() => showToast("Chuc nang tim kiem dang cap nhat")}
          >
            <Ionicons name="search" size={20} color="#64748b" />
            <Text style={styles.searchText}>Tim kiem dia diem...</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[
          styles.locateButton,
          { bottom: Math.max(insets.bottom + 20, 20) },
          selectedLocation && !isRouting && { bottom: Math.max(insets.bottom + 200, 200) },
        ]}
        onPress={() => void centerOnUser()}
      >
        <Ionicons name="locate" size={24} color="#0f766e" />
      </Pressable>

      {selectedLocation && !isRouting ? (
        <BottomSheetSummary
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
          onRoute={async () => {
            if (!userLocation) {
              showToast("Dang tim vi tri cua ban...");
              await centerOnUser();
              return;
            }

            const coordinate = getLocationCoordinate(selectedLocation);

            if (!coordinate) {
              showToast("Dia diem nay chua co toa do.");
              return;
            }

            try {
              const route = await osrmApi.getRoute(
                {
                  latitude: userLocation.coords.latitude,
                  longitude: userLocation.coords.longitude,
                },
                coordinate,
              );

              setRouteInfo(route);
              setIsRouting(true);

              mapRef.current?.fitToCoordinates(route.coordinates, {
                edgePadding: { top: 100, right: 50, bottom: 50, left: 50 },
                animated: true,
              });
            } catch {
              showToast("Khong tim duoc duong di");
            }
          }}
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
  searchText: {
    fontSize: 16,
    color: "#64748b",
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
