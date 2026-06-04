import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
    ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../../api/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';

interface CheckinItem {
    checkin_id: number;
    location_id: number;
    checkin_time: string;
    status: 'pending' | 'verified' | 'failed';
    notes: string | null;
    location_name?: string;
    address?: string;
    first_image?: string | null;
    is_user_created?: number;
}

interface ApiResponse {
    success: boolean;
    data: CheckinItem[];
}

export default function HistoryScreen() {
    const insets = useSafeAreaInsets();
    const [history, setHistory] = useState<CheckinItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    const fetchHistory = useCallback(async (isRefresh = false) => {
        const token = useAuthStore.getState().accessToken;
        if (!token) {
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }
        try {
            if (isRefresh) setIsRefreshing(true);
            else setIsLoading(true);

            const response = await axiosClient.get<ApiResponse>('/user/checkins');
            if (response.data && response.data.data) {
                setHistory(response.data.data);
            }
        } catch (error) {
            console.log('Error fetching checkin history', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    const formatDate = (dateString: string) => {
        const d = new Date(dateString);
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        return `${time} - ${date}`;
    };

    const getStatusProps = (status: string) => {
        switch (status) {
            case 'verified': return { color: '#10b981', bg: '#dcfce7', icon: 'checkmark-circle' as const, label: 'Đã xác thực' };
            case 'failed': return { color: '#ef4444', bg: '#fee2e2', icon: 'close-circle' as const, label: 'Thất bại' };
            default: return { color: '#f59e0b', bg: '#fef3c7', icon: 'time' as const, label: 'Chờ duyệt' };
        }
    };

    const renderEmptyComponent = () => {
        if (isLoading) {
            return (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color="#14b8a6" />
                    <Text style={styles.loadingText}>Đang tải lịch sử...</Text>
                </View>
            );
        }

        return (
            <View style={styles.centerContainer}>
                <View style={styles.emptyCircle}>
                    <Ionicons name="footsteps-outline" size={48} color="#cbd5e1" />
                </View>
                <Text style={styles.emptyTitle}>Chưa có dấu chân nào</Text>
                <Text style={styles.emptySubtitle}>Bạn chưa thực hiện Check-in tại địa điểm nào. Hãy bắt đầu hành trình của bạn ngay nhé!</Text>
            </View>
        );
    };

    const renderItem = ({ item }: { item: CheckinItem }) => {
        const statusProps = getStatusProps(item.status);
        const locName = item.location_name || 'Địa điểm không xác định';
        const locAddress = item.address || 'Khu vực tự do';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.dateText}>{formatDate(item.checkin_time)}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusProps.bg }]}>
                        <Ionicons name={statusProps.icon} size={14} color={statusProps.color} />
                        <Text style={[styles.statusText, { color: statusProps.color }]}>{statusProps.label}</Text>
                    </View>
                </View>

                <View style={styles.cardBody}>
                    <View style={styles.iconBox}>
                        <Ionicons name="location" size={24} color="#3b82f6" />
                    </View>
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationTitle}>{locName}</Text>
                        <Text style={styles.locationSubtitle} numberOfLines={1}>{locAddress}</Text>
                    </View>
                </View>

                {item.notes && (
                    <View style={styles.notesBox}>
                        <Ionicons name="document-text-outline" size={16} color="#64748b" />
                        <Text style={styles.notesText}>{item.notes}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Lịch sử Check-in</Text>
                <Text style={styles.headerSubtitle}>Dấu chân hành trình của bạn</Text>
            </View>

            <FlatList
                data={history}
                keyExtractor={(item) => item.checkin_id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmptyComponent}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={() => fetchHistory(true)} colors={['#14b8a6']} />
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    headerTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
    headerSubtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
    listContent: { padding: 20, paddingBottom: 100, flexGrow: 1 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
    loadingText: { marginTop: 12, color: '#64748b', fontSize: 14 },
    emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, paddingHorizontal: 30 },
    card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 3 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    dateText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    statusText: { fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
    cardBody: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
    locationInfo: { flex: 1, marginLeft: 16 },
    locationTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
    locationSubtitle: { fontSize: 13, color: '#64748b' },
    notesBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 16 },
    notesText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#475569', lineHeight: 18, fontStyle: 'italic' },
});