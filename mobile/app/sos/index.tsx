import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Linking,
    Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';

interface SosResponse {
    success: boolean;
    alert_id?: number;
    message?: string;
}

export default function SosScreen() {
    const insets = useSafeAreaInsets();
    const { user } = useAuthStore();
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [locationStatus, setLocationStatus] = useState<string>('Đang định vị...');
    const [currentCoords, setCurrentCoords] = useState<Location.LocationObjectCoords | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationStatus('Không có quyền truy cập vị trí');
                    Alert.alert('Lỗi', 'Vui lòng cấp quyền vị trí để sử dụng tính năng SOS.');
                    return;
                }

                const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setCurrentCoords(location.coords);
                setLocationStatus('Đã lấy được vị trí hiện tại');
            } catch (error) {
                setLocationStatus('Không thể lấy vị trí');
            }
        })();
    }, []);

    const handleSendSOS = async () => {
        if (!currentCoords) {
            Alert.alert('Lỗi', 'Chưa xác định được vị trí của bạn. Vui lòng chờ trong giây lát.');
            return;
        }

        Alert.alert(
            'Xác nhận khẩn cấp',
            'Bạn có chắc chắn muốn gửi tín hiệu SOS kèm theo tọa độ hiện tại đến hệ thống không?',
            [
                { text: 'Hủy', style: 'cancel' },
                {
                    text: 'Gửi SOS',
                    style: 'destructive',
                    onPress: executeSosCall
                }
            ]
        );
    };

    const executeSosCall = async () => {
        try {
            setIsProcessing(true);
            const payload = {
                latitude: currentCoords?.latitude,
                longitude: currentCoords?.longitude,
                location_text: `Tọa độ khẩn cấp: ${currentCoords?.latitude}, ${currentCoords?.longitude}`,
                message: 'Tôi đang gặp nguy hiểm, cần hỗ trợ khẩn cấp!',
            };

            const response = await axiosClient.post<SosResponse>('/sos', payload);

            if (response.data.success) {
                Alert.alert(
                    'Đã gửi SOS',
                    'Tín hiệu khẩn cấp và vị trí của bạn đã được gửi đến ban quản lý khu vực và hệ thống an ninh.',
                    [{ text: 'Đã hiểu', onPress: () => router.back() }]
                );
            }
        } catch (error: any) {
            Alert.alert('Gửi thất bại', error.response?.data?.message || 'Không thể gửi tín hiệu SOS lúc này. Vui lòng thử gọi điện trực tiếp.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCallPolice = () => {
        const phoneNumber = Platform.OS === 'ios' ? 'telprompt:113' : 'tel:113';
        Linking.openURL(phoneNumber).catch(() => {
            Alert.alert('Lỗi', 'Thiết bị của bạn không hỗ trợ gọi điện trực tiếp.');
        });
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hỗ trợ khẩn cấp SOS</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.content}>
                <View style={styles.warningBox}>
                    <Ionicons name="warning" size={32} color="#ef4444" />
                    <Text style={styles.warningTitle}>CẢNH BÁO</Text>
                    <Text style={styles.warningText}>
                        Chỉ sử dụng tính năng này khi bạn đang trong tình huống thực sự nguy hiểm hoặc cần hỗ trợ y tế khẩn cấp.
                    </Text>
                </View>

                <View style={styles.locationContainer}>
                    <Ionicons name="location" size={20} color="#3b82f6" />
                    <Text style={styles.locationText}>{locationStatus}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.sosButton, isProcessing && styles.sosButtonDisabled]}
                    onPress={handleSendSOS}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="large" color="#ffffff" />
                    ) : (
                        <>
                            <Ionicons name="radio-outline" size={48} color="#ffffff" />
                            <Text style={styles.sosButtonText}>PHÁT TÍN HIỆU SOS</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.callButton} onPress={handleCallPolice}>
                    <Ionicons name="call" size={24} color="#ffffff" />
                    <Text style={styles.callButtonText}>GỌI CẢNH SÁT (113)</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    content: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    warningBox: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#fca5a5',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        marginBottom: 32,
        width: '100%',
    },
    warningTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#ef4444',
        marginTop: 8,
        marginBottom: 4,
    },
    warningText: {
        fontSize: 14,
        color: '#991b1b',
        textAlign: 'center',
        lineHeight: 20,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#eff6ff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 40,
    },
    locationText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#1e3a8a',
        fontWeight: '600',
    },
    sosButton: {
        width: 220,
        height: 220,
        backgroundColor: '#ef4444',
        borderRadius: 110,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 10,
        shadowColor: '#ef4444',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        marginBottom: 40,
        borderWidth: 8,
        borderColor: '#fca5a5',
    },
    sosButtonDisabled: {
        backgroundColor: '#f87171',
        borderColor: '#fecaca',
    },
    sosButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
        marginTop: 12,
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        width: '100%',
        justifyContent: 'center',
    },
    callButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 12,
    },
});