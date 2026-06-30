import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
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
    return <ActivityIndicator style={styles.loader} color="#0f766e" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Viết đánh giá của bạn</Text>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>{rating} sao</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={5}
            step={0.5}
            value={rating}
            onValueChange={setRating}
            minimumTrackTintColor="#0f766e"
            maximumTrackTintColor="#cbd5e1"
            thumbTintColor="#0f766e"
          />
        </View>

        <TextInput
          style={styles.textInput}
          placeholder="Chia sẻ trải nghiệm của bạn..."
          placeholderTextColor="#94a3b8"
          multiline
          value={text}
          onChangeText={setText}
        />

        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {images.map((uri, index) => (
              <View key={index} style={{ marginRight: 8 }}>
                <Image source={{ uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                <Pressable
                  style={{ position: "absolute", top: -5, right: -5, backgroundColor: "white", borderRadius: 10 }}
                  onPress={() => setImages(images.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close-circle" size={20} color="red" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

        <Pressable
          style={[styles.submitButton, { backgroundColor: "#f1f5f9", marginBottom: 12 }]}
          onPress={() => void pickImage()}
          disabled={submitting}
        >
          <Text style={[styles.submitButtonText, { color: "#475569" }]}>Thêm ảnh</Text>
        </Pressable>

        <Pressable
          style={[styles.submitButton, submitting && styles.disabled]}
          onPress={() => void handleSubmit()}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>
          Đánh giá từ cộng đồng ({reviews.length})
        </Text>

        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có đánh giá nào.</Text>
        ) : (
          reviews.map((review) => (
            <View key={review.review_id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>
                  {review.user_name || "Người dùng"}
                </Text>
                <View style={styles.reviewStars}>
                  <Text style={styles.reviewRatingText}>{review.rating}</Text>
                  <Ionicons name="star" size={12} color="#eab308" />
                </View>
              </View>
              <Text style={styles.reviewDate}>
                {new Date(review.created_at).toLocaleDateString("vi-VN")}
              </Text>
              <Text style={styles.reviewText}>
                {review.comment || (review.images ? "" : "Người dùng chưa để lại nội dung.")}
              </Text>

              {review.images ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                  {(Array.isArray(review.images) 
                    ? review.images 
                    : typeof review.images === "string" 
                      ? (() => {
                          try { return JSON.parse(review.images) as string[]; } 
                          catch { return []; }
                        })()
                      : []
                  ).map((img, idx) => (
                    <Image key={idx} source={{ uri: resolveBackendUrl(img) }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: "#e2e8f0" }} />
                  ))}
                </ScrollView>
              ) : null}

              {review.reply_content ? (
                <View style={styles.ownerReply}>
                  <Text style={styles.ownerReplyTitle}>Phản hồi từ địa điểm</Text>
                  <Text style={styles.ownerReplyText}>{review.reply_content}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    marginTop: 20,
  },
  container: {
    gap: 22,
  },
  formCard: {
    backgroundColor: "#f8fafc",
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 10,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f766e",
    width: 52,
  },
  slider: {
    flex: 1,
    height: 38,
  },
  textInput: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    padding: 11,
    fontSize: 15,
    minHeight: 86,
    textAlignVertical: "top",
    marginBottom: 12,
    color: "#0f172a",
  },
  submitButton: {
    backgroundColor: "#0f766e",
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.65,
  },
  submitButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  listContainer: {
    gap: 14,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 14,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef9c3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#854d0e",
  },
  reviewDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 7,
  },
  reviewText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },
  ownerReply: {
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: "#0f766e",
    backgroundColor: "#f0fdfa",
    padding: 10,
  },
  ownerReplyTitle: {
    color: "#0f766e",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },
  ownerReplyText: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 19,
  },
});
