import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";

import { locationApi } from "../../services/location.api";
import { userApi } from "../../services/user.api";
import { showToast } from "../../modules/ui/toast-store";

export function LocationReviews({ locationId }: { locationId: string }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  const loadReviews = async () => {
    try {
      setLoading(true);
      const res = await locationApi.getReviews(locationId);
      setReviews(res.data || []);
    } catch {
      showToast("Không thể tải đánh giá");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReviews();
  }, [locationId]);

  const handleSubmit = async () => {
    if (!text.trim()) {
      showToast("Vui lòng nhập nội dung đánh giá");
      return;
    }

    try {
      setSubmitting(true);
      await userApi.createReview({
        location_id: locationId,
        rating,
        review_text: text.trim(),
      });
      showToast("Gửi đánh giá thành công");
      setText("");
      setRating(5);
      await loadReviews();
    } catch {
      showToast("Lỗi khi gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <ActivityIndicator style={{ marginTop: 20 }} color="#0f766e" />;
  }

  return (
    <View style={styles.container}>
      {/* Form viết đánh giá */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Viết đánh giá của bạn</Text>
        
        <View style={styles.ratingRow}>
          <Text style={styles.ratingText}>{rating} sao</Text>
          <Slider
            style={{ flex: 1, height: 40 }}
            minimumValue={1}
            maximumValue={5}
            step={1}
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
          multiline
          numberOfLines={3}
          value={text}
          onChangeText={setText}
        />

        <Pressable
          style={[styles.submitButton, submitting && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "Đang gửi..." : "Gửi đánh giá"}
          </Text>
        </Pressable>
      </View>

      {/* Danh sách đánh giá */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>
          Đánh giá từ cộng đồng ({reviews.length})
        </Text>
        
        {reviews.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có đánh giá nào.</Text>
        ) : (
          reviews.map((rev, idx) => (
            <View key={rev.review_id || idx} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewerName}>
                  {rev.User?.full_name || "Người dùng ẩn danh"}
                </Text>
                <View style={styles.reviewStars}>
                  <Text style={styles.reviewRatingText}>{rev.rating}</Text>
                  <Ionicons name="star" size={12} color="#eab308" />
                </View>
              </View>
              <Text style={styles.reviewDate}>
                {new Date(rev.created_at).toLocaleDateString("vi-VN")}
              </Text>
              <Text style={styles.reviewText}>{rev.review_text}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  formCard: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f766e",
    width: 48,
  },
  textInput: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: "#0f766e",
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },
  listContainer: {
    gap: 16,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    fontStyle: "italic",
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 16,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef9c3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reviewRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#854d0e",
  },
  reviewDate: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
});
