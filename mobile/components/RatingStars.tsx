// components/RatingStars.tsx
// Hien thi / chon danh gia sao (1-5, buoc 0.5)

import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

interface RatingStarsProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
}

export default function RatingStars({ rating, size = 20, interactive = false, onChange }: RatingStarsProps) {
  const stars = [1, 2, 3, 4, 5];

  const handlePress = (value: number) => {
    if (interactive && onChange) {
      // Nhan lai lan nua de giam 0.5 sao
      onChange(value === rating ? value - 0.5 : value);
    }
  };

  return (
    <View style={styles.container}>
      {stars.map((value) => {
        const iconName =
          rating >= value ? 'star' : rating >= value - 0.5 ? 'star-half' : 'star-outline';

        return interactive ? (
          <TouchableOpacity key={value} onPress={() => handlePress(value)}>
            <Ionicons name={iconName} size={size} color={colors.warning} />
          </TouchableOpacity>
        ) : (
          <Ionicons key={value} name={iconName} size={size} color={colors.warning} />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
  },
});
