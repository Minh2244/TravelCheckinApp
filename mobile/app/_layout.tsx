// Root layout - khởi tạo auth và navigation
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import useAuthStore from '../src/stores/useAuthStore';
import { COLORS } from '../src/utils/constants';

export default function RootLayout() {
  const { isLoading, isAuthenticated, loadFromStorage } = useAuthStore();

  // Khôi phục session khi app khởi động
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Hiển thị loading khi đang kiểm tra session
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          // Chưa đăng nhập -> hiện auth screens
          <Stack.Screen name="(auth)" />
        ) : (
          // Đã đăng nhập -> hiện main app
          <Stack.Screen name="(tabs)" />
        )}
        <Stack.Screen
          name="location/[id]"
          options={{
            headerShown: true,
            title: 'Chi tiết địa điểm',
            headerTintColor: COLORS.primary,
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
