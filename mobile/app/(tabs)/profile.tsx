import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';

interface ProfileStats {
    checkinsCount: number;
    savedCount: number;
    vouchersCount: number;
}

interface LoginHistory {
    id: string;
    ip_address: string;
    created_at: string;
    success: boolean;
}

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { user, logout } = useAuthStore();
    const [stats, setStats] = useState<ProfileStats>({ checkinsCount: 0, savedCount: 0, vouchersCount: 0 });
    const [history, setHistory] = useState<LoginHistory[]>([]);

    const resolveBackendUrl = (url: string | null | undefined) => {
        if (!url) return 'https://via.placeholder.com/150';
        if (url.startsWith('http')) return url;
        const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';
        return `${baseUrl}${url}`;
    };

    useEffect(() => {
        const token = useAuthStore.getState().accessToken;
        if (!token) return;

        const fetchProfileData = async () => {
            try {
                const [checkinsRes, favoritesRes, vouchersRes, historyRes] = await Promise.all([
                    axiosClient.get('/user/checkins'),
                    axiosClient.get('/user/favorites'),
                    axiosClient.get('/user/vouchers/saved'),
                    axiosClient.get('/user/profile/login-history?limit=5'),
                ]);
                setStats({
                    checkinsCount: checkinsRes.data.data?.length || 0,
                    savedCount: favoritesRes.data.data?.length || 0,
                    vouchersCount: vouchersRes.data.data?.length || 0,
                });
                setHistory(historyRes.data.data || []);
            } catch (err) {
                console.log('Fetch profile failed', err);
            }
        };
        fetchProfileData();
    }, []);

    const handleLogout = async () => {
        try {
            await axiosClient.post('/auth/logout');
        } catch (e) {
            // Ignored: Force logout locally regardless of server state
        } finally {
            logout();
            router.replace('/login' as any);
        }
    };

    const SECTIONS = [
        {
            title: 'Thống kê',
            data: [{ type: 'stats' }],
        },
        {
            title: 'Lịch sử đăng nhập',
            data: history.length > 0 ? history.map(h => ({ type: 'history', ...h })) : [{ type: 'empty' }],
        }
    ];

    const renderItem = ({ item }: any) => {
        if (item.type === 'stats') {
            return (
                <View style={styles.statsContainer}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.checkinsCount}</Text>
                        <Text style={styles.statLabel}>Check-in</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.savedCount}</Text>
                        <Text style={styles.statLabel}>Đã lưu</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{stats.vouchersCount}</Text>
                        <Text style={styles.statLabel}>Ưu đãi</Text>
                    </View>
                </View>
            );
        }

        if (item.type === 'history') {
            return (
                <View style={styles.historyRow}>
                    <Ionicons name={item.success ? "checkmark-circle" : "close-circle"} size={20} color={item.success ? "#10b981" : "#ef4444"} />
                    <View style={styles.historyDetails}>
                        <Text style={styles.historyIp}>{item.ip_address}</Text>
                        <Text style={styles.historyTime}>{new Date(item.created_at).toLocaleString('vi-VN')}</Text>
                    </View>
                </View>
            );
        }

        return <Text style={styles.emptyText}>Chưa có dữ liệu</Text>;
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Image source={{ uri: resolveBackendUrl(user?.avatar_url) }} style={styles.avatar} />
                <View style={styles.headerText}>
                    <Text style={styles.name}>{user?.full_name}</Text>
                    <Text style={styles.email}>{user?.email || user?.phone}</Text>
                </View>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                </TouchableOpacity>
            </View>

            <SectionList
                sections={SECTIONS}
                keyExtractor={(item: any, index) => item.id?.toString() || index.toString()}
                renderItem={renderItem}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={styles.sectionTitle}>{title}</Text>
                )}
                contentContainerStyle={styles.listContent}
                stickySectionHeadersEnabled={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },
    headerText: {
        flex: 1,
        marginLeft: 16,
    },
    name: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    email: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    logoutButton: {
        padding: 8,
        backgroundColor: '#fee2e2',
        borderRadius: 12,
    },
    listContent: {
        padding: 20,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
        marginTop: 24,
        marginBottom: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statBox: {
        flex: 1,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 16,
        alignItems: 'center',
        marginHorizontal: 4,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#14b8a6',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },
    historyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    historyDetails: {
        marginLeft: 12,
    },
    historyIp: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#334155',
    },
    historyTime: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 2,
    },
    emptyText: {
        fontSize: 14,
        color: '#94a3b8',
        fontStyle: 'italic',
    }
});