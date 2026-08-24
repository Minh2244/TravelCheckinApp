import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

export type TicketExportTone = "active" | "muted" | "danger" | "warning";

export type TicketExportItem = {
  id: string;
  title: string;
  heading: string;
  subheading?: string | null;
  code: string;
  qrValue: string;
  statusText?: string | null;
  statusTone?: TicketExportTone;
  imageUrl?: string | null;
  details: Array<{
    label: string;
    value: string | number | null | undefined;
  }>;
};

const toneStyles: Record<TicketExportTone, { bg: string; border: string; text: string }> = {
  active: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
  muted: { bg: "#f1f5f9", border: "#e2e8f0", text: "#64748b" },
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#d97706" },
};

function displayValue(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "-";
}

export function TicketExportCard({ item }: { item: TicketExportItem }) {
  const tone = toneStyles[item.statusTone || "active"];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.logoMark}>
          <Ionicons name="ticket" size={28} color="#0f766e" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>TRAVEL CHECKIN</Text>
          <Text style={styles.title}>{item.title}</Text>
        </View>
      </View>

      <View style={styles.main}>
        <View style={styles.infoBlock}>
          <View style={styles.mediaRow}>
            <View style={styles.imageBox}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <Ionicons name="image-outline" size={34} color="#94a3b8" />
              )}
            </View>
            <View style={styles.headingBlock}>
              <Text style={styles.heading} numberOfLines={2}>
                {item.heading}
              </Text>
              {item.subheading ? (
                <Text style={styles.subheading} numberOfLines={2}>
                  {item.subheading}
                </Text>
              ) : null}
            </View>
          </View>

          {item.statusText ? (
            <View
              style={[
                styles.statusPill,
                { backgroundColor: tone.bg, borderColor: tone.border },
              ]}
            >
              <Text style={[styles.statusText, { color: tone.text }]}>{item.statusText}</Text>
            </View>
          ) : null}

          <View style={styles.detailsGrid}>
            {item.details.map((detail) => (
              <View key={`${item.id}-${detail.label}`} style={styles.detailCell}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {displayValue(detail.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.qrBlock}>
          <View style={styles.qrFrame}>
            <QRCode value={item.qrValue} size={230} ecl="H" quietZone={12} />
          </View>
          <Text style={styles.codeLabel}>MÃ VÉ</Text>
          <Text style={styles.codeText} numberOfLines={2}>
            {item.code}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Xuất từ ứng dụng Travel Checkin</Text>
        <Text style={styles.footerText}>Vui lòng đưa mã này cho nhân viên quét khi sử dụng dịch vụ.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 360,
    minHeight: 720,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#dbe8e4",
    backgroundColor: "#ffffff",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 16,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#b7eadb",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  kicker: {
    fontSize: 10,
    fontWeight: "900",
    color: "#0f766e",
    letterSpacing: 0,
  },
  title: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 0,
  },
  main: {
    marginTop: 18,
  },
  infoBlock: {
    gap: 14,
  },
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageBox: {
    width: 74,
    height: 74,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  headingBlock: {
    flex: 1,
    marginLeft: 14,
  },
  heading: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    color: "#1e293b",
    letterSpacing: 0,
  },
  subheading: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: "#0f766e",
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -5,
  },
  detailCell: {
    width: "50%",
    paddingHorizontal: 5,
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  detailValue: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: "#334155",
  },
  qrBlock: {
    marginTop: 18,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 18,
  },
  qrFrame: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#dbe8e4",
    backgroundColor: "#ffffff",
    padding: 12,
  },
  codeLabel: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: "900",
    color: "#94a3b8",
    letterSpacing: 0,
  },
  codeText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "900",
    color: "#475569",
    letterSpacing: 0,
  },
  footer: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
    gap: 4,
  },
  footerText: {
    textAlign: "center",
    fontSize: 11,
    lineHeight: 15,
    color: "#64748b",
    fontWeight: "600",
  },
});
