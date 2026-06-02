// Auth layout - Stack cho login/register
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen
        name="register"
        options={{
          headerShown: true,
          title: 'Đăng ký',
          headerBackTitle: 'Quay lại',
        }}
      />
    </Stack>
  );
}
