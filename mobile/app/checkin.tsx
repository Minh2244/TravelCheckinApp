// app/checkin.tsx
// Man hinh check-in voi GPS, tim dia diem gan, gioi han tan suat va canh bao ban dem

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import Button from '../components/Button';
import Card from '../components/Card';
import Badge from '../components/Badge';
import LoadingOverlay from '../components/LoadingOverlay';
import axiosClient from '../api/axiosClient';
import { LOCATIONS_API, USER_API } from '../api/endpoints';
import useLocationPermission from '../hooks/useLocationPermission';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import type { Location, ApiResponse } from '../types';

// Gioi han ban kinh tim kiem dia diem gan (met)
const NEARBY_RADIUS_METERS = 80;

// Thoi gian toi thieu giua 2 lan check-in (giay)
const RATE_LIMIT_SECONDS = 30;

// Gioi han toa do Viet Nam
const VN_LAT_MIN = 8;
const VN_LAT_MAX = 23.5;
const VN_LNG_MIN = 102;
const VN_LNG_MAX = 110.5;

// Tinh khoang cach giua 2 diem tren mat trai dat (haversine, don vi: met)
const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Kiem tra toa do co nam trong lanh tho Viet Nam khong
const isWithinVietnam = (lat: number, lng: number): boolean => {
  return lat >= VN_LAT_MIN && lat <= VN_LAT_MAX && lng >= VN_LNG_MIN && lng <= VN_LNG_MAX;
};

// Kiem tra co phai khoang thoi gian nguy hiem (22:00 - 05:00) khong
const isNightTime = (): boolean => {
  const hour = new Date().getHours();
  return hour >= 22 || hour < 5;
};

// Kiem tra thoi gian gioi han tan suat
const getRemainingCooldown = (lastCheckinTime: string | null): number => {
  if (!lastCheckinTime) return 0;
  const elapsed = (Date.now() - new Date(lastCheckinTime).getTime()) / 1000;
  const remaining = RATE_LIMIT_SECONDS - elapsed;
  return remaining > 0 ? Math.ceil(remaining) : 0;
};

interface NearbyLocation extends Location {
  distance: number;
}

