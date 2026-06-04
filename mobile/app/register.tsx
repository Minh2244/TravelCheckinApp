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
import { router } from 'expo-router';
import axiosClient from '../api/axiosClient';

export default function RegisterScreen() {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0); // 0: Info, 1: OTP
    const [loading, setLoading] = useState(false);

    // Form Info
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Form OTP
    const [otp, setOtp] = useState('');

    const handleRegisterInfo = async () => {
        if (!fullName || !phone || !email || !password || !confirmPassword) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Lỗi', 'Email không đúng định dạng!');
            return;
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone.trim())) {
            Alert.alert('Lỗi', 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số)!');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải dài ít nhất 6 ký tự!');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không trùng khớp!');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/register', {
                full_name: fullName.trim(),
                email: email.trim(),
                password: password,
                phone: phone.trim(),
            });

            const resData = response.data;
            if (resData && resData.success) {
                Alert.alert(
                    'Đăng ký thành công',
                    'Một mã xác thực OTP đã được gửi tới email của bạn. Vui lòng nhập mã để kích hoạt tài khoản!'
                );
                setCurrentStep(1);
            } else {
                Alert.alert('Đăng ký thất bại', resData?.message || 'Không thể tạo tài khoản!');
            }
        } catch (error: any) {
            console.error('Register error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Đăng ký thất bại!';
            Alert.alert('Lỗi', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert('Lỗi', 'Vui lòng nhập mã OTP gồm 6 chữ số');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/verify-otp', {
                email: email.trim(),
                otp: otp.trim()
            });

            const resData = response.data;
            if (resData && resData.success) {
                Alert.alert(
                    'Thành công',
                    'Tài khoản của bạn đã được kích hoạt thành công! Hãy tiến hành đăng nhập.',
                    [
                        {
                            text: 'Đăng nhập',
                            onPress: () => router.replace('/login' as any)
                        }
                    ]
                );
            } else {
                Alert.alert('Kích hoạt thất bại', resData?.message || 'Mã OTP không chính xác!');
            }
        } catch (error: any) {
            console.error('OTP Verify error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Kích hoạt tài khoản thất bại!';
            Alert.alert('Lỗi', errMsg);
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
                {/* Back Button */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        if (currentStep === 1) {
                            setCurrentStep(0);
                        } else {
                            router.replace('/login' as any);
                        }
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>
                        {currentStep === 0 ? 'Tạo tài khoản' : 'Xác thực OTP'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {currentStep === 0 
                            ? 'Bắt đầu hành trình du lịch thông minh cùng chúng tôi' 
                            : `Nhập mã 6 số được gửi tới email ${email}`}
                    </Text>
                </View>

                {currentStep === 0 ? (
                    /* STEP 1: NHẬP THÔNG TIN */
                    <View style={styles.form}>
                        {/* Họ tên */}
                        <Text style={styles.label}>Họ và tên</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nhập họ và tên"
                                placeholderTextColor="#94a3b8"
                                value={fullName}
                                onChangeText={setFullName}
                            />
                        </View>

                        {/* Số điện thoại */}
                        <Text style={styles.label}>Số điện thoại</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="call-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nhập số điện thoại (10 chữ số)"
                                placeholderTextColor="#94a3b8"
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                            />
                        </View>

                        {/* Email */}
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nhập địa chỉ email"
                                placeholderTextColor="#94a3b8"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        {/* Mật khẩu */}
                        <Text style={styles.label}>Mật khẩu</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
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

                        {/* Nhập lại mật khẩu */}
                        <Text style={styles.label}>Xác nhận mật khẩu</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="shield-checkmark-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Nhập lại mật khẩu"
                                placeholderTextColor="#94a3b8"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        {/* Register Submit Button */}
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={handleRegisterInfo}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.actionButtonText}>Đăng ký</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* STEP 2: XÁC THỰC OTP */
                    <View style={styles.form}>
                        <Text style={styles.label}>Mã OTP</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons name="key-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                            <TextInput
                                style={[styles.input, styles.otpInput]}
                                placeholder="******"
                                placeholderTextColor="#cbd5e1"
                                keyboardType="number-pad"
                                maxLength={6}
                                value={otp}
                                onChangeText={setOtp}
                            />
                        </View>

                        {/* OTP Verify Button */}
                        <TouchableOpacity
                            style={[styles.actionButton, styles.verifyButton]}
                            onPress={handleVerifyOTP}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.actionButtonText}>Kích hoạt tài khoản</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.resendLink}
                            onPress={() => {
                                // Call register API again to resend OTP
                                handleRegisterInfo();
                            }}
                        >
                            <Text style={styles.resendLinkText}>Gửi lại mã OTP?</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Đã có tài khoản?{' '}
                        <Text 
                            style={styles.loginLink}
                            onPress={() => router.replace('/login' as any)}
                        >
                            Đăng nhập
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
        paddingHorizontal: 28,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: 24,
        left: 20,
        padding: 8,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        marginTop: 64,
        marginBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#334155',
        marginBottom: 8,
        marginTop: 16,
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
    otpInput: {
        textAlign: 'center',
        fontSize: 22,
        fontWeight: 'bold',
        letterSpacing: 8,
    },
    eyeIcon: {
        padding: 4,
    },
    actionButton: {
        backgroundColor: '#14b8a6',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
        shadowColor: '#14b8a6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    verifyButton: {
        backgroundColor: '#10b981',
        shadowColor: '#10b981',
    },
    actionButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    resendLink: {
        alignItems: 'center',
        marginTop: 20,
    },
    resendLinkText: {
        color: '#14b8a6',
        fontSize: 14,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        marginTop: 36,
        marginBottom: 12,
    },
    footerText: {
        fontSize: 14,
        color: '#64748b',
    },
    loginLink: {
        color: '#14b8a6',
        fontWeight: 'bold',
    }
});
