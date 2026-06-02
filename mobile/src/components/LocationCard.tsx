// Card hiển thị địa điểm
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, FONTS } from '../utils/constants';
import type { Location } from '../types';

interface LocationCardProps {
  location: Location;
  onPress: () => void;
  isFavorite?: boolean;
}

export default function LocationCard({
  location,
  onPress,
  isFavorite = false,
}: LocationCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {location.first_image ? (
        <Image source={{ uri: location.first_image }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imageFallback]}>
          <Ionicons name="image-outline" size={32} color={COLORS.textLight} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {location.location_name}
        </Text>
        <Text style={styles.address} numberOfLines={1}>
          {location.address}
        </Text>
        <View style={styles.meta}>
          <View style={styles.rating}>
            <Ionicons name="star" size={14} color={COLORS.secondary} />
            <Text style={styles.ratingText}>
              {location.rating > 0 ? location.rating.toFixed(1) : 'Mới'}
            </Text>
          </View>
          {isFavorite && (
            <Ionicons name="heart" size={14} color={COLORS.error} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radius,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
  },
  imageFallback: {
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: SIZES.md,
  },
  name: {
    fontSize: FONTS.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  address: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: FONTS.xs,
    color: COLORS.textSecondary,
  },
});
