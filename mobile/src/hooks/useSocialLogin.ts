// Hook xử lý đăng nhập Google/Facebook qua server-side OAuth
// Backend xử lý toàn bộ OAuth flow, redirect về app qua deep link
// Hoạt động trên cả Expo Go và APK
import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import useAuthStore from '../stores/useAuthStore';
import { API_BASE_URL } from '../utils/constants';

interface SocialLoginResult {
  googleLogin: () => Promise<void>;
  facebookLogin: () => Promise<void>;
}

function extractParamsFromUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const queryString = url.split('?')[1];
  if (!queryString) return params;
  for (const pair of queryString.split('&')) {
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return params;
}

export function useSocialLogin(): SocialLoginResult {
  // Deep link của app: exp://... (Expo Go) hoặc travelcheckin://... (APK)
  const returnUrl = Linking.createURL('auth/callback');
  console.log('🔗 App Return URL:', returnUrl);

  const handleOAuth = useCallback(async (provider: 'google' | 'facebook') => {
    try {
      const backendUrl = `${API_BASE_URL}/auth/${provider}/mobile?returnTo=${encodeURIComponent(returnUrl)}`;
      console.log(`🔵 Mở OAuth ${provider}:`, backendUrl);

      const result = await WebBrowser.openAuthSessionAsync(backendUrl, returnUrl);

      console.log(`🔵 OAuth ${provider} result:`, result.type);

      if (result.type === 'success' && result.url) {
        const params = extractParamsFromUrl(result.url);

        if (params.error) {
          console.error(`🔵 OAuth ${provider} error:`, params.error);
          Alert.alert('Lỗi đăng nhập', params.error);
          return;
        }

        if (params.accessToken && params.refreshToken) {
          console.log(`🔵 OAuth ${provider} thành công!`);

          const SecureStore = await import('expo-secure-store');
          await SecureStore.setItemAsync('accessToken', params.accessToken);
          await SecureStore.setItemAsync('refreshToken', params.refreshToken);

          // Lấy user info từ redirect URL (backend đã encode)
          let user = null;
          if (params.user) {
            try {
              user = JSON.parse(decodeURIComponent(params.user));
            } catch { /* ignore */ }
          }

          if (user) {
            await SecureStore.setItemAsync('user', JSON.stringify(user));
            useAuthStore.setState({
              user,
              accessToken: params.accessToken,
              refreshToken: params.refreshToken,
              isAuthenticated: true,
            });
            console.log(`🔵 Đăng nhập ${provider} thành công! User:`, user.email);
          } else {
            // Fallback: decode JWT
            try {
              const payload = JSON.parse(atob(params.accessToken.split('.')[1]));
              const userData = {
                user_id: payload.userId,
                email: '',
                phone: null,
                full_name: '',
                role: payload.role || 'user',
                status: 'active' as const,
                avatar_url: null,
                avatar_path: null,
                avatar_source: null,
                is_verified: 1,
                created_at: new Date().toISOString(),
              };
              await SecureStore.setItemAsync('user', JSON.stringify(userData));
              useAuthStore.setState({
                user: userData as any,
                accessToken: params.accessToken,
                refreshToken: params.refreshToken,
                isAuthenticated: true,
              });
            } catch {
              Alert.alert('Lỗi', 'Không lấy được thông tin người dùng. Vui lòng thử lại.');
            }
          }
        } else {
          console.error(`🔵 OAuth ${provider} không có token:`, params);
          Alert.alert('Lỗi', 'Không nhận được token từ server. Vui lòng thử lại.');
        }
      } else if (result.type === 'dismiss') {
        console.log(`🔵 Người dùng hủy đăng nhập ${provider}`);
      } else if (result.type === 'cancel') {
        console.log(`🔵 Người dùng hủy đăng nhập ${provider}`);
      } else {
        console.log(`🔵 OAuth ${provider} result:`, result.type);
      }
    } catch (error: any) {
      console.error(`🔵 OAuth ${provider} error:`, error);
      Alert.alert(`Lỗi đăng nhập ${provider}`, error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.');
    }
  }, [returnUrl]);

  const googleLogin = useCallback(() => handleOAuth('google'), [handleOAuth]);
  const facebookLogin = useCallback(() => handleOAuth('facebook'), [handleOAuth]);

  return { googleLogin, facebookLogin };
}
