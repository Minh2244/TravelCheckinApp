import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize, spacing } from '../../constants/theme';

export default function BookingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>📅 Đặt chỗ</Text>
      <Text style={styles.sub}>Sẽ code ở Giai đoạn 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  text: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  sub: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm },
});
