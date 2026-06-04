import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
  TextInput,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { isWithinOpeningHours } from '../../utils/openingHours';

const { width, height } = Dimensions.get('window');

interface LocationData {
  location_id: number;
  location_name: string;
  location_type: 'hotel' | 'restaurant' | 'tourist' | 'cafe' | 'resort' | 'other';
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  total_reviews: number;
  first_image: string | null;
  phone?: string | null;
  description?: string | null;
  opening_hours?: string | null;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

type MapTypeKey = 'osm' | 'positron' | 'voyager' | 'satellite';

interface MapStyleConfig {
  key: MapTypeKey;
  label: string;
  url: string;
}

const MAP_STYLES: MapStyleConfig[] = [
  {
    key: 'voyager',
    label: 'Tiêu chuẩn',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
  },
  {
    key: 'positron',
    label: 'Bản đồ sáng',
    url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  },
  {
    key: 'osm',
    label: 'Bản đồ OSM',
    url: 'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
  },
  {
    key: 'satellite',
    label: 'Vệ tinh',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
];

const CATEGORIES = [
  { key: 'all', label: 'Tất cả', icon: 'grid-outline' },
  { key: 'food', label: 'Ăn uống', icon: 'restaurant-outline' },
  { key: 'tourist', label: 'Du lịch', icon: 'camera-outline' },
  { key: 'hotel', label: 'Khách sạn', icon: 'bed-outline' },
  { key: 'saved', label: 'Đã lưu', icon: 'heart-outline' },
];

// Công thức Haversine tính khoảng cách (mét)
const haversineDistance = (coords1: LatLng, coords2: LatLng): number => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371000; // bán kính Trái Đất (mét)
  const dLat = toRad(coords2.latitude - coords1.latitude);
  const dLon = toRad(coords2.longitude - coords1.longitude);
  const lat1 = toRad(coords1.latitude);
  const lat2 = toRad(coords2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // States
  const [myPosition, setMyPosition] = useState<LatLng | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'food' | 'tourist' | 'hotel' | 'saved'>('all');

  // Map Tile Style
  const [currentStyle, setCurrentStyle] = useState<MapStyleConfig>(MAP_STYLES[0]);
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  // Selection & Details panel
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);

  // Routing state
  const [routeEnabled, setRouteEnabled] = useState(false);
  const [routeTarget, setRouteTarget] = useState<LatLng | null>(null);
  const [routeProfile, setRouteProfile] = useState<'driving' | 'foot'>('driving');
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMins?: number;
    hasNoRoute: boolean;
  } | null>(null);

  // Khởi tạo vị trí GPS người dùng
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const pos = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setMyPosition(pos);

