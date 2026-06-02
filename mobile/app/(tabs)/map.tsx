// Trang bản đồ - hiển thị locations, GPS, tìm kiếm
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import locationApi from '../../src/api/locationApi';
import geoApi from '../../src/api/geoApi';
import userApi from '../../src/api/userApi';
import { COLORS, SIZES, FONTS, LOCATION_TYPES } from '../../src/utils/constants';
import type { Location as LocationType } from '../../src/types';

// Tọa độ mặc định: TP.HCM
const DEFAULT_REGION = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { name: string; latitude: number; longitude: number }[]
  >([]);
  const [selectedType, setSelectedType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Xin quyền truy cập vị trí
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);

        // Di chuyển map đến vị trí hiện tại
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      }
    })();
  }, []);

  // Tải danh sách locations
  const fetchLocations = useCallback(async () => {
    try {
      const params: Record<string, string> = { source: 'mobile' };
      if (selectedType) params.type = selectedType;

      const [locationsRes, favoritesRes] = await Promise.all([
        locationApi.getLocations(params),
        userApi.getFavorites().catch(() => ({ data: [] })),
      ]);

      setLocations(locationsRes.data.locations || []);
      setFavorites(
        (Array.isArray(favoritesRes.data) ? favoritesRes.data : []).map(
          (f: { location_id: number }) => f.location_id
        )
      );
    } catch {
      // Bỏ qua lỗi
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Tìm kiếm địa điểm
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const response = await geoApi.search(query.trim(), 6);
      setSearchResults(
        response.data.map((r) => ({
          name: r.display_name,
          latitude: parseFloat(r.lat),
          longitude: parseFloat(r.lon),
        }))
      );
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Di chuyển map đến vị trí tìm kiếm
  const goToSearchResult = (latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setShowSearchResults(false);
    setSearchQuery('');
  };

  // Về vị trí hiện tại
  const goToMyLocation = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } else {
      Alert.alert('Thông báo', 'Không thể xác định vị trí. Vui lòng bật GPS.');
    }
  };

  // Lấy màu marker theo loại địa điểm
  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'hotel':
      case 'resort':
        return '#3b82f6';
      case 'restaurant':
      case 'cafe':
        return '#f59e0b';
      case 'tourist':
        return '#22c55e';
      default:
        return COLORS.primary;
    }
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass
        showsScale
      >
        {/* Markers cho locations */}
        {locations
          .filter((loc) => loc.latitude && loc.longitude)
          .map((loc) => (
            <Marker
              key={loc.location_id}
              coordinate={{
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
              }}
              pinColor={getMarkerColor(loc.location_type)}
            >
              <Callout
                onPress={() => router.push(`/location/${loc.location_id}`)}
              >
                <View style={styles.callout}>
                  {loc.first_image && (
                    <Image
                      source={{ uri: loc.first_image }}
                      style={styles.calloutImage}
                    />
                  )}
                  <Text style={styles.calloutTitle} numberOfLines={1}>
                    {loc.location_name}
                  </Text>
                  <Text style={styles.calloutAddress} numberOfLines={1}>
                    {loc.address}
                  </Text>
                  <View style={styles.calloutMeta}>
                    <Ionicons name="star" size={12} color={COLORS.secondary} />
                    <Text style={styles.calloutRating}>
                      {loc.rating > 0 ? loc.rating.toFixed(1) : 'Mới'}
                    </Text>
                    <Text style={styles.calloutType}>
                      {LOCATION_TYPES[loc.location_type as keyof typeof LOCATION_TYPES]?.label || loc.location_type}
                    </Text>
                  </View>
                  <Text style={styles.calloutAction}>Xem chi tiết →</Text>
                </View>
              </Callout>
            </Marker>
          ))}
      </MapView>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm địa điểm..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setSearchResults([]);
                setShowSearchResults(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Kết quả tìm kiếm */}
        {showSearchResults && (
          <View style={styles.searchResults}>
            {isSearching ? (
              <ActivityIndicator
                size="small"
                color={COLORS.primary}
                style={{ padding: SIZES.md }}
              />
            ) : searchResults.length === 0 ? (
              <Text style={styles.searchEmpty}>Không tìm thấy kết quả</Text>
            ) : (
              searchResults.map((result, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.searchResultItem}
                  onPress={() =>
                    goToSearchResult(result.latitude, result.longitude)
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={COLORS.primary}
                  />
                  <Text style={styles.searchResultText} numberOfLines={2}>
                    {result.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterContainer}>
        <FlatList
          data={Object.entries(LOCATION_TYPES)}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={([key]) => key}
          renderItem={({ item: [, { label, value }] }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedType === value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedType(value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedType === value && styles.filterChipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Nút về vị trí hiện tại */}
      <TouchableOpacity style={styles.myLocationButton} onPress={goToMyLocation}>
        <Ionicons name="locate" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Loading overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: SIZES.xxxl + SIZES.md,
    left: SIZES.lg,
    right: SIZES.lg,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    paddingHorizontal: SIZES.md,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: FONTS.md,
    color: COLORS.text,
  },
  searchResults: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    marginTop: SIZES.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 240,
  },
  searchEmpty: {
    padding: SIZES.md,
    textAlign: 'center',
    color: COLORS.textLight,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SIZES.sm,
  },
  searchResultText: {
    flex: 1,
    fontSize: FONTS.sm,
    color: COLORS.text,
  },
  filterContainer: {
    position: 'absolute',
    top: SIZES.xxxl + SIZES.md + 56 + SIZES.sm,
    left: 0,
    right: 0,
  },
  filterList: {
    paddingHorizontal: SIZES.lg,
  },
  filterChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radius,
    backgroundColor: COLORS.surface,
    marginRight: SIZES.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONTS.sm,
    color: COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  myLocationButton: {
    position: 'absolute',
    bottom: SIZES.xl,
    right: SIZES.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callout: {
    width: 200,
    padding: SIZES.sm,
  },
  calloutImage: {
    width: '100%',
    height: 80,
    borderRadius: SIZES.radiusSm,
    marginBottom: SIZES.xs,
  },
  calloutTitle: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  calloutAddress: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xs,
  },
  calloutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.xs,
    marginBottom: SIZES.xs,
  },
  calloutRating: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
  },
  calloutType: {
    fontSize: FONTS.xs,
    color: COLORS.textLight,
    marginLeft: 'auto',
  },
  calloutAction: {
    fontSize: FONTS.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
});
