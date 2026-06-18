import React from 'react';
import { View, Text, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import useAuthStore from '../../store/authStore';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ fontSize: 64, marginBottom: 16 }}>👤</Text>
        <Text
          style={{
            fontSize: 24,
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: 8,
          }}
        >
          {isAuthenticated ? user?.full_name : 'Khách'}
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: 24,
          }}
        >
          {isAuthenticated ? user?.email : 'Đăng nhập để trải nghiệm đầy đủ'}
        </Text>

        {isAuthenticated ? (
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: '#ef4444',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              Đăng xuất
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            style={{
              backgroundColor: '#3b82f6',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              Đăng nhập
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
