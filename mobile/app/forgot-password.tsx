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

export default function ForgotPasswordScreen() {
    const insets = useSafeAreaInsets();
    const [currentStep, setCurrentStep] = useState(0); // 0: Verify Info, 1: Enter OTP, 2: Reset Password
    const [loading, setLoading] = useState(false);

    // Form inputs
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSendOTP = async () => {
        if (!email || !phone) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ email và số điện thoại');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            Alert.alert('Lỗi', 'Email không đúng định dạng!');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/forgot-password', {
                email: email.trim(),
                phone: phone.trim()
            });

            const resData = response.data;
            if (resData && resData.success) {
                Alert.alert(
                    'Đã gửi mã OTP',
                    'Mã khôi phục OTP đã được gửi tới email của bạn. Vui lòng kiểm tra và điền vào ô xác nhận!'
                );
                setCurrentStep(1);
            } else {
                Alert.alert('Lỗi', resData?.message || 'Thông tin tài khoản không chính xác!');
            }
        } catch (error: any) {
            console.error('Forgot PW error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Lấy mã OTP thất bại!';
            Alert.alert('Lỗi', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyResetOTP = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert('Lỗi', 'Vui lòng nhập mã OTP gồm 6 chữ số');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/verify-reset-otp', {
                email: email.trim(),
                otp: otp.trim()
            });

            const resData = response.data;
            if (resData && resData.success) {
                Alert.alert('Xác thực thành công', 'Mã OTP chính xác! Bạn có thể đặt mật khẩu mới.');
                setCurrentStep(2);
            } else {
                Alert.alert('Lỗi', resData?.message || 'Mã OTP không chính xác!');
            }
        } catch (error: any) {
            console.error('Verify reset OTP error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Xác thực OTP thất bại!';
            Alert.alert('Lỗi', errMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu mới và xác nhận');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải dài ít nhất 6 ký tự!');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không trùng khớp!');
            return;
        }

        setLoading(true);
        try {
            const response = await axiosClient.post('/auth/reset-password', {
                email: email.trim(),
                otp: otp.trim(),
                newPassword: newPassword
            });

            const resData = response.data;
            if (resData && resData.success) {
                Alert.alert(
                    'Thành công',
                    'Mật khẩu của bạn đã được thay đổi thành công! Vui lòng đăng nhập lại bằng mật khẩu mới.',
                    [
                        {
                            text: 'Đăng nhập',
                            onPress: () => router.replace('/login' as any)
                        }
                    ]
                );
            } else {
                Alert.alert('Lỗi', resData?.message || 'Đổi mật khẩu thất bại!');
            }
        } catch (error: any) {
            console.error('Reset PW error:', error);
            const errMsg = error.response?.data?.message || error.message || 'Thay đổi mật khẩu thất bại!';
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
                        } else if (currentStep === 2) {
                            setCurrentStep(1);
                        } else {
                            router.replace('/login' as any);
                        }
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color="#0f172a" />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Khôi phục mật khẩu</Text>
                    <Text style={styles.subtitle}>
                        {currentStep === 0 && 'Nhập thông tin tài khoản đã đăng ký'}
                        {currentStep === 1 && `Nhập mã xác thực 6 số gửi đến ${email}`}
                        {currentStep === 2 && 'Đặt lại mật khẩu mới cho tài khoản của bạn'}
                    </Text>
                </View>

                <View style={styles.form}>
                    {currentStep === 0 && (
                        /* STEP 1: NHẬP EMAIL & SĐT */
                        <>
                            {/* Email */}
                            <Text style={styles.label}>Email tài khoản</Text>
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

                            {/* Phone */}
                            <Text style={styles.label}>Số điện thoại</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="call-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nhập số điện thoại"
                                    placeholderTextColor="#94a3b8"
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={handleSendOTP}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Tiếp tục</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {currentStep === 1 && (
                        /* STEP 2: NHẬP OTP */
                        <>
                            <Text style={styles.label}>Mã xác thực OTP</Text>
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

                            {/* Action Button */}
                            <TouchableOpacity
                                style={[styles.actionButton, styles.verifyButton]}
                                onPress={handleVerifyResetOTP}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Xác nhận OTP</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.resendLink}
                                onPress={handleSendOTP}
                            >
                                <Text style={styles.resendLinkText}>Gửi lại mã OTP?</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {currentStep === 2 && (
                        /* STEP 3: NHẬP MẬT KHẨU MỚI */
                        <>
                            {/* Mật khẩu mới */}
                            <Text style={styles.label}>Mật khẩu mới</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Nhập mật khẩu mới"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
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

                            {/* Xác nhận mật khẩu mới */}
                            <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
                            <View style={styles.inputContainer}>
                                <Ionicons name="shield-checkmark-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Xác nhận lại mật khẩu mới"
                                    placeholderTextColor="#94a3b8"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                />
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity
                                style={[styles.actionButton, styles.resetButton]}
                                onPress={handleResetPassword}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.actionButtonText}>Hoàn tất</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => router.replace('/login' as any)}>
                        <Text style={styles.backToLoginText}>Quay lại Đăng nhập</Text>
                    </TouchableOpacity>
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
        marginTop: 72,
        marginBottom: 36,
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
        paddingHorizontal: 16,
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
    resetButton: {
        backgroundColor: '#0f172a',
        shadowColor: '#0f172a',
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
        marginTop: 48,
        marginBottom: 12,
    },
    backToLoginText: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '600',
    }
});
