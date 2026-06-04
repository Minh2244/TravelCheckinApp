import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import axiosClient from '../../api/axiosClient';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 2;

interface LocationData {
  location_id: number;
  location_name: string;
  first_image: string | null;
  rating: number;
  province: string;
  location_type: string;
  total_reviews: number;
}

interface DashboardData {
  recommendations: LocationData[];
  totalCheckins: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const [data, setData] = useState<DashboardData>({ recommendations: [], totalCheckins: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<{ temp: number | null; desc: string | null }>({ temp: null, desc: null });

  // Dịch loại địa điểm
  const typeLabelVi = (type: string) => {
    const map: Record<string, string> = {
      hotel: 'Khách sạn',
      resort: 'Resort',
      restaurant: 'Nhà hàng',
      cafe: 'Cà phê',
      tourist: 'Du lịch',
    };
    return map[type.toLowerCase()] || 'Địa điểm';
  };

  const fetchWeather = async (lat: number, lon: number) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`;
      const res = await fetch(url);
      const json = await res.json();
      const t = json?.current?.temperature_2m;
      const code = json?.current?.weather_code;

      const weatherCodeText = (c: number): string => {
        if (c === 0) return "Trời quang";
        if (c === 1 || c === 2) return "Ít mây";
        if (c === 3) return "Nhiều mây";
        if (c === 45 || c === 48) return "Sương mù";
        if (c === 51 || c === 53 || c === 55) return "Mưa phùn";
        if (c === 61 || c === 63 || c === 65) return "Mưa";
        if (c === 80 || c === 81 || c === 82) return "Mưa rào";
        if (c === 95) return "Giông";
        return "Thời tiết tốt";
      };

      setWeather({
        temp: t != null ? Math.round(t) : null,
        desc: code != null ? weatherCodeText(code) : null,
      });
    } catch (e) {
      console.log('Error fetching weather', e);
    }
  };

  const fetchDashboard = useCallback(async () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      setRefreshing(false);
      return;
    }
    try {
      setRefreshing(true);
      const [recRes, profileRes] = await Promise.all([
        axiosClient.get('/user/recommendations/locations'),
        axiosClient.get('/user/profile'),
      ]);
      setData({
        recommendations: recRes.data.data || [],
        totalCheckins: profileRes.data.data?.total_checkins || 0,
      });

      // Lấy vị trí thời tiết
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const gps = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        fetchWeather(gps.coords.latitude, gps.coords.longitude);
      } else {
        fetchWeather(10.0451, 105.7468); // Cần Thơ mặc định
      }
    } catch (err) {
      console.log('Error fetching dashboard data', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const memberTier = useMemo(() => {
    const c = data.totalCheckins;
    if (c <= 4) return { name: 'Newbie', color: '#94a3b8' };
    if (c <= 15) return { name: 'Silver Traveler', color: '#14b8a6' };
    if (c <= 30) return { name: 'Gold Explorer', color: '#e11d48' };
    return { name: 'Diamond Pathfinder', color: '#3b82f6' };
  }, [data.totalCheckins]);

  const QUICK_ACTIONS = [
    { id: '1', title: 'Nhắc lịch', icon: 'calendar-outline', color: '#3b82f6', route: '/booking-reminders' },
    { id: '2', title: 'Đã lưu', icon: 'heart-outline', color: '#f43f5e', route: '/saved-locations' },
    { id: '3', title: 'Voucher', icon: 'ticket-outline', color: '#f59e0b', route: '/vouchers' },
    { id: '4', title: 'Lịch sử', icon: 'footsteps-outline', color: '#10b981', route: '/history' },
    { id: '5', title: 'SOS', icon: 'warning-outline', color: '#ef4444', route: '/sos' },
  ];

  const handleActionPress = (action: typeof QUICK_ACTIONS[0]) => {
    if (action.route === '/sos') {
      router.push('/sos' as any);
    } else if (action.route === '/history') {
      router.push('/(tabs)/history' as any);
    } else {
      router.push(action.route as any);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top greeting with avatar and weather widget */}
      <View style={styles.topSection}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${user.avatar_url}`) : 'https://via.placeholder.com/150' }}
            style={styles.avatar}
          />
          <View style={styles.greeting}>
            <Text style={styles.greetingText} numberOfLines={1}>Xin chào, {user?.full_name}</Text>
            <View style={[styles.tierBadge, { backgroundColor: memberTier.color }]}>
              <Text style={styles.tierText}>{memberTier.name}</Text>
            </View>
          </View>
        </View>

        {/* Weather Widget */}
        {weather.temp !== null && (
          <View style={styles.weatherWidget}>
            <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
            <View style={styles.weatherInfo}>
              <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
              <Text style={styles.weatherDesc} numberOfLines={1}>{weather.desc}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Grid actions (5 buttons layout) */}
      <View style={styles.quickActionGrid}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity key={action.id} style={styles.actionButton} onPress={() => handleActionPress(action)}>
            <View style={[styles.actionIcon, { backgroundColor: `${action.color}10` }]}>
              <Ionicons name={action.icon as any} size={22} color={action.color} />
            </View>
            <Text style={styles.actionText}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Đề xuất cho bạn</Text>
    </View>
  );

  const renderLocationCard = ({ item }: { item: LocationData }) => {
    const imageUrl = item.first_image
      ? (item.first_image.startsWith('http') ? item.first_image : `${process.env.EXPO_PUBLIC_API_URL?.replace('/api', '')}${item.first_image}`)
      : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/location/${item.location_id}` as any)}
        activeOpacity={0.9}
      >
        <View style={styles.cardImageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImage} />
          ) : (
            <View style={styles.cardFallbackImage}>
              <Ionicons name="image-outline" size={32} color="#94a3b8" />
            </View>
          )}
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{typeLabelVi(item.location_type)}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.location_name}</Text>
          
          <View style={styles.cardFooter}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#64748b" />
              <Text style={styles.locationText} numberOfLines={1}>{item.province}</Text>
            </View>
            
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#fbbf24" />
              <Text style={styles.ratingText}>{Number(item.rating || 0).toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={data.recommendations}
      keyExtractor={(item) => item.location_id.toString()}
      ListHeaderComponent={renderHeader}
      renderItem={renderLocationCard}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboard} colors={['#14b8a6']} />}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    marginBottom: 20,
    width: '100%',
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#14b8a6',
    backgroundColor: '#e2e8f0',
  },
  greeting: {
    marginLeft: 12,
    flex: 1,
  },
  greetingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  tierBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  weatherWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  weatherInfo: {
    marginLeft: 6,
  },
  weatherTemp: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  weatherDesc: {
    fontSize: 9,
    color: '#64748b',
    maxWidth: 70,
  },
  quickActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  actionButton: {
    width: '18%',
    alignItems: 'center',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
    marginTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardImageContainer: {
    width: '100%',
    height: 110,
    position: 'relative',
    backgroundColor: '#f1f5f9',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardFallbackImage: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardBody: {
    padding: 10,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  locationText: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 3,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 2,
  },
});