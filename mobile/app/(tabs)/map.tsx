// app/(tabs)/map.tsx
// Man hinh ban do day du: OSM tiles, markers, tim kiem, routing, detail panel

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import { extractOpenClose } from '../../utils/openingHours';
import Badge from '../../components/Badge';
import type { Location as LocationType } from '../../types';

// Cac lop tile ban do co the chuyen doi
const TILE_LAYERS = [
  { key: 'voyager', label: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
  { key: 'positron', label: 'Sang', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { key: 'osm', label: 'OSM', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { key: 'satellite', label: 'Ve tinh', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
];

// Hai URL OSRM de fallback khi mot URL bi loi
const OSRM_URLS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];

interface Coord {
  latitude: number;
  longitude: number;
}

interface FavoriteItem {
  location_id: number;
}

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(null);
  const [layerIndex, setLayerIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<Coord | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coord[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Xin quyen truy cap vi tri GPS
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  // Tai danh sach dia diem va yeu thich tu API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [locRes, favRes] = await Promise.all([
          axiosClient.get(LOCATIONS_API.LIST),
          axiosClient.get(USER_API.FAVORITES).catch(() => ({ data: [] })),
        ]);
        setLocations(locRes.data.data || locRes.data || []);
        const favIds = new Set<number>(
          (favRes.data.data || favRes.data || []).map((f: FavoriteItem) => f.location_id)
        );
        setFavorites(favIds);
      } catch {
        // Khong xu ly loi, man hinh van hien binh thuong
      }
    };
    fetchData();
  }, []);

  // Loc dia diem theo danh muc va tu khoa tim kiem
  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'saved') {
        result = result.filter((l) => favorites.has(l.location_id));
      } else {
        result = result.filter((l) => l.location_type === selectedCategory);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.location_name.toLowerCase().includes(q) ||
          (l.address && l.address.toLowerCase().includes(q)) ||
          (l.province && l.province.toLowerCase().includes(q))
      );
    }
    return result;
  }, [locations, search, selectedCategory, favorites]);

  // Tim duong di bang OSRM, fallback qua URL thu hai neu URL dau loi
  const handleRoute = useCallback(async (dest: LocationType) => {
    if (!userLocation) return;
    setLoadingRoute(true);
    setRouteCoords([]);
    setRouteInfo(null);

    const { latitude: lat1, longitude: lon1 } = userLocation;
    const { latitude: lat2, longitude: lon2 } = dest;

    for (const baseUrl of OSRM_URLS) {
      try {
        const url = `${baseUrl}/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords: Coord[] = route.geometry.coordinates.map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          setRouteCoords(coords);
          setRouteInfo({
            distance: route.distance < 1000 ? `${Math.round(route.distance)}m` : `${(route.distance / 1000).toFixed(1)}km`,
            duration: route.duration < 3600
              ? `${Math.round(route.duration / 60)} phut`
              : `${Math.floor(route.duration / 3600)}h ${Math.round((route.duration % 3600) / 60)}phut`,
          });
          break;
        }
      } catch {
        // Thu URL tiep theo
      }
    }
    setLoadingRoute(false);
  }, [userLocation]);

  // Xoa tuyen duong hien tai
  const clearRoute = () => {
    setRouteCoords([]);
    setRouteInfo(null);
  };

  // Chuyen doi giua cac lop tile ban do
  const toggleLayer = () => {
    setLayerIndex((prev) => (prev + 1) % TILE_LAYERS.length);
  };

  const currentLayer = TILE_LAYERS[layerIndex];

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.latitude || 10.03,
          longitude: userLocation?.longitude || 105.77,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
      >
        <UrlTile urlTemplate={currentLayer.url} maximumZ={17} />

        {/* Marker tung dia diem voi anh dai dien tron */}
        {filteredLocations.map((loc) => (
          <Marker
            key={loc.location_id}
            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
            onPress={() => {
              setSelectedLocation(loc);
              setRouteCoords([]);
              setRouteInfo(null);
            }}
          >
            <View style={[styles.markerContainer, favorites.has(loc.location_id) && styles.markerFavorite]}>
              {loc.first_image ? (
                <Image source={{ uri: loc.first_image }} style={styles.markerImage} />
              ) : (
                <View style={[styles.markerImage, styles.markerFallback]}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                </View>
              )}
            </View>
          </Marker>
        ))}

        {/* Tuyen duong chi dan */}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />
        )}
      </MapView>

      {/* Thanh tim kiem */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tim kiem dia diem..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity onPress={toggleLayer}>
          <Ionicons name="layers" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Loc danh muc keo ngang */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          { key: 'all', label: 'Tat ca' },
          { key: 'food', label: 'An uong' },
          { key: 'tourist', label: 'Du lich' },
          { key: 'hotel', label: 'Khach san' },
          { key: 'saved', label: 'Da luu' },
        ]}
        style={styles.categoryList}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategory === item.key && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <Text style={[styles.categoryLabel, selectedCategory === item.key && styles.categoryLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Panel thong tin tuyen duong */}
      {routeInfo && (
        <View style={styles.routeInfoPanel}>
          <View>
            <Text style={styles.routeDistance}>{routeInfo.distance}</Text>
            <Text style={styles.routeDuration}>{routeInfo.duration}</Text>
          </View>
          <TouchableOpacity onPress={clearRoute}>
            <Ionicons name="close-circle" size={28} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}
      {loadingRoute && (
        <View style={styles.routeInfoPanel}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.routeLoadingText}>Dang tim duong...</Text>
        </View>
      )}

      {/* Panel chi tiet dia diem khi chon marker */}
      {selectedLocation && !routeInfo && (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailName} numberOfLines={1}>{selectedLocation.location_name}</Text>
            <TouchableOpacity onPress={() => setSelectedLocation(null)}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.detailAddress} numberOfLines={1}>
            {selectedLocation.address || selectedLocation.province || ''}
          </Text>
          <View style={styles.detailMeta}>
            {selectedLocation.avg_rating != null && selectedLocation.avg_rating > 0 && (
              <View style={styles.detailMetaItem}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.detailMetaText}>{selectedLocation.avg_rating.toFixed(1)}</Text>
              </View>
            )}
            {(() => {
              const oc = extractOpenClose(selectedLocation.opening_hours);
              if (oc) {
                const isOpen = (() => {
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const [oh, om] = oc.open.split(':').map(Number);
                  const [ch, cm] = oc.close.split(':').map(Number);
                  const openMin = oh * 60 + om;
                  const closeMin = ch * 60 + cm;
                  if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin;
                  return nowMin >= openMin || nowMin < closeMin;
                })();
                return (
                  <Badge text={isOpen ? `Mo cua ${oc.open}-${oc.close}` : 'Da dong'} variant={isOpen ? 'success' : 'error'} />
                );
              }
              return null;
            })()}
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity
              style={styles.detailActionBtn}
              onPress={() => router.push(`/location/${selectedLocation.location_id}`)}
            >
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.detailActionText}>Chi tiet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailActionBtn, styles.detailActionPrimary]}
              onPress={() => handleRoute(selectedLocation)}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={[styles.detailActionText, styles.detailActionTextWhite]}>Chi duong</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  categoryList: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 105,
    left: 0,
    right: 0,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryPillActive: { backgroundColor: colors.primary },
  categoryLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  categoryLabelActive: { color: '#fff' },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  markerFavorite: { borderColor: colors.warning },
  markerImage: { width: 32, height: 32, borderRadius: 16 },
  markerFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  routeInfoPanel: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeDistance: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  routeDuration: { fontSize: fontSize.sm, color: colors.textSecondary },
  routeLoadingText: { marginLeft: spacing.sm, color: colors.textSecondary },
  detailPanel: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  detailAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center' },
  detailMetaText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 4 },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  detailActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  detailActionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary, marginLeft: 6 },
  detailActionTextWhite: { color: '#fff' },
});
