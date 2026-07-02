import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
  ScrollView,
} from "react-native";

import * as ImagePicker from "expo-image-picker";

import { env } from "../../lib/env";
import { showToast } from "../../modules/ui/toast-store";
import { locationApi } from "../../services/location.api";
import { userApi } from "../../services/user.api";
import type { LocationReview } from "../../types/location";

const resolveBackendUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${env.apiOrigin}${url.startsWith("/") ? "" : "/"}${url}`;
};

type ReviewFilter = "all" | "positive" | "neutral" | "negative";

const FILTER_OPTIONS: { key: ReviewFilter; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "positive", label: "Tích cực" },
  { key: "neutral", label: "Trung bình" },
  { key: "negative", label: "Tiêu cực" },
];

function filterReviews(reviews: LocationReview[], filter: ReviewFilter) {
  if (filter === "all") return reviews;
  if (filter === "positive") return reviews.filter((r) => Number(r.rating) >= 4);
  if (filter === "neutral")
    return reviews.filter((r) => Number(r.rating) >= 2.5 && Number(r.rating) <= 3.5);
  if (filter === "negative") return reviews.filter((r) => Number(r.rating) < 2.5);
  return reviews;
}

function StarRating({
  rating,
  onRate,
}: {
  rating: number;
  onRate: (v: number) => void;
}) {
  const handleRate = (starIndex: number) => {
    if (rating === starIndex - 0.5) {
      onRate(starIndex);
    } else {
      onRate(starIndex - 0.5);
    }
  };

  return (
    <View className="flex-row gap-2 items-center justify-center my-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable key={star} onPress={() => handleRate(star)} hitSlop={8}>
          <Ionicons
            name={rating >= star ? "star" : rating >= star - 0.5 ? "star-half" : "star-outline"}
            size={36}
            color={rating >= star - 0.5 ? "#eab308" : "#d1d5db"}
          />
        </Pressable>
      ))}
    </View>
  );
}

export function LocationReviews({
  locationId,
  onSubmitted,
}: {
  locationId: string;
  onSubmitted?: () => void;
}) {
  const [reviews, setReviews] = useState<LocationReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const response = await locationApi.getReviews(locationId);
      setReviews(response.data || []);
    } catch {
      showToast("Không thể tải đánh giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [locationId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((a) => a.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, 5));
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && images.length === 0) {
      showToast("Vui lòng nhập nội dung đánh giá hoặc thêm ảnh");
      return;
    }

    try {
      setSubmitting(true);

      const uploadedImages: string[] = [];
      for (const uri of images) {
        try {
          const res = await userApi.uploadReviewImage(uri);
          if (res.success && res.data?.image_url) {
            uploadedImages.push(res.data.image_url);
          }
        } catch (err) {
          console.error("Failed to upload image", err);
        }
      }

      await userApi.createReview({
        location_id: locationId,
        rating,
        comment: text.trim(),
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
      });
      setText("");
      setRating(5);
      setImages([]);
      await loadReviews();
      onSubmitted?.();
      showToast("Gửi đánh giá thành công");
    } catch {
      showToast("Không thể gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 20 }} color="#0f766e" />;
  }

  const filteredReviews = filterReviews(reviews, reviewFilter);
  const currentFilterLabel = FILTER_OPTIONS.find((f) => f.key === reviewFilter)?.label ?? "Tất cả";

  return (
    <View className="gap-6">
      {/* === Form viết đánh giá === */}
      <View className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <Text className="text-base font-bold text-slate-900 mb-3">Viết đánh giá của bạn</Text>

        {/* 5 sao */}
        <StarRating rating={rating} onRate={setRating} />

        {/* Textarea */}
        <TextInput
          className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-[15px] text-slate-800 mt-3 mb-3 min-h-[88px]"
          placeholder="Chia sẻ trải nghiệm của bạn..."
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
          value={text}
          onChangeText={setText}
        />

        {/* Preview ảnh đã chọn */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {images.map((uri, index) => (
              <View key={index} className="mr-2 relative">
                <Image
                  source={{ uri }}
                  className="w-[68px] h-[68px] rounded-xl border border-slate-200"
                />
                <Pressable
                  className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow-sm"
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Nút Thêm ảnh */}
        <Pressable
          className="flex-row items-center justify-center gap-2 bg-white border border-dashed border-slate-300 rounded-xl py-2.5 mb-3 active:bg-slate-50"
          onPress={() => void pickImage()}
          disabled={submitting || images.length >= 5}
        >
          <Ionicons name="image-outline" size={18} color="#64748b" />
          <Text className="text-sm font-semibold text-slate-500">
            {images.length >= 5 ? "Tối đa 5 ảnh" : `Thêm ảnh (${images.length}/5)`}
          </Text>
        </Pressable>

        {/* Nút Gửi */}
        <Pressable
          className={`bg-brand-700 rounded-xl py-3 items-center justify-center ${submitting ? "opacity-60" : "active:bg-brand-800"}`}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          <Text className="text-white font-bold text-[15px]">
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </Text>
        </Pressable>
      </View>

      {/* === Danh sách đánh giá === */}
      <View className="gap-4">
        {/* Tiêu đề + bộ lọc */}
        <View className="flex-row items-center justify-between">
          <Text className="text-[17px] font-bold text-slate-900">
            Đánh giá từ cộng đồng{" "}
            <Text className="text-slate-400 font-medium">({reviews.length})</Text>
          </Text>

          {/* Dropdown filter */}
          <View className="relative">
            <Pressable
              onPress={() => setShowFilterDropdown((v) => !v)}
              className="flex-row items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5 active:bg-slate-50"
            >
              <Text className="text-xs font-semibold text-slate-600">{currentFilterLabel}</Text>
              <Ionicons
                name={showFilterDropdown ? "chevron-up" : "chevron-down"}
                size={12}
                color="#64748b"
              />
            </Pressable>

            {/* Dropdown options */}
            {showFilterDropdown && (
              <View
                className="absolute right-0 top-9 bg-white border border-slate-200 rounded-xl shadow-lg z-50 min-w-[140px]"
                style={{ elevation: 8 }}
              >
                {FILTER_OPTIONS.map((opt, idx) => (
                  <Pressable
                    key={opt.key}
                    onPress={() => {
                      setReviewFilter(opt.key);
                      setShowFilterDropdown(false);
                    }}
                    className={`px-4 py-2.5 flex-row items-center justify-between ${
                      idx < FILTER_OPTIONS.length - 1 ? "border-b border-slate-100" : ""
                    } active:bg-slate-50`}
                  >
                    <Text
                      className={`text-sm ${
                        reviewFilter === opt.key
                          ? "font-bold text-brand-700"
                          : "font-medium text-slate-600"
                      }`}
                    >
                      {opt.label}
                    </Text>
                    {reviewFilter === opt.key && (
                      <Ionicons name="checkmark" size={14} color="#0f766e" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Sub-label của filter */}
        {reviewFilter !== "all" && (
          <Text className="text-xs text-slate-400 -mt-2">
            {reviewFilter === "positive" && "Hiển thị đánh giá từ 4 – 5 ⭐"}
            {reviewFilter === "neutral" && "Hiển thị đánh giá từ 2.5 – 3.5 ⭐"}
            {reviewFilter === "negative" && "Hiển thị đánh giá dưới 2.5 ⭐"}
          </Text>
        )}

        {filteredReviews.length === 0 ? (
          <View className="bg-white border border-slate-100 rounded-xl p-6 items-center">
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#cbd5e1" />
            <Text className="text-sm font-semibold text-slate-400 mt-2">
              {reviews.length === 0 ? "Chưa có đánh giá nào." : "Không có đánh giá nào khớp bộ lọc."}
            </Text>
          </View>
        ) : (
          filteredReviews.map((review) => (
            <View
              key={review.review_id}
              className="bg-white border border-slate-100 rounded-xl p-4"
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-[15px] font-bold text-slate-700">
                  {review.user_name || "Người dùng"}
                </Text>
                <View className="flex-row items-center gap-1 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-md">
                  <Text className="text-[12px] font-bold text-amber-700">{review.rating}</Text>
                  <Ionicons name="star" size={11} color="#eab308" />
                </View>
              </View>

              <Text className="text-[11px] text-slate-400 mb-2">
                {new Date(review.created_at).toLocaleDateString("vi-VN")}
              </Text>

              {review.comment ? (
                <Text className="text-sm text-slate-600 leading-[21px] mb-2">{review.comment}</Text>
              ) : null}

              {review.images ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                  {(Array.isArray(review.images)
                    ? review.images
                    : typeof review.images === "string"
                    ? (() => {
                        try {
                          return JSON.parse(review.images) as string[];
                        } catch {
                          return [];
                        }
                      })()
                    : []
                  ).map((img, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: resolveBackendUrl(img) }}
                      className="w-[80px] h-[80px] rounded-xl border border-slate-100 mr-2"
                    />
                  ))}
                </ScrollView>
              ) : null}

              {review.reply_content ? (
                <View className="mt-2 border-l-4 border-brand-600 bg-teal-50 rounded-r-xl px-3 py-2">
                  <Text className="text-xs font-bold text-brand-700 mb-1">Phản hồi từ địa điểm</Text>
                  <Text className="text-sm text-slate-600 leading-[19px]">{review.reply_content}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