export default function CheckinScreen() {
  const { location, errorMsg, loading: locationLoading, requestLocation } = useLocationPermission();

  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckinTime, setLastCheckinTime] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lay danh sach tat ca dia diem tu API
  const fetchLocations = useCallback(async () => {
    try {
      setLoadingLocations(true);
      const res = await axiosClient.get<ApiResponse<Location[]>>(LOCATIONS_API.LIST);
      if (res.data.success && res.data.data) {
        setLocations(res.data.data);
      }
    } catch {
      // Khong hien loi vi day khong phai chuc nang chinh
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Dem nguoc thoi gian gioi han tan suat
  useEffect(() => {
    if (cooldownSeconds > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, [cooldownSeconds]);

  // Loc dia diem gan trong ban kinh 80m
  const nearbyLocations = useMemo<NearbyLocation[]>(() => {
    if (!location) return [];

    return locations
      .map((loc) => ({
        ...loc,
        distance: haversineDistance(location.latitude, location.longitude, loc.latitude, loc.longitude),
      }))
      .filter((loc) => loc.distance <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.distance - b.distance);
  }, [location, locations]);

  // Dia diem gan nhat (dung cho check-in tu dong)
  const nearestLocation = nearbyLocations.length > 0 ? nearbyLocations[0] : null;

  // Lam moi vi tri GPS
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await requestLocation();
    await fetchLocations();
    setRefreshing(false);
  }, [requestLocation, fetchLocations]);

  // Kiem tra dieu kien truoc khi check-in
  const validateBeforeCheckin = useCallback((): boolean => {
    if (!location) {
      Alert.alert('Loi', 'Chua xac dinh duoc vi tri. Vui long cho GPS hoan tat.');
      return false;
    }

    if (!isWithinVietnam(location.latitude, location.longitude)) {
      Alert.alert('Loi', 'Vi tri hien tai nam ngoai lanh tho Viet Nam.');
      return false;
    }

    if (cooldownSeconds > 0) {
      Alert.alert('Gioi han tan suat', `Vui long doi ${cooldownSeconds} giay nua truoc khi check-in tiep.`);
      return false;
    }

    return true;
  }, [location, cooldownSeconds]);

  // Gui yeu cau check-in len server
  const submitCheckin = useCallback(
    async (action: 'checkin' | 'save') => {
      if (!validateBeforeCheckin()) return;

      // Canh bao ban dem khi check-in
      if (action === 'checkin' && isNightTime()) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Canh bao an toan',
            'Hien tai la khoang thoi gian ban dem (22:00 - 05:00). Ban co chac chan muon check-in?',
            [
              { text: 'Huy', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Tiep tuc', onPress: () => resolve(true) },
            ]
          );
        });
        if (!confirmed) return;
      }

      try {
        setSubmitting(true);

        const payload: {
          location_id?: number;
          checkin_latitude: number;
          checkin_longitude: number;
          action: 'checkin' | 'save';
        } = {
          checkin_latitude: location!.latitude,
          checkin_longitude: location!.longitude,
          action,
        };

        // Gan location_id neu tim thay dia diem gan
        if (nearestLocation) {
          payload.location_id = nearestLocation.location_id;
        }

        const res = await axiosClient.post<ApiResponse<{ checkin_id?: number }>>(USER_API.CHECKINS, payload);

        if (res.data.success) {
          const now = new Date().toISOString();
          setLastCheckinTime(now);
          setCooldownSeconds(RATE_LIMIT_SECONDS);

          const actionLabel = action === 'checkin' ? 'Check-in' : 'Luu vi tri';
          const locationLabel = nearestLocation
            ? ` tai "${nearestLocation.location_name}"`
            : ' (he thong se tao vi tri moi)';

          Alert.alert('Thanh cong', `${actionLabel}${locationLabel} thanh cong!`);
        }
      } catch (err: unknown) {
        const responseData = (err as { response?: { data?: { message?: string } } })?.response?.data;
        const message = responseData?.message || 'Co loi xay ra. Vui long thu lai.';
        Alert.alert('That bai', message);
      } finally {
        setSubmitting(false);
      }
    },
    [location, nearestLocation, validateBeforeCheckin]
  );

  // Render trang thai GPS
  const renderGpsStatus = () => {
    if (locationLoading) {
      return (
        <View style={styles.gpsCard}>
          <Ionicons name="location-outline" size={20} color={colors.info} />
          <Text style={styles.gpsText}>Dang xac dinh vi tri...</Text>
        </View>
      );
    }

    if (errorMsg) {
      return (
        <View style={[styles.gpsCard, styles.gpsError]}>
          <Ionicons name="location-outline" size={20} color={colors.error} />
          <Text style={[styles.gpsText, styles.gpsTextError]}>{errorMsg}</Text>
        </View>
      );
    }

    if (location) {
      return (
        <View style={[styles.gpsCard, styles.gpsSuccess]}>
          <Ionicons name="location" size={20} color={colors.success} />
          <Text style={[styles.gpsText, styles.gpsTextSuccess]}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        </View>
      );
    }

    return null;
  };

  // Render canh bao ban dem
  const renderNightWarning = () => {
    if (!isNightTime()) return null;

    return (
      <View style={styles.nightWarning}>
        <Ionicons name="moon" size={18} color={colors.warning} />
        <Text style={styles.nightWarningText}>
          Hien tai la khoang thoi gian ban dem (22:00 - 05:00). Hay chu y an toan khi di chuyen.
        </Text>
      </View>
    );
  };

  // Render danh sach dia diem gan
  const renderNearbyLocations = () => {
    if (!location || loadingLocations) return null;

    if (nearbyLocations.length === 0) {
      return (
        <Card style={styles.nearbyCard}>
          <View style={styles.nearbyEmpty}>
            <Ionicons name="map-outline" size={32} color={colors.textMuted} />
            <Text style={styles.nearbyEmptyText}>Khong co dia diem nao gan day</Text>
            <Text style={styles.nearbyEmptySubtext}>
              Ban co the "Luu vi tri" de tao dia diem moi
            </Text>
          </View>
        </Card>
      );
    }

    return (
      <View style={styles.nearbySection}>
        <Text style={styles.sectionTitle}>Dia diem gan day</Text>
        {nearbyLocations.map((loc) => (
          <Card key={loc.location_id} style={styles.nearbyCard}>
            <View style={styles.nearbyRow}>
              <View style={styles.nearbyInfo}>
                <Text style={styles.nearbyName} numberOfLines={1}>
                  {loc.location_name}
                </Text>
                {loc.address && (
                  <Text style={styles.nearbyAddress} numberOfLines={1}>
                    {loc.address}
                  </Text>
                )}
              </View>
              <Badge
                text={`${Math.round(loc.distance)}m`}
                variant={loc.distance <= 30 ? 'success' : 'info'}
              />
            </View>
          </Card>
        ))}
      </View>
    );
  };

  // Render dem nguoc gioi han tan suat
  const renderCooldown = () => {
    if (cooldownSeconds <= 0) return null;

    return (
      <View style={styles.cooldownBox}>
        <Ionicons name="time-outline" size={16} color={colors.warning} />
        <Text style={styles.cooldownText}>
          Co the check-in tiep sau {cooldownSeconds} giay
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Check-in" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Canh bao ban dem */}
        {renderNightWarning()}

        {/* Trang thai GPS */}
        {renderGpsStatus()}

        {/* Dia diem gan */}
        {renderNearbyLocations()}

        {/* Dem nguoc gioi han */}
        {renderCooldown()}

        {/* Nut hanh dong */}
        <View style={styles.actions}>
          <Button
            title="Check-in"
            onPress={() => submitCheckin('checkin')}
            variant="primary"
            icon="checkmark-circle"
            loading={submitting}
            disabled={!location || cooldownSeconds > 0}
            style={styles.actionButton}
          />
          <Button
            title="Luu vi tri"
            onPress={() => submitCheckin('save')}
            variant="outline"
            icon="bookmark-outline"
            loading={submitting}
            disabled={!location || cooldownSeconds > 0}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      <LoadingOverlay visible={submitting} message="Dang xu ly..." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  // Canh bao ban dem
  nightWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  nightWarningText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: '#92400e',
    lineHeight: 20,
  },
  // GPS
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  gpsError: {
    backgroundColor: colors.errorLight,
  },
  gpsSuccess: {
    backgroundColor: colors.successLight,
  },
  gpsText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.info,
    flex: 1,
  },
  gpsTextError: {
    color: colors.error,
  },
  gpsTextSuccess: {
    color: colors.success,
  },
  // Dia diem gan
  nearbySection: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  nearbyCard: {
    marginBottom: spacing.sm,
  },
  nearbyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nearbyInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nearbyName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  nearbyAddress: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nearbyEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  nearbyEmptyText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  nearbyEmptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Dem nguoc
  cooldownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cooldownText: {
    fontSize: fontSize.sm,
    color: '#92400e',
    fontWeight: fontWeight.medium,
  },
  // Nut hanh dong
  actions: {
    gap: spacing.sm,
  },
  actionButton: {
    borderRadius: radius.md,
  },
});
