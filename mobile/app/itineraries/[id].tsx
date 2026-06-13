import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { userApi, locationApi } from "../../api/endpoints";
import { colors, spacing, fontSize, borderRadius } from "../../constants/theme";
import type { ItineraryItem } from "../../types";

interface ItemForm {
  tempId: string;
  day_number: number;
  sort_order: number;
  location_id: number | null;
  custom_name: string;
  custom_address: string;
  time: string;
  note: string;
  estimated_cost: string;
  location_name?: string;
  visited_at?: string | null;
  item_id?: number;
}

let tempCounter = 0;
const newTempId = () => `t_${++tempCounter}`;

export default function EditItineraryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itineraryId = Number(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [items, setItems] = useState<ItemForm[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addTime, setAddTime] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addCost, setAddCost] = useState("");

  const numDays =
    startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1)
      : 0;

  const dayItems = items.filter((i) => i.day_number === activeDay);

  // Load data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await userApi.getItineraryDetail(itineraryId);
        if (!cancelled && res.success) {
          const d = res.data;
          setTitle(d.title);
          setDescription(d.description || "");
          setStartDate(d.start_date?.slice(0, 10) || "");
          setEndDate(d.end_date?.slice(0, 10) || "");
          setItems(
            (d.items || []).map((item: ItineraryItem, idx: number) => ({
              tempId: newTempId(),
              item_id: item.item_id,
              day_number: item.day_number,
              sort_order: item.sort_order ?? idx,
              location_id: item.location_id,
              custom_name: item.custom_name || "",
              custom_address: item.custom_address || "",
              time: item.time || "",
              note: item.note || "",
              estimated_cost: item.estimated_cost != null ? String(item.estimated_cost) : "",
              location_name: item.location_name || "",
              visited_at: item.visited_at,
            }))
          );
        }
      } catch (err: any) {
        if (!cancelled) Alert.alert("Lỗi", "Không thể tải lịch trình");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [itineraryId]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await locationApi.getLocations({ keyword: searchQuery.trim() });
      if (res.success) setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const addFromSystem = (loc: any) => {
    setItems((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        day_number: activeDay,
        sort_order: prev.filter((i) => i.day_number === activeDay).length,
        location_id: loc.location_id,
        custom_name: "",
        custom_address: "",
        time: addTime,
        note: addNote,
        estimated_cost: addCost,
        location_name: loc.name,
      },
    ]);
    closeModal();
  };

  const addCustom = () => {
    if (!customName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        tempId: newTempId(),
        day_number: activeDay,
        sort_order: prev.filter((i) => i.day_number === activeDay).length,
        location_id: null,
        custom_name: customName.trim(),
        custom_address: customAddress.trim(),
        time: addTime,
        note: addNote,
        estimated_cost: addCost,
      },
    ]);
    closeModal();
  };

  const closeModal = () => {
    setShowModal(false);
    setSearchQuery("");
    setSearchResults([]);
    setCustomName("");
    setCustomAddress("");
    setAddTime("");
    setAddNote("");
    setAddCost("");
  };

  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const toggleVisit = async (item: ItemForm) => {
    if (!item.item_id) return;
    try {
      const res = await userApi.toggleItemVisited(itineraryId, item.item_id);
      if (res.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.tempId === item.tempId ? { ...i, visited_at: res.data.visited_at } : i
          )
        );
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể cập nhật");
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert("Lỗi", "Tên lịch trình không được để trống"); return; }
    if (!startDate || !endDate) { Alert.alert("Lỗi", "Vui lòng chọn ngày"); return; }
    if (new Date(startDate) > new Date(endDate)) { Alert.alert("Lỗi", "Ngày kết thúc phải sau ngày bắt đầu"); return; }

    try {
      setSaving(true);
      await userApi.updateItinerary(itineraryId, {
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
        items: items.map((item, idx) => ({
          day_number: item.day_number,
          sort_order: idx,
          location_id: item.location_id,
          custom_name: item.custom_name || undefined,
          custom_address: item.custom_address || undefined,
          time: item.time || undefined,
          note: item.note || undefined,
          estimated_cost: item.estimated_cost ? Number(item.estimated_cost) : undefined,
        })),
      });
      Alert.alert("Thành công", "Đã cập nhật lịch trình");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.response?.data?.message || "Không thể lưu");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sửa lịch trình</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <Text style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {/* Form */}
          <View style={styles.section}>
            <Text style={styles.label}>Tên lịch trình *</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Mô tả</Text>
            <TextInput style={[styles.input, { height: 60 }]} value={description} onChangeText={setDescription} multiline />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ngày bắt đầu *</Text>
                <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ngày kết thúc *</Text>
                <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              </View>
            </View>
          </View>

          {/* Tabs ngày */}
          {numDays > 0 && (
            <View style={styles.section}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayTabs}>
                {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayTab, activeDay === day && styles.dayTabActive]}
                    onPress={() => setActiveDay(day)}
                  >
                    <Text style={[styles.dayTabText, activeDay === day && styles.dayTabTextActive]}>
                      Ngày {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {dayItems.length === 0 ? (
                <Text style={styles.emptyDay}>Chưa có địa điểm cho ngày {activeDay}</Text>
              ) : (
                dayItems.map((item, idx) => (
                  <View key={item.tempId} style={styles.itemCard}>
                    <Text style={styles.itemIndex}>{idx + 1}</Text>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemName}>
                        {item.location_name || item.custom_name || "Chưa có tên"}
                      </Text>
                      {item.custom_address ? <Text style={styles.itemAddr}>📍 {item.custom_address}</Text> : null}
                      <View style={styles.itemMeta}>
                        {item.time ? <Text style={styles.itemMetaText}>🕐 {item.time}</Text> : null}
                        {item.note ? <Text style={styles.itemMetaText}>📝 {item.note}</Text> : null}
                        {item.estimated_cost ? <Text style={styles.itemMetaText}>💰 {Number(item.estimated_cost).toLocaleString("vi-VN")}đ</Text> : null}
                      </View>
                    </View>
                    <View style={styles.itemActions}>
                      <TouchableOpacity onPress={() => void toggleVisit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons
                          name={item.visited_at ? "checkmark-circle" : "checkmark-circle-outline"}
                          size={22}
                          color={item.visited_at ? colors.success : colors.border}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeItem(item.tempId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={22} color="#ff4d4f" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              <TouchableOpacity style={styles.addItemBtn} onPress={() => setShowModal(true)}>
                <Ionicons name="add-circle-outline" size={20} color={colors.success} />
                <Text style={styles.addItemBtnText}>Thêm địa điểm</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Modal */}
        <Modal visible={showModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Thêm địa điểm — Ngày {activeDay}</Text>
                <TouchableOpacity onPress={closeModal}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Tìm từ hệ thống</Text>
                <View style={styles.searchRow}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={searchQuery} onChangeText={setSearchQuery} placeholder="Nhập tên..." onSubmitEditing={() => void handleSearch()} />
                  <TouchableOpacity style={styles.searchBtn} onPress={() => void handleSearch()}>
                    {searching ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={18} color="#fff" />}
                  </TouchableOpacity>
                </View>
                {searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.slice(0, 5).map((loc: any) => (
                      <TouchableOpacity key={loc.location_id} style={styles.searchResultItem} onPress={() => addFromSystem(loc)}>
                        <Text style={styles.searchResultName}>{loc.name}</Text>
                        <Text style={styles.searchResultAddr}>{loc.address} · {loc.type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <Text style={styles.divider}>— hoặc nhập tự do —</Text>
                <Text style={styles.label}>Tên địa điểm *</Text>
                <TextInput style={styles.input} value={customName} onChangeText={setCustomName} placeholder="Ví dụ: Nhà hàng ABC" />
                <Text style={styles.label}>Địa chỉ</Text>
                <TextInput style={styles.input} value={customAddress} onChangeText={setCustomAddress} placeholder="Địa chỉ" />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Giờ</Text><TextInput style={styles.input} value={addTime} onChangeText={setAddTime} placeholder="08:00" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.label}>Chi phí</Text><TextInput style={styles.input} value={addCost} onChangeText={setAddCost} placeholder="0" keyboardType="numeric" /></View>
                </View>
                <Text style={styles.label}>Ghi chú</Text>
                <TextInput style={styles.input} value={addNote} onChangeText={setAddNote} placeholder="Ghi chú" />
                <TouchableOpacity style={[styles.modalAddBtn, !customName.trim() && { opacity: 0.5 }]} onPress={addCustom} disabled={!customName.trim()}>
                  <Text style={styles.modalAddBtnText}>Thêm</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  saveBtn: { fontSize: fontSize.base, fontWeight: "600", color: colors.primary },
  body: { flex: 1 },
  section: {
    backgroundColor: colors.card, margin: spacing.lg, marginBottom: 0,
    padding: spacing.lg, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border,
  },
  label: { fontSize: fontSize.sm, fontWeight: "600", color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    fontSize: fontSize.base, color: colors.text, backgroundColor: colors.background,
  },
  row: { flexDirection: "row", gap: spacing.md },
  dayTabs: { marginBottom: spacing.md },
  dayTab: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  dayTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTabText: { fontSize: fontSize.sm, color: colors.text },
  dayTabTextActive: { color: "#fff", fontWeight: "600" },
  emptyDay: { textAlign: "center", color: colors.textSecondary, paddingVertical: spacing.xl, fontSize: fontSize.sm },
  itemCard: {
    flexDirection: "row", alignItems: "flex-start", padding: spacing.md,
    backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.sm,
  },
  itemIndex: { fontSize: fontSize.lg, fontWeight: "700", color: colors.primary, minWidth: 24 },
  itemContent: { flex: 1 },
  itemName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  itemAddr: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  itemMeta: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  itemMetaText: { fontSize: fontSize.xs, color: colors.textSecondary },
  itemActions: { gap: spacing.sm, alignItems: "center" },
  addItemBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: spacing.md, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.success, backgroundColor: "#f6ffed",
    gap: spacing.xs, marginTop: spacing.sm,
  },
  addItemBtnText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.success },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.card, borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl, padding: spacing.lg, maxHeight: "80%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.text },
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  searchBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, justifyContent: "center" },
  searchResults: { borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, marginBottom: spacing.md },
  searchResultItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchResultName: { fontSize: fontSize.base, fontWeight: "600", color: colors.text },
  searchResultAddr: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  divider: { textAlign: "center", color: colors.textSecondary, fontSize: fontSize.xs, marginVertical: spacing.md },
  modalAddBtn: {
    backgroundColor: colors.success, padding: spacing.md, borderRadius: borderRadius.md,
    alignItems: "center", marginTop: spacing.md, marginBottom: spacing.lg,
  },
  modalAddBtnText: { color: "#fff", fontSize: fontSize.base, fontWeight: "600" },
});
