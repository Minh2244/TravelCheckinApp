import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getErrorMessage } from "../../../../src/lib/error";
import { showToast } from "../../../../src/modules/ui/toast-store";
import { bookingApi } from "../../../../src/services/booking.api";
import type { BookingPaymentResult } from "../../../../src/types/booking";
import { buildVietQrImageUrl } from "../../../../src/utils/vietqr";

type SearchParams = {
  bookingId?: string;
  mode?: "table" | "ticket" | "room" | string;
  locationId?: string;
  returnTo?: string;
};

function parseQrData(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0 đ";
  return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}

export default function BookingPaymentScreen() {
  const params = useLocalSearchParams<SearchParams>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bookingId = Number(params.bookingId);
  const mode = String(params.mode || "");
  const [payment, setPayment] = useState<BookingPaymentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      setLoading(false);
      showToast("Thiếu booking để thanh toán.");
      return;
    }

    let active = true;
    setLoading(true);
    bookingApi
      .createOrGetPaymentForBooking(bookingId)
      .then((response) => {
        if (active) setPayment(response.data);
      })
      .catch((error) => {
        if (active) showToast(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookingId]);

  const qr = useMemo(() => parseQrData(payment?.qr_data), [payment?.qr_data]);
  const qrImage = useMemo(() => {
    if (!qr) return { url: null, error: null };
    return buildVietQrImageUrl({
      bankName: String(qr.bank_name || ""),
      bankAccount: String(qr.bank_account || ""),
      accountHolder: String(qr.account_holder || ""),
      amount: Number(qr.amount || payment?.amount || 0),
      addInfo: String(qr.content || qr.transaction_code || payment?.transaction_code || ""),
      template: "compact2",
    });
  }, [payment?.amount, payment?.transaction_code, qr]);

  async function handleConfirmTransfer() {
    if (!Number.isFinite(bookingId) || bookingId <= 0) return;

    setConfirming(true);
    try {
      if (mode === "ticket") {
        await bookingApi.confirmTicketTransfer(bookingId);
      } else if (mode === "room") {
        await bookingApi.confirmRoomTransfer(bookingId);
      } else {
        await bookingApi.confirmTableTransfer(bookingId);
      }

      showToast("Đã xác nhận chuyển khoản.");
      if (params.returnTo) {
        router.replace(params.returnTo as never);
        return;
      }
      if (mode === "ticket") {
        router.replace("/wallet/tickets");
        return;
      }
      if (mode === "room" || mode === "room-batch") {
        router.replace("/wallet/room-pass");
        return;
      }
      router.replace("/wallet/table-pass");
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0f766e" />
        <Text style={styles.loadingText}>Đang tải thanh toán...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>VietQR</Text>
          <Text style={styles.title}>Thanh toán chuyển khoản</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 18) + 110 },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.paymentCode}>
            Payment #{payment?.payment_id || "-"}
          </Text>
          {qrImage.url ? (
            <Image
              source={{ uri: qrImage.url }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.qrFallback}>
              <Ionicons name="qr-code-outline" size={52} color="#94a3b8" />
              <Text style={styles.qrFallbackText}>
                {qrImage.error || "Không đọc được dữ liệu VietQR."}
              </Text>
            </View>
          )}

          <View style={styles.infoList}>
            <InfoRow label="Ngân hàng" value={String(qr?.bank_name || "-")} />
            <InfoRow label="Số tài khoản" value={String(qr?.bank_account || "-")} />
            <InfoRow label="Chủ TK" value={String(qr?.account_holder || "-")} />
            <InfoRow
              label="Số tiền"
              value={formatCurrency(Number(qr?.amount || payment?.amount || 0))}
            />
            <InfoRow
              label="Nội dung"
              value={String(qr?.content || payment?.transaction_code || "-")}
            />
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Sau khi chuyển khoản</Text>
          <Text style={styles.noteText}>
            Bạn bấm xác nhận để hệ thống ghi nhận giao dịch và quay lại luồng đặt bàn.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={[styles.primaryButton, confirming && styles.disabledButton]}
          onPress={handleConfirmTransfer}
          disabled={confirming}
        >
          <Text style={styles.primaryButtonText}>
            {confirming ? "Đang xác nhận..." : "Xác nhận đã chuyển khoản"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2f3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#eef2f3",
  },
  loadingText: {
    color: "#64748b",
    fontSize: 14,
  },
  header: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
  },
  content: {
    padding: 14,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe4ea",
    padding: 16,
    alignItems: "center",
  },
  paymentCode: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "900",
    alignSelf: "flex-start",
  },
  qrImage: {
    marginTop: 14,
    width: 280,
    height: 280,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  qrFallback: {
    marginTop: 14,
    width: 280,
    height: 240,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  qrFallbackText: {
    marginTop: 10,
    color: "#64748b",
    textAlign: "center",
  },
  infoList: {
    marginTop: 16,
    width: "100%",
    gap: 10,
  },
  infoRow: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 10,
  },
  infoLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  infoValue: {
    marginTop: 3,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  noteCard: {
    backgroundColor: "#ecfdf5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#99f6e4",
    padding: 14,
  },
  noteTitle: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "900",
  },
  noteText: {
    marginTop: 5,
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  primaryButton: {
    height: 52,
    borderRadius: 8,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
});
