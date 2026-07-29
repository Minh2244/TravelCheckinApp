import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "../../lib/booking-utils";

type VoucherStubCardProps = {
  voucher: any;
  actualQuantity?: number;
  minOrder: number;
  maxDiscount: number;
  isSelected: boolean;
  isEligible: boolean;
  onSelect: () => void;
  width?: number;
};

export function VoucherStubCard({
  voucher,
  actualQuantity,
  minOrder,
  maxDiscount,
  isSelected,
  isEligible,
  onSelect,
  width = 300,
}: VoucherStubCardProps) {
  const locName =
    voucher.location_name || (voucher.location_id ? "Địa điểm này" : "Toàn hệ thống");

  const isPercent = voucher.discount_type === "percent" || voucher.discount_type === "percentage";
  const discountLabel = isPercent
    ? `-${Number(voucher.discount_value)}%`
    : `-${(Number(voucher.discount_value) / 1000).toFixed(0)}k`;
  const maxUses = Number(voucher.max_uses_per_user);
  const used = Number(voucher.user_used_count ?? 0);
  const derivedUserRemaining =
    Number.isFinite(maxUses) && maxUses > 0
      ? Math.max(0, maxUses - (Number.isFinite(used) ? used : 0))
      : null;
  const rawRemaining =
    (voucher.user_remaining_uses != null ? Number(voucher.user_remaining_uses) : null) ??
    derivedUserRemaining ??
    (voucher.remaining != null ? Number(voucher.remaining) : null) ??
    (voucher.pool_remaining != null ? Number(voucher.pool_remaining) : null) ??
    actualQuantity;
  const remainingLabel =
    rawRemaining != null && Number.isFinite(Number(rawRemaining))
      ? `Còn ${Math.max(0, Number(rawRemaining))} lượt`
      : "Không giới hạn";

  return (
    <Pressable
      style={[
        {
          width,
          backgroundColor: "#ffffff",
          borderRadius: 16,
          flexDirection: "row",
          overflow: "hidden",
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? "#6366f1" : "#f1f5f9",
          elevation: isSelected ? 4 : 2,
          height: 140,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          opacity: isEligible ? 1 : 0.5,
          flexShrink: 0,
        }
      ]}
      onPress={onSelect}
    >
      {/* Left Violet Stub */}
      <View style={{ width: 80, backgroundColor: "#4f46e5", justifyContent: "center", alignItems: "center", padding: 8 }}>
        <View style={{ position: "absolute", top: 8, right: 8, opacity: 0.5 }}>
          <Ionicons name="sparkles" size={10} color="#c084fc" />
        </View>
        <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 20, textAlign: "center" }}>
          {discountLabel}
        </Text>
        <Text style={{ color: "#c7d2fe", fontSize: 8, fontWeight: "bold", letterSpacing: 1, marginTop: 2 }}>
          GIẢM GIÁ
        </Text>
        <View style={{ position: "absolute", bottom: 0, width: "100%", height: 24, flexDirection: "row", alignItems: "flex-end", opacity: 0.2, paddingHorizontal: 4, justifyContent: "space-between" }}>
          <View style={{ width: "12%", height: "60%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: "15%", height: "80%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: "10%", height: "40%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: "18%", height: "90%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: "14%", height: "70%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          <View style={{ width: "12%", height: "50%", backgroundColor: "#ffffff", borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
        </View>
      </View>

      {/* Perforated Separator 1 */}
      <View style={{ width: 12, alignItems: "center", justifyContent: "space-between", paddingVertical: 4, backgroundColor: "#ffffff" }}>
        <View style={{ position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" }} />
        <View style={{ height: "100%", borderLeftWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" }} />
        <View style={{ position: "absolute", bottom: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" }} />
      </View>

      {/* Middle Info Block */}
      <View style={{ flex: 1, padding: 12, paddingLeft: 6, backgroundColor: "#ffffff", justifyContent: "space-between" }}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <View style={{ backgroundColor: "#e0e7ff", borderColor: "#c7d2fe", borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
              <Text style={{ fontSize: 8, fontWeight: "900", color: "#4338ca" }}>
                MÃ GIẢM GIÁ
              </Text>
            </View>
            <View style={{ backgroundColor: "#ffe4e6", borderColor: "#fecdd3", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Ionicons name="time-outline" size={8} color="#e11d48" />
              <Text style={{ fontSize: 8, fontWeight: "bold", color: "#e11d48" }}>
                {remainingLabel}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 13, fontWeight: "800", color: "#1e293b" }} numberOfLines={1}>
            {voucher.campaign_name || "Voucher đặc biệt"} 🎉
          </Text>
          {voucher.campaign_description ? (
            <Text style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }} numberOfLines={1}>
              {voucher.campaign_description}
            </Text>
          ) : null}
        </View>

        <View style={{ backgroundColor: "#f8fafc", borderColor: "#f1f5f9", borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}>
          <Ionicons name="card-outline" size={10} color="#6366f1" />
          <Text style={{ fontSize: 9, fontWeight: "600", color: "#475569" }}>
            Đơn tối thiểu: {minOrder > 0 ? formatCurrency(minOrder) : "0đ"}
          </Text>
        </View>
      </View>

      {/* Perforated Separator 2 */}
      <View style={{ width: 12, alignItems: "center", justifyContent: "space-between", paddingVertical: 4, backgroundColor: "#ffffff" }}>
        <View style={{ position: "absolute", top: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" }} />
        <View style={{ height: "100%", borderLeftWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" }} />
        <View style={{ position: "absolute", bottom: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: "#e2e8f0" }} />
      </View>

      {/* Right Metadata Block */}
      <View style={{ width: 90, padding: 8, backgroundColor: "#f8fafc", justifyContent: "space-between", borderLeftWidth: 1, borderColor: "transparent" }}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
            <Ionicons name="calendar-outline" size={9} color="#6366f1" style={{ marginTop: 2 }} />
            <View>
              <Text style={{ fontSize: 8, fontWeight: "bold", color: "#94a3b8" }}>NSD</Text>
              <Text style={{ fontSize: 9, fontWeight: "600", color: "#475569", marginTop: 2 }}>
                {voucher.start_date ? new Date(voucher.start_date).toLocaleDateString("vi-VN") : "-"}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
            <Ionicons name="calendar-outline" size={9} color="#6366f1" style={{ marginTop: 2 }} />
            <View>
              <Text style={{ fontSize: 8, fontWeight: "bold", color: "#94a3b8" }}>HSD</Text>
              <Text style={{ fontSize: 9, fontWeight: "600", color: "#475569", marginTop: 2 }}>
                {voucher.end_date ? new Date(voucher.end_date).toLocaleDateString("vi-VN") : "-"}
              </Text>
            </View>
          </View>
        </View>
        
        {isSelected && (
          <View style={{ position: "absolute", top: 0, right: 0, backgroundColor: "#6366f1", borderBottomLeftRadius: 12, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Ionicons name="checkmark" size={12} color="#ffffff" />
          </View>
        )}
      </View>
    </Pressable>
  );
}
