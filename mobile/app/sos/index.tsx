// app/sos/index.tsx
// Man hinh SOS khan cap - gui tin hieu SOS voi toa do GPS va goi canh sat 113

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Header from '../../components/Header';
import Button from '../../components/Button';
import axiosClient from '../../api/axiosClient';
import { SOS_API } from '../../api/endpoints';
import useLocationPermission from '../../hooks/useLocationPermission';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';

// Kieu phan hoi tu API SOS
interface SosResponse {
  success: boolean;
  alert_id?: number;
  message?: string;
}

export default function SosScreen() {
  const { location, errorMsg, loading: locationLoading } = useLocationPermission();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Gui tin hieu SOS kem toa do hien tai
  const executeSos = useCallback(async () => {
    if (!location) return;

    try {
      setSending(true);
      const response = await axiosClient.post<SosResponse>(SOS_API.CREATE, {
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (response.data.success) {
        setSent(true);
        Alert.alert(
          'Da gui SOS thanh cong',
          `Tin hieu khan cap da duoc gui. Ma su co: #${response.data.alert_id ?? 'N/A'}. Ban quan ly se lien he voi ban som nhat.`,
          [{ text: 'Da hieu', onPress: () => router.back() }]
        );
      }
    } catch (err: unknown) {
      // Khong dung `any` - xu ly loi theo kieu an toan
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Khong the gui tin hieu SOS. Vui long thu goi dien truc tiep.';
      Alert.alert('Gui that bai', message);
    } finally {
      setSending(false);
    }
  }, [location]);

  // Hien dialog xac nhan truoc khi gui SOS
  const handlePressSos = useCallback(() => {
    if (!location) {
      Alert.alert('Loi', 'Chua xac dinh duoc vi tri. Vui long cho GPS hoan tat.');
      return;
    }

    Alert.alert(
      'Xac nhan khan cap',
      'Ban co chac chan muon gui tin hieu SOS kem toa do hien tai den he thong?',
      [
        { text: 'Huy', style: 'cancel' },
        { text: 'Gui SOS', style: 'destructive', onPress: executeSos },
      ]
    );
  }, [location, executeSos]);

  // Mo dialer goi canh sat 113
  const handleCallPolice = useCallback(() => {
    const phoneUrl = Platform.OS === 'ios' ? 'telprompt:113' : 'tel:113';
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('Loi', 'Thiet bi khong ho tro goi dien truc tiep.');
    });
  }, []);

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

  return (
    <View style={styles.container}>
      <Header title="SOS Khan cap" />

      <View style={styles.body}>
        {/* Canh bao */}
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={28} color={colors.error} />
          <Text style={styles.warningTitle}>CANH BAO</Text>
          <Text style={styles.warningText}>
            Chi su dung tinh nang nay khi ban dang trong tinh huong thuc su nguy hiem hoac can ho tro y te khan cap.
          </Text>
        </View>

        {/* Trang thai GPS */}
        {renderGpsStatus()}

        {/* Nut SOS lon */}
        <TouchableOpacity
          style={[styles.sosButton, (sending || sent) && styles.sosButtonDisabled]}
          onPress={handlePressSos}
          disabled={sending || sent}
          activeOpacity={0.8}
        >
          <Ionicons name="alert-circle" size={56} color="#fff" />
          <Text style={styles.sosButtonText}>PHAT TIN HIEU SOS</Text>
        </TouchableOpacity>

        {/* Nut goi canh sat */}
        <Button
          title="Goi Canh sat (113)"
          onPress={handleCallPolice}
          variant="secondary"
          icon="call"
          style={styles.callButton}
        />

        {/* Nut quay lai */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backText}>Quay lai</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  // Canh bao
  warningBox: {
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  warningTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: fontSize.sm,
    color: '#991b1b',
    textAlign: 'center',
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
    marginBottom: spacing.xl,
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
  },
  gpsTextError: {
    color: colors.error,
  },
  gpsTextSuccess: {
    color: colors.success,
  },
  // Nut SOS
  sosButton: {
    width: 200,
    height: 200,
    backgroundColor: colors.error,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 6,
    borderColor: '#fca5a5',
    elevation: 10,
    shadowColor: colors.error,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  sosButtonDisabled: {
    opacity: 0.6,
  },
  sosButtonText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    marginTop: spacing.sm,
    letterSpacing: 1,
  },
  // Nut goi
  callButton: {
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  // Quay lai
  backLink: {
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
