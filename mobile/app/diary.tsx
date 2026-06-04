// app/diary.tsx
// Man hinh nhat ky du lịch: them/sua/xoa bai viet voi mood, hinh anh, ghi chu

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  Modal, TextInput, TouchableOpacity, ScrollView, Image,
  Alert, ActivityIndicator, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import dayjs from 'dayjs';
import axiosClient from '../api/axiosClient';
import { USER_API } from '../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Button from '../components/Button';
import type { DiaryEntry } from '../types';

// Dinh nghia mood voi icon va mau sac tuong ung
interface MoodOption {
  key: DiaryEntry['mood'];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
}

const MOOD_OPTIONS: MoodOption[] = [
  { key: 'happy', icon: 'happy', label: 'Vui', color: '#eab308' },
  { key: 'excited', icon: 'flash', label: 'Thu vi', color: '#f97316' },
  { key: 'neutral', icon: 'remove-circle', label: 'Binh thuong', color: '#94a3b8' },
  { key: 'sad', icon: 'sad', label: 'Buon', color: '#3b82f6' },
  { key: 'angry', icon: 'flame', label: 'Gian du', color: '#ef4444' },
  { key: 'tired', icon: 'bed', label: 'Met moi', color: '#a855f7' },
];

// Lay thong tin mood theo key
const getMoodInfo = (mood: DiaryEntry['mood']): MoodOption => {
  return MOOD_OPTIONS.find((m) => m.key === mood) || MOOD_OPTIONS[2]; // mac dinh neutral
};

