import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import {
  ensureTicketSavePermission,
  saveTicketImageToLibrary,
} from "../../lib/ticket-download";
import { showToast } from "../../modules/ui/toast-store";
import { TicketExportCard, type TicketExportItem } from "./TicketExportCard";

export type TicketDownloadItem = TicketExportItem & {
  pickerTitle: string;
  pickerSubtitle?: string | null;
};

const MAX_DOWNLOAD_COUNT = 20;
const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 2160;

function waitForExportLayout() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 450);
    });
  });
}

async function captureTicketRef(targetRef: View) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await captureRef(targetRef, {
        format: "png",
        result: "tmpfile",
        quality: 1,
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT,
      });
    } catch (error) {
      lastError = error;
      await waitForExportLayout();
    }
  }

  throw lastError;
}

export function TicketDownloadPicker({
  visible,
  title,
  contextLabel,
  items,
  onClose,
}: {
  visible: boolean;
  title: string;
  contextLabel?: string;
  items: TicketDownloadItem[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const captureRefs = useRef<Record<string, View | null>>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [renderItems, setRenderItems] = useState<TicketDownloadItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setRenderItems([]);
    }
  }, [visible]);

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return items.filter((item) => selectedSet.has(item.id));
  }, [items, selectedIds]);

  const allVisibleSelected =
    items.length > 0 &&
    selectedIds.length === Math.min(items.length, MAX_DOWNLOAD_COUNT);

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => {
      if (current.includes(itemId)) {
        return current.filter((id) => id !== itemId);
      }

      if (current.length >= MAX_DOWNLOAD_COUNT) {
        showToast(`Bạn chỉ có thể tải tối đa ${MAX_DOWNLOAD_COUNT} vé mỗi lần.`);
        return current;
      }

      return [...current, itemId];
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(items.slice(0, MAX_DOWNLOAD_COUNT).map((item) => item.id));
    if (items.length > MAX_DOWNLOAD_COUNT) {
      showToast(`Bạn chỉ có thể tải tối đa ${MAX_DOWNLOAD_COUNT} vé mỗi lần.`);
    }
  };

  const handleDownload = async () => {
    if (selectedItems.length === 0) {
      showToast("Vui lòng chọn ít nhất 1 vé QR.");
      return;
    }

    setSaving(true);
    try {
      const hasPermission = await ensureTicketSavePermission();
      if (!hasPermission) return;

      setRenderItems(selectedItems);
      await waitForExportLayout();

      let savedCount = 0;
      let sharedCount = 0;
      for (const item of selectedItems) {
        const targetRef = captureRefs.current[item.id];
        if (!targetRef) {
          throw new Error("Không tìm thấy khung vé để lưu.");
        }

        const uri = await captureTicketRef(targetRef);
        const result = await saveTicketImageToLibrary(uri);
        if (result === "shared") {
          sharedCount += 1;
        } else {
          savedCount += 1;
        }
      }

      showToast(
        sharedCount > 0
          ? `Đã mở chia sẻ cho ${sharedCount} vé QR.`
          : `Đã lưu ${savedCount} vé QR vào thư viện.`,
      );
      onClose();
    } catch (error) {
      console.warn("Ticket QR save failed", error);
      showToast("Không thể lưu vé QR lúc này.");
    } finally {
      setSaving(false);
      setRenderItems([]);
    }
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={saving ? undefined : onClose}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.sheet,
              {
                maxHeight: Math.min(
                  height * 0.84,
                  height - Math.max(insets.top + 88, 150),
                ),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.handle} />

            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>

              <View style={styles.headerButtons}>
                <Text onPress={saving ? undefined : onClose} style={styles.headerActionText}>
                  Đóng
                </Text>
                <Text onPress={saving ? undefined : handleDownload} style={styles.headerActionText}>
                  {saving ? "Đang tải" : "Tải vé"}
                </Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              {contextLabel || "Chọn vé QR muốn tải về điện thoại."}
            </Text>

            <View style={styles.toolbar}>
              <Pressable
                disabled={saving || items.length === 0}
                onPress={toggleAll}
                style={({ pressed }) => [
                  styles.selectAllButton,
                  pressed && !saving ? styles.pressed : null,
                  items.length === 0 ? styles.disabled : null,
                ]}
              >
                <Text style={styles.selectAllText}>
                  {allVisibleSelected ? "Bỏ chọn" : "Chọn tất cả"}
                </Text>
              </Pressable>

              <Text style={styles.counter}>
                Đã chọn {selectedIds.length}/{MAX_DOWNLOAD_COUNT}
              </Text>
            </View>

            <ScrollView
              style={[styles.list, { maxHeight: Math.max(260, height * 0.48) }]}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator
            >
              {items.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="ticket-outline" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>Không có vé QR để tải.</Text>
                </View>
              ) : (
                items.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      disabled={saving}
                      onPress={() => toggleItem(item.id)}
                      style={({ pressed }) => [
                        styles.row,
                        checked ? styles.rowChecked : null,
                        pressed && !saving ? styles.pressed : null,
                      ]}
                    >
                      <View style={[styles.checkbox, checked ? styles.checkboxChecked : null]}>
                        {checked ? <Ionicons name="checkmark" size={20} color="#ffffff" /> : null}
                      </View>

                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.pickerTitle}
                        </Text>
                        {item.pickerSubtitle ? (
                          <Text style={styles.rowSubtitle} numberOfLines={2}>
                            {item.pickerSubtitle}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View pointerEvents="none" style={styles.captureLayer}>
        {renderItems.map((item) => (
          <View
            key={`capture-${item.id}`}
            ref={(ref) => {
              captureRefs.current[item.id] = ref;
            }}
            collapsable={false}
            renderToHardwareTextureAndroid
            style={styles.captureFrame}
          >
            <TicketExportCard item={item} />
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginBottom: 14,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 10,
  },
  headerActionText: {
    minWidth: 62,
    minHeight: 38,
    flexShrink: 0,
    borderRadius: 19,
    backgroundColor: "#0f766e",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 38,
    textAlign: "center",
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    color: "#64748b",
  },
  toolbar: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectAllButton: {
    minHeight: 36,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
    paddingHorizontal: 14,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f766e",
  },
  counter: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
  },
  list: {
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 12,
    gap: 8,
  },
  row: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowChecked: {
    borderColor: "#99f6e4",
    backgroundColor: "#f0fdfa",
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxChecked: {
    borderColor: "#0f766e",
    backgroundColor: "#0f766e",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#1e293b",
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: "#64748b",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 42,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
  captureLayer: {
    position: "absolute",
    left: 8,
    top: 0,
    width: 380,
    zIndex: -10,
    elevation: -10,
  },
  captureFrame: {
    width: 360,
    minHeight: 720,
    marginBottom: 16,
    backgroundColor: "#ffffff",
  },
});