        // Pan to user location
        mapRef.current?.animateToRegion({
          ...pos,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        }, 800);
      } catch (error) {
        console.log('Error initializing user GPS location', error);
      }
    })();
  }, []);

  // Tải danh sách địa điểm từ API
  const fetchLocations = useCallback(async () => {
    try {
      setIsLoading(true);
      const [locationsRes, favoritesRes] = await Promise.all([
        axiosClient.get('/locations?source=mobile'),
        axiosClient.get('/user/favorites').catch(() => ({ data: { data: [] } })),
      ]);
      if (locationsRes.data && locationsRes.data.data) {
        setLocations(locationsRes.data.data);
      }
      if (favoritesRes.data && favoritesRes.data.data) {
        setSavedIds(favoritesRes.data.data.map((fav: any) => Number(fav.location_id)));
      }
    } catch (error) {
      console.log('Error fetching map locations', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Bộ lọc tìm kiếm địa điểm và danh mục
  useEffect(() => {
    let result = locations;

    // 1. Lọc theo danh mục
    if (selectedCategory === 'food') {
      result = result.filter(loc => loc.location_type === 'restaurant' || loc.location_type === 'cafe');
    } else if (selectedCategory === 'tourist') {
      result = result.filter(loc => loc.location_type === 'tourist');
    } else if (selectedCategory === 'hotel') {
      result = result.filter(loc => loc.location_type === 'hotel' || loc.location_type === 'resort');
    } else if (selectedCategory === 'saved') {
      result = result.filter(loc => savedIds.includes(loc.location_id));
    }

    // 2. Lọc theo ô tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(loc => 
        loc.location_name.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q)
      );
    }

    setFilteredLocations(result);
  }, [searchQuery, selectedCategory, locations, savedIds]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  // Recentering map
  const handleRecenter = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const pos = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setMyPosition(pos);
      mapRef.current?.animateToRegion({
        ...pos,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 1000);
    } catch (error) {
      Alert.alert('Lỗi định vị', 'Không thể lấy được vị trí GPS hiện tại của thiết bị.');
    }
  };

  // Hàm gọi API OSRM tính toán lộ trình
  const calculateRoute = async (from: LatLng, to: LatLng, profile: 'driving' | 'foot') => {
    setIsLoading(true);
    const osrmProfile = profile === 'driving' ? 'driving' : 'foot';
    const urls = [
      `https://router.project-osrm.org/route/v1/${osrmProfile}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=true`,
      `https://routing.openstreetmap.de/routed-${profile === 'driving' ? 'car' : 'foot'}/route/v1/${osrmProfile}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson&alternatives=true`
    ];

    let success = false;
    let data: any = null;
    let noRouteError = false;

    for (const url of urls) {
      try {
        const res = await fetch(url);
        const json = await res.json();
        
        if (res.status === 400 || res.status === 422 || json.code === 'NoRoute') {
          noRouteError = true;
          break;
        }

        if (res.ok && json.code === 'Ok' && json.routes?.length > 0) {
          data = json;
          success = true;
          break;
        }
      } catch (err) {
        console.log('OSRM request error, trying fallback', err);
      }
    }

    if (success && data) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));
      setRouteCoords(coords);
      setRouteInfo({
        distanceKm: route.distance / 1000,
        durationMins: Math.round(route.duration / 60),
        hasNoRoute: false,
      });
    } else {
      // Bị chặn đường (Sông Cần Thơ hoặc đảo hoang không có cầu bộ)
      const straightDistance = haversineDistance(from, to);
      setRouteCoords([from, to]); // Vẽ đường chim bay thẳng tắp
      setRouteInfo({
        distanceKm: straightDistance / 1000,
        hasNoRoute: true,
      });
      
      Alert.alert(
        'Không tìm thấy đường đi bộ/đường bộ',
        'Vị trí này nằm trên sông Cần Thơ, mặt nước hoặc ngoài đảo biệt lập. Hệ thống tự động chuyển đổi sang đường chim bay.'
      );
    }
    setIsLoading(false);
  };

  // Kích hoạt tuyến đường
  const startRoute = (target: LatLng) => {
    if (!myPosition) {
      Alert.alert('Lỗi', 'Cần cấp quyền định vị GPS để bắt đầu chỉ đường từ vị trí của bạn.');
      return;
    }
    setRouteTarget(target);
    setRouteEnabled(true);
    calculateRoute(myPosition, target, routeProfile);
  };

  // Hủy tuyến đường
  const clearRoute = () => {
    setRouteEnabled(false);
    setRouteTarget(null);
    setRouteCoords([]);
    setRouteInfo(null);
  };

  // Thay đổi cấu hình phương tiện di chuyển
  const toggleRouteProfile = () => {
    const nextProfile = routeProfile === 'driving' ? 'foot' : 'driving';
    setRouteProfile(nextProfile);
    if (routeEnabled && myPosition && routeTarget) {
      calculateRoute(myPosition, routeTarget, nextProfile);
    }
  };

  const getMarkerIcon = (type: string) => {
    switch (type) {
      case 'hotel':
      case 'resort': return 'bed';
      case 'restaurant':
      case 'cafe': return 'restaurant';
      case 'tourist': return 'camera';
      default: return 'location';
    }
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'hotel':
      case 'resort': return '#3b82f6';
      case 'restaurant':
      case 'cafe': return '#f59e0b';
      case 'tourist': return '#10b981';
      default: return '#64748b';
    }
  };

  // Tạo URL ảnh đầy đủ
  const resolveBackendUrl = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${url}`;
  };

  return (
    <View style={styles.container}>
      {/* Bản đồ sử dụng OSM Tiles */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        initialRegion={{
          latitude: 10.0451,
          longitude: 105.7468,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        onLongPress={(e) => {
          const coord = e.nativeEvent.coordinate;
          setSelectedLocation({
            location_id: -1,
            location_name: 'Vị trí đã chọn',
            location_type: 'other',
            address: `Vĩ độ: ${coord.latitude.toFixed(5)}, Kinh độ: ${coord.longitude.toFixed(5)}`,
            latitude: coord.latitude,
            longitude: coord.longitude,
            rating: 0,
            total_reviews: 0,
            first_image: null
          });
          clearRoute();
        }}
      >
        {/* Layer đè OSM */}
        <UrlTile
          urlTemplate={currentStyle.url}
          shouldReplaceMapContent={true}
        />

        {/* Tuyến đường chỉ dẫn */}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={4}
            strokeColor={routeInfo?.hasNoRoute ? '#f59e0b' : '#3b82f6'}
            lineDashPattern={routeInfo?.hasNoRoute ? [8, 4] : undefined}
          />
        )}

        {/* Vẽ các Markers của Owner địa điểm */}
        {filteredLocations.map((loc) => {
          if (!loc.latitude || !loc.longitude) return null;
          const isSelected = selectedLocation?.location_id === loc.location_id;
          const imageUrl = resolveBackendUrl(loc.first_image);

          return (
            <Marker
              key={loc.location_id.toString()}
              coordinate={{ latitude: Number(loc.latitude), longitude: Number(loc.longitude) }}
              onPress={() => setSelectedLocation(loc)}
            >
              {imageUrl ? (
                // Custom Circular avatar marker
                <View style={[
                  styles.avatarMarker,
                  isSelected && styles.avatarMarkerSelected
                ]}>
                  <Image source={{ uri: imageUrl }} style={styles.avatarImage} />
                </View>
              ) : (
                // Fallback marker
                <View style={[
                  styles.pinMarker,
                  { backgroundColor: getMarkerColor(loc.location_type) },
                  isSelected && styles.pinMarkerSelected
                ]}>
                  <Ionicons name={getMarkerIcon(loc.location_type) as any} size={14} color="#fff" />
                </View>
              )}
            </Marker>
          );
        })}

        {/* Custom Marker khi người dùng long press chọn vị trí tự do */}
        {selectedLocation && selectedLocation.location_id === -1 && (
          <Marker
            key="custom-selected-pin"
            coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}
            draggable
            onDragEnd={(e) => {
              const coord = e.nativeEvent.coordinate;
              setSelectedLocation({
                ...selectedLocation,
                latitude: coord.latitude,
                longitude: coord.longitude,
                address: `Vĩ độ: ${coord.latitude.toFixed(5)}, Kinh độ: ${coord.longitude.toFixed(5)}`,
              });
              if (routeEnabled) {
                startRoute(coord);
              }
            }}
          >
            <View style={[styles.pinMarker, { backgroundColor: '#ef4444' }, styles.pinMarkerSelected]}>
              <Ionicons name="location" size={14} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Thanh tìm kiếm nổi lên trên */}
      <View style={[styles.floatingSearchContainer, { top: insets.top + 10 }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm địa điểm, nhà hàng..."
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Chọn kiểu bản đồ */}
        <TouchableOpacity style={styles.styleSelectorButton} onPress={() => setShowStyleMenu(!showStyleMenu)}>
          <Ionicons name="layers-outline" size={22} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Thanh chọn danh mục lọc địa điểm */}
      <View style={[styles.categoriesContainer, { top: insets.top + 68 }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryPill,
                  isActive && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat.key as any)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? '#ffffff' : '#475569'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Menu thả xuống chọn kiểu bản đồ */}
      {showStyleMenu && (
        <View style={[styles.styleMenu, { top: insets.top + 68 }]}>
          {MAP_STYLES.map((style) => (
            <TouchableOpacity
              key={style.key}
              style={[styles.styleMenuItem, currentStyle.key === style.key && styles.styleMenuItemActive]}
              onPress={() => {
                setCurrentStyle(style);
                setShowStyleMenu(false);
              }}
            >
              <Text style={[styles.styleMenuText, currentStyle.key === style.key && styles.styleMenuTextActive]}>
                {style.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nút định vị & Chuyển phương tiện chỉ đường */}
      <View style={[styles.sidebarButtons, { bottom: selectedLocation || routeInfo ? insets.bottom + 290 : insets.bottom + 120 }]}>
        {routeEnabled && (
          <TouchableOpacity style={styles.sidebarButton} onPress={toggleRouteProfile}>
            <Ionicons name={routeProfile === 'driving' ? 'bicycle-outline' : 'walk-outline'} size={24} color="#3b82f6" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.sidebarButton} onPress={handleRecenter}>
          <Ionicons name="locate" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      {/* Panel thông tin lộ trình và chỉ dẫn */}
      {routeInfo && (
        <View style={[styles.routeInfoPanel, { bottom: insets.bottom + 85 }]}>
          <View style={styles.routeInfoHeader}>
            <Ionicons name="navigate" size={22} color={routeInfo.hasNoRoute ? '#f59e0b' : '#3b82f6'} />
            <Text style={styles.routeInfoTitle}>
              {routeInfo.hasNoRoute ? 'Đường chim bay (Chặn sông)' : 'Lộ trình di chuyển'}
            </Text>
            <TouchableOpacity onPress={clearRoute}>
              <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.routeInfoBody}>
            <View style={styles.routeStat}>
              <Text style={styles.routeStatValue}>{routeInfo.distanceKm.toFixed(2)} km</Text>
              <Text style={styles.routeStatLabel}>Khoảng cách</Text>
            </View>
            
            <View style={styles.routeStatLine} />
            
            <View style={styles.routeStat}>
              <Text style={styles.routeStatValue}>
                {routeInfo.hasNoRoute ? 'Không rõ' : `${routeInfo.durationMins} phút`}
              </Text>
              <Text style={styles.routeStatLabel}>Thời gian</Text>
            </View>
            
            <View style={styles.routeStatLine} />

            <View style={styles.routeStat}>
              <Text style={styles.routeStatValue}>
                {routeProfile === 'driving' ? 'Xe máy/Xe hơi' : 'Đi bộ'}
              </Text>
              <Text style={styles.routeStatLabel}>Phương tiện</Text>
            </View>
          </View>
        </View>
      )}

      {/* Panel chi tiết địa điểm khi được click chọn */}
      {selectedLocation && !routeInfo && (
        <View style={[styles.detailPanel, { bottom: insets.bottom + 85 }]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle} numberOfLines={1}>{selectedLocation.location_name}</Text>
            <TouchableOpacity onPress={() => setSelectedLocation(null)}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Row chứa ảnh và thông tin chi tiết */}
          <View style={styles.panelContentRow}>
            {selectedLocation.first_image && selectedLocation.location_id !== -1 && (
              <Image
                source={{ uri: resolveBackendUrl(selectedLocation.first_image) || '' }}
                style={styles.panelImage}
              />
            )}
            <View style={styles.panelInfoCol}>
              <Text style={styles.panelAddress} numberOfLines={2}>{selectedLocation.address}</Text>
              
              <View style={styles.panelMetaRow}>
                {selectedLocation.location_id !== -1 ? (
                  <>
                    <View style={[
                      styles.statusBadge, 
                      { backgroundColor: isWithinOpeningHours(selectedLocation.opening_hours) ? '#dcfce7' : '#fee2e2' }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        { color: isWithinOpeningHours(selectedLocation.opening_hours) ? '#15803d' : '#b91c1c' }
                      ]}>
                        {isWithinOpeningHours(selectedLocation.opening_hours) ? 'Đang mở' : 'Đóng cửa'}
                      </Text>
                    </View>

                    <View style={styles.panelRating}>
                      <Ionicons name="star" size={14} color="#fbbf24" style={{ marginRight: 2 }} />
                      <Text style={styles.panelRatingText}>
                        {Number(selectedLocation.rating || 0).toFixed(1)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={[styles.panelCategory, { backgroundColor: '#fecaca' }]}>
                    <Text style={[styles.panelCategoryText, { color: '#dc2626' }]}>
                      ĐỊA ĐIỂM TỰ DO
                    </Text>
                  </View>
                )}
              </View>

              {selectedLocation.phone && selectedLocation.location_id !== -1 && (
                <View style={styles.phoneRow}>
                  <Ionicons name="call-outline" size={13} color="#64748b" />
                  <Text style={styles.phoneText}>{selectedLocation.phone}</Text>
                </View>
              )}
            </View>
          </View>

          {selectedLocation.description && selectedLocation.location_id !== -1 && (
            <Text style={styles.panelDesc} numberOfLines={2}>
              {selectedLocation.description}
            </Text>
          )}

          <View style={styles.panelActions}>
            {selectedLocation.location_id !== -1 && (
              <TouchableOpacity style={styles.panelButtonDetail} onPress={() => router.push(`/location/${selectedLocation.location_id}` as any)}>
                <Text style={styles.panelButtonDetailText}>Xem chi tiết</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.panelButtonRoute,
                selectedLocation.location_id === -1 && { flex: 1, marginLeft: 0 }
              ]}
              onPress={() => startRoute({ latitude: Number(selectedLocation.latitude), longitude: Number(selectedLocation.longitude) })}
            >
              <Ionicons name="navigate-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.panelButtonRouteText}>Chỉ đường</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Vòng quay Loading ngầm */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#14b8a6" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  map: { width: '100%', height: '100%' },
  floatingSearchContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  styleSelectorButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  styleMenu: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 20,
    width: 140,
  },
  styleMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  styleMenuItemActive: {
    backgroundColor: '#f1f5f9',
  },
  styleMenuText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  styleMenuTextActive: {
    color: '#14b8a6',
    fontWeight: 'bold',
  },
  sidebarButtons: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    alignItems: 'center',
  },
  sidebarButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarMarker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#cbd5e1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarMarkerSelected: {
    borderColor: '#14b8a6',
    borderWidth: 3.5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pinMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  pinMarkerSelected: {
    transform: [{ scale: 1.25 }],
    borderColor: '#14b8a6',
    borderWidth: 2.5,
  },
  detailPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    flex: 1,
    marginRight: 10,
  },
  panelAddress: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 10,
  },
  panelMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  panelCategory: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 10,
  },
  panelCategoryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  panelRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelRatingText: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 4,
    fontWeight: '500',
  },
  panelActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelButtonDetail: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  panelButtonDetailText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  panelButtonRoute: {
    flex: 1.2,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#14b8a6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#14b8a6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  panelButtonRouteText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  routeInfoPanel: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    zIndex: 10,
  },
  routeInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  routeInfoTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e293b',
    flex: 1,
    marginLeft: 8,
  },
  routeInfoBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routeStat: {
    flex: 1,
    alignItems: 'center',
  },
  routeStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  routeStatLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  routeStatLine: {
    width: 1,
    height: 30,
    backgroundColor: '#e2e8f0',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  categoriesContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    height: 40,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 6,
  },
  categoryPillActive: {
    backgroundColor: '#14b8a6',
    borderColor: '#14b8a6',
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  panelContentRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  panelImage: {
    width: 90,
    height: 70,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: '#cbd5e1',
  },
  panelInfoCol: {
    flex: 1,
  },
  panelMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phoneText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  panelDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
    marginBottom: 8,
    fontStyle: 'italic',
  },
});