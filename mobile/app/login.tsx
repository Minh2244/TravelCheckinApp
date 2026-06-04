import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';
import axiosClient from '../api/axiosClient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Hoàn tất phiên đăng nhập trên trình duyệt (cần thiết cho Android/Web)
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const setAuth = useAuthStore((state) => state.setAuth);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Lỗi', 'Email không đúng định dạng!');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/login', {
                email: email.trim(),
                password: password
            });

            const resData = response.data;
            if (resData && resData.success && resData.data) {
                const { user, accessToken, refreshToken } = resData.data;

                // Phân quyền user trên di động (chỉ cho phép Tourist/Khách du lịch đăng nhập)
                if (user.role !== 'user') {
                    Alert.alert(
                        'Từ chối truy cập',
                        `Tài khoản của bạn thuộc vai trò "${user.role}". Ứng dụng di động này hiện tại chỉ hỗ trợ vai trò Khách du lịch (User)!`
                    );
                    setLoading(false);
                    return;
                }

                setAuth(accessToken, refreshToken, user);
                router.replace('/(tabs)' as any);
            } else {
                Alert.alert('Đăng nhập thất bại', resData?.message || 'Email hoặc mật khẩu không chính xác!');
            }
        } catch (error: any) {
            console.error('Login error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Đăng nhập thất bại!';
            Alert.alert('Lỗi', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleSocialLogin = async (platform: 'Google' | 'Facebook') => {
        setLoading(true);
        try {
            // Tạo Redirect URI cho ứng dụng Expo Go / App di động
            const redirectUri = Linking.createURL('/');
            console.log('🔗 Expo Redirect URI:', redirectUri);

            // Gọi OAuth flow thông qua Server Backend (giúp tránh lỗi Redirect URI không trùng khớp)
            const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL;
            if (!apiBaseUrl) {
                Alert.alert('Lỗi', 'Chưa cấu hình EXPO_PUBLIC_API_URL trong file .env');
                setLoading(false);
                return;
            }

            const authEndpoint = platform === 'Google'
                ? `${apiBaseUrl}/auth/google/mobile`
                : `${apiBaseUrl}/auth/facebook/mobile`;

            const authUrl = `${authEndpoint}?returnTo=${encodeURIComponent(redirectUri)}`;
            console.log('🚀 Opening Auth URL:', authUrl);

            // Mở trình duyệt để xác thực OAuth thông qua backend
            const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
            
            if (result.type === 'success' && result.url) {
                const responseUrl = result.url;
                console.log('✅ Received redirect URL:', responseUrl);

                // Trích xuất access token, refresh token và user từ URL redirect của backend bằng Regex
                let accessToken = '';
                let refreshToken = '';
                let userJson = '';

                const tokenMatch = responseUrl.match(/[?&]accessToken=([^&]+)/);
                if (tokenMatch) accessToken = decodeURIComponent(tokenMatch[1]);

                const refreshMatch = responseUrl.match(/[?&]refreshToken=([^&]+)/);
                if (refreshMatch) refreshToken = decodeURIComponent(refreshMatch[1]);

                const userMatch = responseUrl.match(/[?&]user=([^&]+)/);
                if (userMatch) userJson = decodeURIComponent(userMatch[1]);

                const errorMatch = responseUrl.match(/[?&]error=([^&]+)/);
                if (errorMatch) {
                    const errorMsg = decodeURIComponent(errorMatch[1]);
                    Alert.alert('Đăng nhập thất bại', errorMsg);
                    setLoading(false);
                    return;
                }

                if (!accessToken || !userJson) {
                    Alert.alert('Lỗi', 'Không nhận được thông tin đăng nhập từ hệ thống.');
                    setLoading(false);
                    return;
                }

                const user = JSON.parse(userJson);

                // Phân quyền user đăng nhập di động (Tourist only)
                if (user.role !== 'user') {
                    Alert.alert(
                        'Từ chối truy cập',
                        `Tài khoản ${platform} của bạn thuộc vai trò "${user.role}". Ứng dụng này chỉ hỗ trợ vai trò Khách du lịch (User)!`
                    );
                    setLoading(false);
                    return;
                }

                // Lưu dữ liệu vào Zustand store và chuyển màn hình chính
                setAuth(accessToken, refreshToken, user);
                router.replace('/(tabs)' as any);
            } else if (result.type === 'cancel') {
                console.log('User cancelled social login OAuth');
            } else {
                Alert.alert('Đăng nhập thất bại', 'Quá trình xác thực bị hủy hoặc lỗi.');
            }
        } catch (error: any) {
            console.error('Social login error:', error);
            Alert.alert('Lỗi kết nối', error.response?.data?.message || error.message || 'Đăng nhập mạng xã hội thất bại!');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={[
                    styles.scrollContainer,
                    { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="airplane" size={40} color="#14b8a6" />
                    </View>
                    <Text style={styles.title}>TravelCheckin</Text>
                    <Text style={styles.subtitle}>Khám phá hành trình tuyệt vời của bạn</Text>
                </View>

                <View style={styles.form}>
                    {/* Email Input */}
                    <Text style={styles.label}>Email</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập email của bạn"
                            placeholderTextColor="#94a3b8"
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    {/* Password Input */}
                    <Text style={styles.label}>Mật khẩu</Text>
                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Nhập mật khẩu"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity
                            onPress={() => setShowPassword(!showPassword)}
                            style={styles.eyeIcon}
                        >
                            <Ionicons
                                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                size={20}
                                color="#94a3b8"
                            />
                        </TouchableOpacity>
                    </View>

                    {/* Forgot Password Link */}
                    <TouchableOpacity
                        style={styles.forgotPasswordContainer}
                        onPress={() => router.replace('/forgot-password' as any)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={styles.loginButton}
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.loginButtonText}>Đăng nhập</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>Hoặc đăng nhập với</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Social Login Buttons */}
                <View style={styles.socialContainer}>
                    <TouchableOpacity
                        style={[styles.socialButton, styles.googleButton]}
                        onPress={() => handleSocialLogin('Google')}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <Ionicons name="logo-google" size={20} color="#ea4335" />
                        <Text style={styles.socialButtonText}>Google</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.socialButton, styles.facebookButton]}
                        onPress={() => handleSocialLogin('Facebook')}
                        activeOpacity={0.8}
                        disabled={loading}
                    >
                        <Ionicons name="logo-facebook" size={20} color="#1877f2" />
                        <Text style={[styles.socialButtonText, { color: '#1877f2' }]}>Facebook</Text>
                    </TouchableOpacity>
                </View>

                {/* Registration Link Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Chưa có tài khoản?{' '}
                        <Text 
                            style={styles.registerText}
                            onPress={() => router.replace('/register' as any)}
                        >
                            Đăng ký ngay
                        </Text>
                    </Text>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    header: {
        alignItems: 'center',
        marginBottom: 28,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 24,
        backgroundColor: '#f0fdfa',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 2,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 6,
        textAlign: 'center',
    },
    form: {
        width: '100%',
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
        marginTop: 14,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        backgroundColor: '#f8fafc',
        height: 52,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#0f172a',
        fontSize: 15,
        height: '100%',
    },
    eyeIcon: {
        padding: 4,
    },
    forgotPasswordContainer: {
        alignSelf: 'flex-end',
        marginTop: 12,
        paddingVertical: 4,
    },
    forgotPasswordText: {
        color: '#14b8a6',
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: '#14b8a6',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#cbd5e1',
    },
    dividerText: {
        color: '#64748b',
        paddingHorizontal: 12,
        fontSize: 13,
    },
    socialContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    socialButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        gap: 8,
    },
    googleButton: {
        borderColor: '#ea4335',
        backgroundColor: '#fdf2f2',
    },
    facebookButton: {
        borderColor: '#1877f2',
        backgroundColor: '#f0f7ff',
    },
    socialButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ea4335',
    },
    footer: {
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 8,
    },
    footerText: {
        fontSize: 14,
        color: '#64748b',
    },
    registerText: {
        color: '#14b8a6',
        fontWeight: 'bold',
    }
});
