// app/leaderboard.tsx
// Man hinh bang xep hang: hien thi top 50 nguoi dung co nhieu check-in nhat

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  TextInput, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../api/axiosClient';
import { USER_API } from '../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import EmptyState from '../components/EmptyState';
import { useAuthStore } from '../store/useAuthStore';
import type { LeaderboardEntry } from '../types';

// Mau sac danh cho top 3
const RANK_COLORS = {
  1: '#f59e0b', // vang
  2: '#94a3b8', // bac
  3: '#cd7f32', // dong
} as const;

// Lay thang hien tai dinh dang YYYY-MM
const getCurrentMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export default function LeaderboardScreen() {
  const currentUser = useAuthStore((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [province, setProvince] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [meta, setMeta] = useState<{ month: string; province: string }>({ month: getCurrentMonth(), province: '' });

  // Lay du lieu bang xep hang tu API
  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params: Record<string, string> = { month };
      if (province.trim()) params.province = province.trim();

      const res = await axiosClient.get(USER_API.LEADERBOARD, { params });
      setEntries(res.data.data || []);
      setMeta(res.data.meta || { month, province: '' });
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, province]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  // Xu ly thay doi thang (lui/tien)
  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setMonth(newMonth);
  };

  // Dinh dang thang de hien thi
  const formatMonthDisplay = (value: string): string => {
    const [y, m] = value.split('-');
    return `Tháng ${parseInt(m, 10)}/${y}`;
  };

  // Kiem tra dong la nguoi dung hien tai
  const isCurrentUser = (userId: number): boolean => {
    return currentUser?.user_id === userId;
  };

  // Render hang top 3 (dang to, noi bat)
  const renderTopItem = (item: LeaderboardEntry, rank: number) => {
    const rankColor = RANK_COLORS[rank as keyof typeof RANK_COLORS];
    const isMe = isCurrentUser(item.user_id);

    return (
      <Card key={item.user_id} style={[styles.topCard, isMe && styles.currentUserCard]}>
        <View style={[styles.topRankBadge, { backgroundColor: rankColor }]}>
          <Text style={styles.topRankText}>{rank}</Text>
        </View>
        <Avatar uri={item.avatar_url} name={item.full_name} size={52} />
        <View style={styles.topInfo}>
          <Text style={[styles.topName, isMe && styles.currentUserText]} numberOfLines={1}>
            {item.full_name}
            {isMe ? ' (Bạn)' : ''}
          </Text>
          <View style={styles.checkinRow}>
            <Ionicons name="checkmark-circle" size={16} color={rankColor} />
            <Text style={[styles.checkinCount, { color: rankColor }]}>
              {item.checkin_count} check-in
            </Text>
          </View>
        </View>
      </Card>
    );
  };

  // Render hang binh thuong (tu hang 4 tro di, index bat dau tu 0 trong restEntries)
  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank = index + 4; // top 3 da render rieng, bat dau tu hang 4
    const isMe = isCurrentUser(item.user_id);

    return (
      <Card style={[styles.rowCard, isMe && styles.currentUserCard]}>
        <Text style={styles.rankNumber}>{rank}</Text>
        <Avatar uri={item.avatar_url} name={item.full_name} size={40} />
        <View style={styles.rowInfo}>
          <Text style={[styles.rowName, isMe && styles.currentUserText]} numberOfLines={1}>
            {item.full_name}
            {isMe ? ' (Bạn)' : ''}
          </Text>
        </View>
        <View style={styles.rowCheckin}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.rowCheckinCount}>{item.checkin_count}</Text>
        </View>
      </Card>
    );
  };

  // Tach top 3 ra khoi list chinh
  const top3 = entries.slice(0, 3);
  const restEntries = entries.slice(3);

  return (
    <View style={styles.container}>
      <Header title="Bảng xếp hạng" />

      {/* Bo loc: tinh/thang va thang */}
      <View style={styles.filterContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Lọc theo tỉnh/thành..."
              placeholderTextColor={colors.textMuted}
              value={province}
              onChangeText={setProvince}
              returnKeyType="search"
            />
            {province.length > 0 && (
              <TouchableOpacity onPress={() => setProvince('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => shiftMonth(-1)} style={styles.monthBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{formatMonthDisplay(month)}</Text>
          <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải bảng xếp hạng...</Text>
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => String(item.user_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchLeaderboard(true)} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            top3.length > 0 ? (
              <View style={styles.top3Container}>
                {/* Hien thi top 3 voi layout noi bat */}
                {top3.length >= 2 && renderTopItem(top3[1], 2)}
                {top3.length >= 1 && renderTopItem(top3[0], 1)}
                {top3.length >= 3 && renderTopItem(top3[2], 3)}
                <View style={styles.divider} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading && top3.length === 0 ? (
              <EmptyState
                icon="trophy-outline"
                title="Chưa có dữ liệu"
                description="Không tìm thấy ai trong bảng xếp hạng cho bộ lọc này."
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: fontSize.base,
  },
  // Bo loc
  filterContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  monthBtn: {
    padding: spacing.xs,
  },
  monthText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginHorizontal: spacing.md,
    minWidth: 120,
    textAlign: 'center',
  },
  // Top 3
  top3Container: {
    paddingTop: spacing.sm,
  },
  topCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  topRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  topRankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.surface,
  },
  topInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  topName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  checkinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  checkinCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  // Hang binh thuong
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  rankNumber: {
    width: 28,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rowInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rowName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  rowCheckin: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowCheckinCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginLeft: 4,
  },
  // Nguoi dung hien tai
  currentUserCard: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  currentUserText: {
    color: colors.primaryDark,
  },
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
});
