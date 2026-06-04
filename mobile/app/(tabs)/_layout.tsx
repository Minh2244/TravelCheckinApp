// app/(tabs)/_layout.tsx
// Tab bar layout — 4 tab chinh + tab history an

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight } from '../../constants/theme';
import SessionRevokedModal from '../../components/SessionRevokedModal';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10,
              height: 65,
            },
          ],
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Bản đồ',
            tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="tickets"
          options={{
            title: 'Vé của tôi',
            tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Tài khoản',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="history" options={{ href: null }} />
      </Tabs>
      <SessionRevokedModal />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderTopWidth: 0,
    paddingHorizontal: 10,
  },
  tabBarItem: { paddingVertical: 8 },
  tabBarLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as any, marginTop: 4 },
});
