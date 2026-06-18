import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#3b82f6',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
            paddingBottom: Math.max(insets.bottom, 8),
            paddingTop: 8,
            height: 60 + insets.bottom,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🏠</Text>,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Khám phá',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🔍</Text>,
          }}
        />
        <Tabs.Screen
          name="booking"
          options={{
            title: 'Đặt chỗ',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🎫</Text>,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Thông báo',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>🔔</Text>,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Cá nhân',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 24, color }}>👤</Text>,
          }}
        />
      </Tabs>
    </>
  );
}