export default function DiaryScreen() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Trang thai form them moi
  const [selectedMood, setSelectedMood] = useState<DiaryEntry['mood']>('happy');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<string[]>([]);

  // Lay danh sach nhat ky
  const fetchEntries = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      const res = await axiosClient.get(USER_API.DIARY);
      setEntries(res.data.data || []);
    } catch {
      // Giu trang thai cu khi loi
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Reset form ve trang thai mac dinh
  const resetForm = () => {
    setSelectedMood('happy');
    setNotes('');
    setImages([]);
  };

  // Mo form them moi
  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  // Chon hinh anh tu thu vien (nhieu anh)
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Thong bao', 'Can cap quyen truy cap thu vien anh de su dung tinh nang nay.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 9,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newImages = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, 9));
    }
  };

  // Xoa anh khoi danh sach chon
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Gui nhat ky moi len server
  const handleSave = async () => {
    if (!notes.trim() && images.length === 0) {
      Alert.alert('Thong bao', 'Vui long nhap ghi chu hoac chon it nhat mot hinh anh.');
      return;
    }

    setSaving(true);
    try {
      await axiosClient.post(USER_API.DIARY, {
        mood: selectedMood,
        notes: notes.trim() || null,
        images: images.length > 0 ? images : undefined,
      });
      setModalVisible(false);
      resetForm();
      fetchEntries();
    } catch {
      Alert.alert('Loi', 'Khong the luu nhat ky. Vui long thu lai.');
    } finally {
      setSaving(false);
    }
  };

  // Xac nhan xoa nhat ky
  const confirmDelete = (entry: DiaryEntry) => {
    Alert.alert(
      'Xoa nhat ky',
      'Ban co chac chan muoa xoa bai viet nay?',
      [
        { text: 'Huy', style: 'cancel' },
        {
          text: 'Xoa',
          style: 'destructive',
          onPress: () => handleDelete(entry.diary_id),
        },
      ]
    );
  };

  // Xoa nhat ky
  const handleDelete = async (id: number) => {
    try {
      await axiosClient.delete(USER_API.DIARY_DELETE(id));
      setEntries((prev) => prev.filter((e) => e.diary_id !== id));
    } catch {
      Alert.alert('Loi', 'Khong the xoa nhat ky. Vui long thu lai.');
    }
  };

  // Render tung muc nhat ky
  const renderItem = ({ item }: { item: DiaryEntry }) => {
    const moodInfo = getMoodInfo(item.mood);

    return (
      <Pressable onLongPress={() => confirmDelete(item)} delayLongPress={500}>
        <Card style={styles.card}>
          {/* Hang dau: mood + ngay */}
          <View style={styles.entryHeader}>
            <View style={styles.moodRow}>
              <View style={[styles.moodCircle, { backgroundColor: moodInfo.color + '20' }]}>
                <Ionicons name={moodInfo.icon} size={20} color={moodInfo.color} />
              </View>
              <Text style={[styles.moodLabel, { color: moodInfo.color }]}>{moodInfo.label}</Text>
            </View>
            <Text style={styles.dateText}>
              {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
            </Text>
          </View>

          {/* Noi dung ghi chu */}
          {item.notes ? (
            <Text style={styles.notesText}>{item.notes}</Text>
          ) : null}

          {/* Ten dia diem */}
          {item.location_name ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>{item.location_name}</Text>
            </View>
          ) : null}

          {/* Hinh anh */}
          {item.images && item.images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageScroll}
              contentContainerStyle={styles.imageScrollContent}
            >
              {item.images.map((uri, index) => (
                <Image
                  key={`${item.diary_id}-img-${index}`}
                  source={{ uri }}
                  style={styles.entryImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : null}
        </Card>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Nhat ky du lich" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Dang tai...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.diary_id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchEntries(true)} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              title="Chua co nhat ky nao"
              description="Hay ghi lai nhung ky niem tuyet voi trong chuyen di cua ban."
              actionLabel="Viet nhat ky"
              onAction={openAddModal}
            />
          }
        />
      )}

      {/* Nut them moi noi bat */}
      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={openAddModal} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Modal them nhat ky moi */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Tieu de modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Viet nhat ky</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Chon mood */}
              <Text style={styles.fieldLabel}>Tam trang cua ban</Text>
              <View style={styles.moodSelector}>
                {MOOD_OPTIONS.map((mood) => (
                  <TouchableOpacity
                    key={mood.key}
                    style={[
                      styles.moodBtn,
                      selectedMood === mood.key && { backgroundColor: mood.color + '20', borderColor: mood.color },
                    ]}
                    onPress={() => setSelectedMood(mood.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={mood.icon}
                      size={22}
                      color={selectedMood === mood.key ? mood.color : colors.textMuted}
                    />
                    <Text
                      style={[
                        styles.moodBtnLabel,
                        selectedMood === mood.key && { color: mood.color },
                      ]}
                    >
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Ghi chu */}
              <Text style={styles.fieldLabel}>Ghi chu</Text>
              <TextInput
                style={styles.textInput}
                multiline
                numberOfLines={4}
                placeholder="Ban dang nghi gi..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                textAlignVertical="top"
              />

              {/* Chon hinh anh */}
              <Text style={styles.fieldLabel}>Hinh anh</Text>
              <View style={styles.imageSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {images.map((uri, index) => (
                    <View key={`picked-${index}`} style={styles.pickedImageWrap}>
                      <Image source={{ uri }} style={styles.pickedImage} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons name="close-circle" size={22} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < 9 && (
                    <TouchableOpacity style={styles.addImageBtn} onPress={pickImages} activeOpacity={0.7}>
                      <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                      <Text style={styles.addImageLabel}>Them anh</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </ScrollView>

            {/* Nut luu */}
            <Button
              title="Luu"
              onPress={handleSave}
              loading={saving}
              icon="checkmark"
              style={styles.saveBtn}
            />
          </View>
        </View>
      </Modal>
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
  list: {
    padding: spacing.md,
    paddingBottom: 100,
  },
  card: {
    marginBottom: spacing.sm,
  },
  // Phan header cua tung entry
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  moodRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moodCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  dateText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  notesText: {
    fontSize: fontSize.base,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginLeft: 4,
    flex: 1,
  },
  imageScroll: {
    marginTop: 4,
  },
  imageScrollContent: {
    gap: spacing.sm,
  },
  entryImage: {
    width: 120,
    height: 90,
    borderRadius: radius.sm,
  },
  // Nut FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Mood selector
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  moodBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 50,
  },
  moodBtnLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 4,
  },
  // Text input
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.base,
    color: colors.text,
    minHeight: 100,
    marginBottom: spacing.lg,
  },
  // Hinh anh
  imageSection: {
    marginBottom: spacing.lg,
  },
  pickedImageWrap: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  pickedImage: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: 11,
  },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  saveBtn: {
    marginTop: spacing.sm,
  },
});
