/**
 * Tab Navigator — 5 tabs chính
 * TravelCheckinApp Mobile
 * Xử lý safe area cho tai thỏ + nút điều hướng
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize } from '../../constants/theme';

export default function TabLayout() {
  // Tự động đo vùng an toàn theo từng điện thoại
  // iPhone có tai thỏ: top ~59, bottom ~34
  // Android 3 nút: top ~24, bottom ~48
  // Android gesture: top ~24, bottom ~20
  const insets = useSafeAreaInsets();

  // Chiều cao tab bar cơ bản + padding dưới cho safe area
  const TAB_BAR_BASE_HEIGHT = 60;
  const TAB_BAR_BASE_PADDING_BOTTOM = 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          // Chiều cao tab bar + vùng safe area dưới
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          // Padding dưới = mặc định + insets.bottom
          // Đảm bảo tab bar nằm TRÊN nút điều hướng
          paddingBottom: TAB_BAR_BASE_PADDING_BOTTOM + insets.bottom,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.xs,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Bản đồ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tickets"
        options={{
          title: 'Vé',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ticket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Hồ sơ',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Lịch sử',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
