import { Stack } from 'expo-router';
import { colors } from '../../constants/theme';

export default function SosLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
