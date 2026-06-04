// app/(tabs)/profile.tsx
// Man hinh ca nhan: avatar, thong ke, menu dieu huong, lich su dang nhap

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, FlatList, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import { USER_API, AUTH_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import axiosClient from '../../api/axiosClient';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import type { UserProfile, LoginHistory } from '../../types';

// Dinh nghia 1 muc trong menu
interface MenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

// Danh sach menu dieu huong
const MENU_ITEMS: MenuItem[] = [
  { key: 'saved', label: 'Dia diem da luu', icon: 'bookmark-outline', route: '/saved-locations' },
  { key: 'vouchers', label: 'Voucher', icon: 'ticket-outline', route: '/vouchers' },
  { key: 'diary', label: 'Nhat ky', icon: 'journal-outline', route: '/diary' },
  { key: 'leaderboard', label: 'Bang xep hang', icon: 'trophy-outline', route: '/leaderboard' },
  { key: 'notifications', label: 'Thong bao', icon: 'notifications-outline', route: '/notifications' },
  { key: 'ai-chat', label: 'Chat AI', icon: 'chatbubble-ellipses-outline', route: '/ai-chat' },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ checkins: 0, saved: 0, vouchers: 0 });
  const [history, setHistory] = useState<LoginHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Lay thong tin profile, thong ke va lich su dang nhap
  const fetchData = useCallback(async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      if (!token) return;

      const [profileRes, checkinsRes, favoritesRes, vouchersRes, historyRes] = await Promise.all([
        axiosClient.get<{ data: UserProfile }>(USER_API.PROFILE),
        axiosClient.get(USER_API.CHECKINS),
        axiosClient.get(USER_API.FAVORITES),
        axiosClient.get(USER_API.VOUCHERS_SAVED),
        axiosClient.get(`${USER_API.LOGIN_HISTORY}?limit=5`),
      ]);

      setProfile(profileRes.data.data);
      setStats({
        checkins: checkinsRes.data.data?.length || 0,
        saved: favoritesRes.data.data?.length || 0,
        vouchers: vouchersRes.data.data?.length || 0,
      });
      setHistory(historyRes.data.data || []);
    } catch {
      // Loi da xu ly o interceptor, khong can log
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dang xuat: goi API roi xoa local state
  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await axiosClient.post(AUTH_API.LOGOUT);
    } catch {
      // Bo qua: van dang xuat local du server loi
    } finally {
      logout();
      router.replace('/login' as never);
    }
  }, [logout]);

  // Xu ly avatar URL tu backend
  const getAvatarUrl = useCallback((url: string | null | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http')) return url;
    const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || '';
    return `${baseUrl}${url}`;
  }, []);

  // Render header: avatar, ten, email
  const renderHeader = () => (
    <View style={styles.profileHeader}>
      <Avatar
        uri={getAvatarUrl(user?.avatar_url)}
        name={user?.full_name}
        size={80}
      />
      <View style={styles.profileInfo}>
        <Text style={styles.profileName} numberOfLines={1}>
          {user?.full_name || 'Nguoi dung'}
        </Text>
        <Text style={styles.profileEmail} numberOfLines={1}>
          {user?.email || user?.phone || ''}
        </Text>
        {profile?.stats?.member_tier && (
          <View style={styles.tierBadge}>
            <Text style={styles.tierText}>{profile.stats.member_tier}</Text>
          </View>
        )}
      </View>
    </View>
  );

  // Render hang thong ke: check-in, da luu, uu dai
  const renderStats = () => (
    <Card style={styles.statsCard}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.checkins}</Text>
          <Text style={styles.statLabel}>Check-in</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.saved}</Text>
          <Text style={styles.statLabel}>Da luu</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.vouchers}</Text>
          <Text style={styles.statLabel}>Uu dai</Text>
        </View>
      </View>
    </Card>
  );

  // Render danh sach menu
  const renderMenu = () => (
    <Card style={styles.menuCard}>
      {MENU_ITEMS.map((item, index) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.menuItem, index < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
          onPress={() => router.push(item.route as never)}
          activeOpacity={0.6}
        >
          <View style={styles.menuLeft}>
            <View style={styles.menuIconWrap}>
              <Ionicons name={item.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      ))}
    </Card>
  );

  // Render lich su dang nhap
  const renderLoginHistory = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Lich su dang nhap</Text>
      {history.length > 0 ? (
        <Card style={styles.historyCard}>
          {history.map((item, index) => (
            <View
              key={item.id}
              style={[styles.historyRow, index < history.length - 1 && styles.historyRowBorder]}
            >
              <Ionicons
                name={item.success ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={item.success ? colors.success : colors.error}
              />
              <View style={styles.historyInfo}>
                <Text style={styles.historyIp}>{item.ip_address}</Text>
                <Text style={styles.historyTime}>
                  {new Date(item.created_at).toLocaleString('vi-VN')}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Text style={styles.emptyHistoryText}>Chua co lich su dang nhap</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderStats()}
        {renderMenu()}
        {renderLoginHistory()}

        {/* Nut dang xuat */}
        <Button
          title="Dang xuat"
          onPress={handleLogout}
          variant="danger"
          icon="log-out-outline"
          loading={loggingOut}
          style={styles.logoutButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },

  // Header profile
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tierBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  tierText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },

  // Thong ke
  statsCard: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // Menu
  menuCard: {
    marginBottom: spacing.md,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  menuLabel: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },

  // Lich su dang nhap
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  historyCard: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  historyRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  historyInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  historyIp: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  historyTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyHistoryText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Dang xuat
  logoutButton: {
    marginTop: spacing.sm,
  },
});
