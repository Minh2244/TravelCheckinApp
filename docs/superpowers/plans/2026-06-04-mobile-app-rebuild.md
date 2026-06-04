# Mobile App Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the TravelCheckin mobile app (user/tourist role) from scratch with clean architecture, shared components, and correct API integration — keeping only the auth screens.

**Architecture:** Hybrid approach — retain working auth screens (login, register, forgot-password), build a new foundation layer (theme, shared components, improved API client with token refresh), then rebuild all other screens from scratch using the new foundation.

**Tech Stack:** Expo SDK 54, React Native 0.81.5, Expo Router 6, Zustand 5, Axios, react-native-maps, react-native-qrcode-svg

---

## File Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout (modify — register new screens)
│   ├── login.tsx                # KEEP as-is
│   ├── register.tsx             # KEEP as-is
│   ├── forgot-password.tsx      # KEEP as-is
│   ├── (tabs)/
│   │   ├── _layout.tsx          # Tab bar (modify — use theme colors)
│   │   ├── index.tsx            # Home Dashboard (rewrite)
│   │   ├── map.tsx              # Map (rewrite)
│   │   ├── tickets.tsx          # Tickets (rewrite)
│   │   ├── profile.tsx          # Profile (rewrite)
│   │   └── history.tsx          # Check-in History (rewrite)
│   ├── location/[id].tsx        # Location Detail (rewrite)
│   ├── booking/[serviceId].tsx  # Booking Form (rewrite)
│   ├── checkin.tsx              # NEW — Check-in screen
│   ├── saved-locations.tsx      # Rewrite
│   ├── vouchers.tsx             # Rewrite
│   ├── booking-reminders.tsx    # Rewrite
│   ├── notifications.tsx        # NEW
│   ├── diary.tsx                # NEW
│   ├── leaderboard.tsx          # NEW
│   ├── ai-chat.tsx              # NEW
│   └── sos/
│       ├── _layout.tsx          # Keep
│       └── index.tsx            # Rewrite
├── api/
│   ├── axiosClient.ts           # Rewrite — token refresh, remove console.log
│   └── endpoints.ts             # NEW — API endpoint constants
├── components/
│   ├── Button.tsx               # NEW
│   ├── Card.tsx                 # NEW
│   ├── Header.tsx               # NEW
│   ├── Input.tsx                # NEW
│   ├── EmptyState.tsx           # NEW
│   ├── LoadingOverlay.tsx       # NEW
│   ├── Badge.tsx                # NEW
│   ├── Avatar.tsx               # NEW
│   ├── SegmentedControl.tsx     # NEW
│   ├── RatingStars.tsx          # NEW
│   └── SessionRevokedModal.tsx  # NEW — extracted from tabs layout
├── constants/
│   └── theme.ts                 # NEW — colors, spacing, typography, radius
├── hooks/
│   └── useLocationPermission.ts # NEW — GPS permission hook
├── store/
│   └── useAuthStore.ts          # Modify — add refreshAccessToken
├── types/
│   └── index.ts                 # NEW — all TypeScript interfaces
└── utils/
    ├── vietqr.ts                # Keep as-is
    └── openingHours.ts          # Keep as-is
```

**Delete after rebuild:**
- `components/EditScreenInfo.tsx`
- `components/StyledText.tsx`
- `components/Themed.tsx`
- `components/ExternalLink.tsx`
- `components/useColorScheme.ts`
- `components/useColorScheme.web.ts`
- `components/useClientOnlyValue.ts`
- `components/useClientOnlyValue.web.ts`
- `constants/Colors.ts`
- `app/modal.tsx`

---

## Phase 0: Foundation

### Task 1: Theme Constants

**Files:**
- Create: `mobile/constants/theme.ts`

- [ ] **Step 1: Create the theme file**

```ts
// constants/theme.ts
// Tap trung tat ca mau sac, font, spacing de toan bo app dung chung

export const colors = {
  primary: '#14b8a6',
  primaryDark: '#0d9488',
  primaryLight: '#ccfbf1',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  error: '#ef4444',
  errorLight: '#fef2f2',
  success: '#22c55e',
  successLight: '#f0fdf4',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  info: '#3b82f6',
  infoLight: '#eff6ff',
  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};
```

- [ ] **Step 2: Commit**

```bash
cd mobile
git add constants/theme.ts
git commit -m "feat(mobile): add centralized theme constants"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `mobile/types/index.ts`

- [ ] **Step 1: Create types file with all interfaces matching backend schema**

```ts
// types/index.ts
// Dinh nghia tat ca kieu du lieu dung chung, phu hop voi DB schema

export interface User {
  user_id: number;
  email: string;
  phone: string | null;
  full_name: string;
  role: 'user' | 'owner' | 'employee' | 'admin';
  avatar_url: string | null;
  background_url?: string | null;
  address?: string | null;
  username?: string | null;
  is_verified: number;
  status?: string;
}

export interface UserStats {
  total_orders: number;
  total_spending: number;
  latest_order_date: string | null;
  favorite_location: string | null;
  member_tier: string;
  checkin_count: number;
}

export interface UserProfile extends User {
  stats: UserStats;
}

export interface Location {
  location_id: number;
  location_name: string;
  location_type: string;
  description: string | null;
  address: string | null;
  province: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  first_image: string | null;
  images: string[] | null;
  owner_id: number | null;
  owner_name?: string | null;
  owner_avatar?: string | null;
  avg_rating?: number;
  total_reviews?: number;
  is_user_created?: number;
  status?: string;
}

export interface Service {
  service_id: number;
  location_id: number;
  service_name: string;
  service_type: 'ticket' | 'table' | 'room' | 'food' | 'combo' | 'other';
  price: number;
  quantity: number | null;
  description: string | null;
  category: string | null;
  image_url: string | null;
  status: string;
}

export interface Booking {
  booking_id: number;
  location_id: number;
  location_name?: string;
  service_id: number | null;
  service_name?: string;
  service_type?: string;
  user_id: number;
  check_in_date: string;
  check_out_date: string | null;
  quantity: number;
  total_amount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'expired';
  payment_status: 'pending' | 'paid' | 'refunded' | 'failed';
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  voucher_code: string | null;
  source: string;
  created_at: string;
  secure_code?: string | null;
}

export interface Ticket {
  ticket_id: number;
  ticket_code: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  service_name: string;
  service_price: number;
  booking_id: number;
  use_date: string | null;
  location_name: string;
  location_id?: number;
  payment_status: string;
}

export interface TablePass {
  booking_id: number;
  secure_code: string;
  status: string;
  payment_status: string;
  check_in_date: string;
  contact_name: string | null;
  contact_phone: string | null;
  location_name: string;
  location_id?: number;
  table_names?: string;
  preorder_items?: string;
}

export interface RoomPass {
  booking_id: number;
  secure_code: string;
  status: string;
  payment_status: string;
  check_in_date: string;
  check_out_date: string;
  quantity: number;
  location_name: string;
  location_id?: number;
  room_names?: string;
  total_amount: number;
}

export interface Payment {
  payment_id: number;
  booking_id: number;
  amount: number;
  payment_method: string;
  status: string;
  bank_name: string | null;
  bank_account: string | null;
  account_holder: string | null;
  transaction_content: string | null;
  created_at: string;
}

export interface Review {
  review_id: number;
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  location_id: number;
  rating: number;
  comment: string | null;
  images: string[] | null;
  created_at: string;
  owner_reply?: string | null;
  owner_reply_at?: string | null;
}

export interface Voucher {
  voucher_id: number;
  voucher_code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order: number;
  max_discount: number | null;
  start_date: string;
  end_date: string;
  location_id: number | null;
  location_name?: string | null;
  apply_to_service_type: string | null;
  is_claimed?: boolean;
}

export interface Checkin {
  checkin_id: number;
  checkin_time: string;
  status: 'verified' | 'pending' | 'failed';
  location_id: number | null;
  location_name: string;
  address: string | null;
  first_image: string | null;
  is_user_created: number;
}

export interface DiaryEntry {
  diary_id: number;
  user_id: number;
  location_id: number | null;
  location_name: string | null;
  mood: 'happy' | 'excited' | 'neutral' | 'sad' | 'angry' | 'tired' | null;
  notes: string | null;
  images: string[] | null;
  created_at: string;
}

export interface Notification {
  notification_id: number;
  title: string;
  body: string;
  created_at: string;
  is_read: number;
}

export interface LeaderboardEntry {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  checkin_count: number;
}

export interface BookingReminder {
  booking_id: number;
  check_in_date: string;
  check_out_date: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: string;
  service_name: string;
  service_type: string;
  location_name: string;
  location_id: number;
  reminder_sent: number;
}

export interface LoginHistory {
  id: number;
  ip_address: string;
  user_agent: string | null;
  success: number;
  created_at: string;
}

export interface FavoriteLocation {
  location_id: number;
  location_name: string;
  address: string | null;
  first_image: string | null;
  avg_rating: number;
  note: string | null;
  tags: string | null;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat(mobile): add TypeScript interfaces matching backend schema"
```

---

### Task 3: Shared Components — Button, Card, Input

**Files:**
- Create: `mobile/components/Button.tsx`
- Create: `mobile/components/Card.tsx`
- Create: `mobile/components/Input.tsx`

- [ ] **Step 1: Create Button component**

```tsx
// components/Button.tsx
// Nut bam chung cho toan bo app, ho tro 4 variant va trang thai loading

import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing, fontWeight } from '../constants/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
  fullWidth = true,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle[] = [
    styles.base,
    styles[variant],
    isDisabled && styles.disabled,
    fullWidth && styles.fullWidth,
    style as ViewStyle,
  ].filter(Boolean) as ViewStyle[];

  const textColor = variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary;

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} disabled={isDisabled} activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={textColor} style={{ marginRight: spacing.sm }} />}
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    minHeight: 48,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.error },
  disabled: { opacity: 0.5 },
  fullWidth: { width: '100%' },
  text: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
```

- [ ] **Step 2: Create Card component**

```tsx
// components/Card.tsx
// The thong tin chung, co bong va bo goc

import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function Card({ children, onPress, style }: CardProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </Container>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
});
```

- [ ] **Step 3: Create Input component**

```tsx
// components/Input.tsx
// Input chung voi label, error message, va icon

import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, radius, spacing, fontWeight } from '../constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export default function Input({
  label,
  error,
  leftIcon,
  isPassword,
  style,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.container, error ? styles.containerError : null]}>
        {leftIcon && (
          <Ionicons name={leftIcon} size={20} color={colors.textMuted} style={styles.icon} />
        )}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  containerError: { borderColor: colors.error },
  icon: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add components/Button.tsx components/Card.tsx components/Input.tsx
git commit -m "feat(mobile): add Button, Card, Input shared components"
```

---

### Task 4: Shared Components — EmptyState, LoadingOverlay, Badge, Avatar

**Files:**
- Create: `mobile/components/EmptyState.tsx`
- Create: `mobile/components/LoadingOverlay.tsx`
- Create: `mobile/components/Badge.tsx`
- Create: `mobile/components/Avatar.tsx`

- [ ] **Step 1: Create EmptyState**

```tsx
// components/EmptyState.tsx
// Hien thi khi khong co du lieu, co icon, tieu de va nut hanh dong

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, spacing, fontWeight } from '../constants/theme';
import Button from './Button';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={64} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {description && <Text style={styles.description}>{description}</Text>}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="primary" style={{ marginTop: spacing.lg }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },
});
```

- [ ] **Step 2: Create LoadingOverlay**

```tsx
// components/LoadingOverlay.tsx
// Man hinh loading toan man voi thong bao

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { colors, fontSize, spacing, fontWeight } from '../constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 150,
  },
  message: {
    fontSize: fontSize.base,
    color: colors.text,
    fontWeight: fontWeight.medium,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
```

- [ ] **Step 3: Create Badge**

```tsx
// components/Badge.tsx
// Nhan trang thai (success/warning/error/info)

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fontSize, spacing, fontWeight, radius } from '../constants/theme';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'muted';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: colors.successLight, text: colors.success },
  warning: { bg: colors.warningLight, text: colors.warning },
  error: { bg: colors.errorLight, text: colors.error },
  info: { bg: colors.infoLight, text: colors.info },
  muted: { bg: colors.surfaceAlt, text: colors.textSecondary },
};

export default function Badge({ text, variant = 'info', style }: BadgeProps) {
  const vc = VARIANT_COLORS[variant];

  return (
    <View style={[styles.badge, { backgroundColor: vc.bg }, style]}>
      <Text style={[styles.text, { color: vc.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
```

- [ ] **Step 4: Create Avatar**

```tsx
// components/Avatar.tsx
// Hien thi anh dai dien voi fallback chu cai dau

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors, fontWeight } from '../constants/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export default function Avatar({ uri, name, size = 40, style }: AvatarProps) {
  const initial = (name || '?').charAt(0).toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: colors.primaryDark,
    fontWeight: fontWeight.bold,
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add components/EmptyState.tsx components/LoadingOverlay.tsx components/Badge.tsx components/Avatar.tsx
git commit -m "feat(mobile): add EmptyState, LoadingOverlay, Badge, Avatar components"
```

---

### Task 5: Shared Components — SegmentedControl, RatingStars, Header, SessionRevokedModal

**Files:**
- Create: `mobile/components/SegmentedControl.tsx`
- Create: `mobile/components/RatingStars.tsx`
- Create: `mobile/components/Header.tsx`
- Create: `mobile/components/SessionRevokedModal.tsx`

- [ ] **Step 1: Create SegmentedControl**

```tsx
// components/SegmentedControl.tsx
// Tab chuyen doi (dung trong Tickets, Location Detail)

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, fontSize, radius, spacing, fontWeight } from '../constants/theme';

interface SegmentedControlProps {
  options: string[];
  selected: number;
  onChange: (index: number) => void;
}

export default function SegmentedControl({ options, selected, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {options.map((option, index) => (
        <TouchableOpacity
          key={option}
          style={[styles.option, selected === index && styles.selected]}
          onPress={() => onChange(index)}
          activeOpacity={0.7}
        >
          <Text style={[styles.label, selected === index && styles.selectedLabel]}>
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 3,
  },
  option: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  selected: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  selectedLabel: {
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
});
```

- [ ] **Step 2: Create RatingStars**

```tsx
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
```

- [ ] **Step 3: Create Header**

```tsx
// components/Header.tsx
// Thanh tieu de co nut back va action phai

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fontSize, spacing, fontWeight } from '../constants/theme';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  transparent?: boolean;
}

export default function Header({ title, showBack = true, rightIcon, onRightPress, transparent }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }, transparent && styles.transparent]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <View style={styles.row}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {rightIcon ? (
          <TouchableOpacity onPress={onRightPress} style={styles.backBtn}>
            <Ionicons name={rightIcon} size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  transparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    textAlign: 'center',
  },
});
```

- [ ] **Step 4: Create SessionRevokedModal**

```tsx
// components/SessionRevokedModal.tsx
// Modal canh bao khi bi dang nhap o thiet bi khac

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { colors, fontSize, spacing, radius, fontWeight } from '../constants/theme';

export default function SessionRevokedModal() {
  const { isSessionRevoked, logout, setSessionRevoked } = useAuthStore();

  const handleForceLogout = () => {
    setSessionRevoked(false);
    logout();
    router.replace('/login' as any);
  };

  return (
    <Modal visible={isSessionRevoked} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Ionicons name="warning-outline" size={48} color={colors.error} />
          <Text style={styles.title}>Phiên đăng nhập hết hạn</Text>
          <Text style={styles.body}>
            Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.
            Vui lòng đăng nhập lại để tiếp tục sử dụng dịch vụ.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleForceLogout}>
            <Text style={styles.buttonText}>Đăng nhập lại</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  content: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
});
```

- [ ] **Step 5: Commit**

```bash
git add components/SegmentedControl.tsx components/RatingStars.tsx components/Header.tsx components/SessionRevokedModal.tsx
git commit -m "feat(mobile): add SegmentedControl, RatingStars, Header, SessionRevokedModal components"
```

---

### Task 6: API Endpoints Constants + Improved Axios Client

**Files:**
- Create: `mobile/api/endpoints.ts`
- Rewrite: `mobile/api/axiosClient.ts`

- [ ] **Step 1: Create endpoints constants**

```ts
// api/endpoints.ts
// Tap trung tat ca API endpoint de tranh hardcode rai rac

export const AUTH_API = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  VERIFY_OTP: '/auth/verify-otp',
  FORGOT_PASSWORD: '/auth/forgot-password',
  VERIFY_RESET_OTP: '/auth/verify-reset-otp',
  RESET_PASSWORD: '/auth/reset-password',
  REFRESH_TOKEN: '/auth/refresh-token',
  LOGOUT: '/auth/logout',
  GOOGLE_MOBILE: '/auth/google/mobile',
  FACEBOOK_MOBILE: '/auth/facebook/mobile',
} as const;

export const USER_API = {
  PROFILE: '/user/profile',
  PROFILE_AVATAR: '/user/profile/avatar',
  PROFILE_BACKGROUND: '/user/profile/background',
  LOGIN_HISTORY: '/user/profile/login-history',
  CHECKINS: '/user/checkins',
  CHECKINS_PHOTO: '/user/checkins/photo',
  FAVORITES: '/user/favorites',
  RECOMMENDATIONS: '/user/recommendations/locations',
  REVIEWS: '/user/reviews',
  REVIEWS_UPLOAD: '/user/reviews/upload',
  VOUCHERS_LOCATION: (id: number) => `/user/vouchers/location/${id}`,
  VOUCHERS_SAVED: '/user/vouchers/saved',
  VOUCHERS_CLAIM: (id: number) => `/user/vouchers/${id}/claim`,
  DIARY: '/user/diary',
  DIARY_DELETE: (id: number) => `/user/diary/${id}`,
  TICKETS: '/user/tickets',
  NOTIFICATIONS: '/user/notifications',
  NOTIFICATIONS_READ_ALL: '/user/notifications/read-all',
  NOTIFICATIONS_DELETE_ALL: '/user/notifications/delete-all',
  BOOKING_REMINDERS: '/user/booking-reminders',
  LEADERBOARD: '/user/leaderboard',
} as const;

export const LOCATIONS_API = {
  LIST: '/locations',
  SEARCH: '/locations/search',
  DETAIL: (id: number) => `/locations/${id}`,
  SERVICES: (id: number) => `/locations/${id}/services`,
  REVIEWS: (id: number) => `/locations/${id}/reviews`,
  TABLE_AREAS: (id: number) => `/locations/${id}/pos/areas`,
  TABLES: (id: number) => `/locations/${id}/pos/tables`,
  TICKET_STOCK: (id: number) => `/locations/${id}/tickets/realtime-stock`,
} as const;

export const BOOKINGS_API = {
  CREATE: '/bookings',
  BATCH: '/bookings/batch',
  PAYMENT: (id: number) => `/bookings/${id}/payments`,
  CONFIRM_TICKETS: (id: number) => `/bookings/${id}/tickets/confirm-transfer`,
  CONFIRM_TABLES: (id: number) => `/bookings/${id}/tables/confirm-transfer`,
  CONFIRM_ROOMS: (id: number) => `/bookings/${id}/rooms/confirm-transfer`,
  CANCEL: (id: number) => `/bookings/${id}/cancel`,
  CANCEL_TABLES: (id: number) => `/bookings/${id}/tables/cancel`,
  PREORDER: (id: number) => `/bookings/${id}/tables/preorder`,
  TABLE_RESERVATIONS_PASS: '/bookings/table-reservations/pass',
  ROOM_RESERVATIONS_PASS: '/bookings/room-reservations/pass',
  TABLE_RESERVATIONS_MINE: '/bookings/table-reservations/mine',
  BATCH_PAYMENTS: '/bookings/batch/payments',
  BATCH_CONFIRM_ROOMS: '/bookings/batch/rooms/confirm-transfer',
  BATCH_CONTACT: '/bookings/batch/contact',
} as const;

export const SOS_API = {
  CREATE: '/sos',
  PING: '/sos/ping',
  STOP: '/sos/stop',
} as const;
```

- [ ] **Step 2: Rewrite axiosClient with token refresh**

```ts
// api/axiosClient.ts
// Axios client voi token refresh tu dong, xu ly session revoked va account locked

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';
import { AUTH_API } from './endpoints';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Flag de tranh refresh token chong chong
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor: gan token vao header
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: xu ly 401 voi token refresh, session revoked, account locked
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const errorCode = (error.response?.data as Record<string, unknown>)?.code;

    // Session bi revoke do dang nhap thiet bi khac
    if (errorCode === 'SESSION_REVOKED') {
      useAuthStore.getState().setSessionRevoked(true);
      return Promise.reject(error);
    }

    // Tai khoan bi khoa
    if (errorCode === 'ACCOUNT_LOCKED') {
      useAuthStore.getState().logout();
      router.replace('/login' as any);
      return Promise.reject(error);
    }

    // 401 — thu refresh token neu chua retry
    if (status === 401 && !originalRequest._retry) {
      const refreshToken = useAuthStore.getState().refreshToken;

      // Khong co refresh token -> logout
      if (!refreshToken) {
        useAuthStore.getState().logout();
        router.replace('/login' as any);
        return Promise.reject(error);
      }

      // Neu dang refresh roi -> dua vao queue cho
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return axiosClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(`${API_URL}${AUTH_API.REFRESH_TOKEN}`, {
          refreshToken,
        });

        const newAccessToken = res.data.accessToken;
        useAuthStore.getState().setAuth(
          newAccessToken,
          refreshToken,
          useAuthStore.getState().user!
        );

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        router.replace('/login' as any);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // 403 — khong co quyen
    if (status === 403) {
      useAuthStore.getState().logout();
      router.replace('/login' as any);
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
```

- [ ] **Step 3: Commit**

```bash
git add api/endpoints.ts api/axiosClient.ts
git commit -m "feat(mobile): add API endpoint constants and improved axios client with token refresh"
```

---

### Task 7: Update Root Layout + Tab Layout

**Files:**
- Modify: `mobile/app/_layout.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Update root layout — register new screens**

```tsx
// app/_layout.tsx
// Root layout — dang ky tat ca screen, auth gate

import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { router } from 'expo-router';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.persist.rehydrate();
      setIsReady(true);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      if (!accessToken) {
        router.replace('/login' as any);
      } else {
        router.replace('/(tabs)' as any);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [accessToken, isReady]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="location/[id]" />
        <Stack.Screen name="booking/[serviceId]" />
        <Stack.Screen name="checkin" />
        <Stack.Screen name="saved-locations" />
        <Stack.Screen name="vouchers" />
        <Stack.Screen name="booking-reminders" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="diary" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="ai-chat" />
        <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Update tab layout — use theme + SessionRevokedModal**

```tsx
// app/(tabs)/_layout.tsx
// Tab bar layout — 4 tab chinh + tab history an

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight } from '../../constants/theme';
import SessionRevokedModal from '../../components/SessionRevokedModal';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: Platform.OS === 'ios' ? insets.bottom : insets.bottom + 10,
              height: 65,
            },
          ],
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Trang chủ',
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Bản đồ',
            tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="tickets"
          options={{
            title: 'Vé của tôi',
            tabBarIcon: ({ color, size }) => <Ionicons name="ticket" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Tài khoản',
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
        <Tabs.Screen name="history" options={{ href: null }} />
      </Tabs>
      <SessionRevokedModal />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderTopWidth: 0,
    paddingHorizontal: 10,
  },
  tabBarItem: { paddingVertical: 8 },
  tabBarLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold as any, marginTop: 4 },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx "app/(tabs)/_layout.tsx"
git commit -m "feat(mobile): update root and tab layouts with new screen routes and theme"
```

---

### Task 8: Install Missing Dependencies + Create Location Permission Hook

**Files:**
- Create: `mobile/hooks/useLocationPermission.ts`

- [ ] **Step 1: Install expo-image-picker and dayjs**

```bash
cd mobile
npx expo install expo-image-picker
npm install dayjs
```

- [ ] **Step 2: Create useLocationPermission hook**

```ts
// hooks/useLocationPermission.ts
// Hook xin quyen GPS va lay vi tri hien tai

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface LocationState {
  latitude: number;
  longitude: number;
}

export default function useLocationPermission() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const requestLocation = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Cần cấp quyền truy cập vị trí để sử dụng tính năng này');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch {
      setErrorMsg('Không thể lấy vị trí hiện tại');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  return { location, errorMsg, loading, requestLocation };
}
```

- [ ] **Step 3: Commit**

```bash
git add hooks/useLocationPermission.ts package.json package-lock.json
git commit -m "feat(mobile): install expo-image-picker, dayjs, add useLocationPermission hook"
```

---

## Phase 1: Core Screens

### Task 9: Home Dashboard

**Files:**
- Rewrite: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Rewrite Home Dashboard screen**

```tsx
// app/(tabs)/index.tsx
// Trang chu — loi chao, thoi tiet, quick actions, goi y dia diem

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../store/useAuthStore';
import axiosClient from '../../api/axiosClient';
import { USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import Avatar from '../../components/Avatar';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import EmptyState from '../../components/EmptyState';
import type { UserProfile, Location } from '../../types';
import useLocationPermission from '../../hooks/useLocationPermission';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 3) / 2;

// Cac muc quick action o trang chu
const QUICK_ACTIONS = [
  { icon: 'notifications' as const, label: 'Nhắc nhở', route: '/booking-reminders' },
  { icon: 'heart' as const, label: 'Đã lưu', route: '/saved-locations' },
  { icon: 'ticket' as const, label: 'Voucher', route: '/vouchers' },
  { icon: 'time' as const, label: 'Lịch sử', route: '/(tabs)/history' },
  { icon: 'warning' as const, label: 'SOS', route: '/sos' },
];

// Mau sac cho tung hang thanh vien
const TIER_COLORS: Record<string, string> = {
  Newbie: colors.textMuted,
  'Silver Traveler': '#94a3b8',
  'Gold Explorer': '#f59e0b',
  'Diamond Pathfinder': '#3b82f6',
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recommendations, setRecommendations] = useState<Location[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [weather, setWeather] = useState<{ temp: number; desc: string } | null>(null);
  const { location } = useLocationPermission();

  // Lay du lieu profile va goi y
  const fetchData = useCallback(async () => {
    try {
      const [profileRes, recRes] = await Promise.all([
        axiosClient.get(USER_API.PROFILE),
        axiosClient.get(USER_API.RECOMMENDATIONS, { params: { limit: 10 } }),
      ]);
      setProfile(profileRes.data);
      setRecommendations(recRes.data.data || recRes.data || []);
    } catch {
      // Khong lam gi khi loi, giu trang thai cu
    }
  }, []);

  // Lay thoi tiet tu Open-Meteo
  const fetchWeather = useCallback(async () => {
    try {
      const lat = location?.latitude || 10.03;
      const lon = location?.longitude || 105.77;
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
      );
      const data = await res.json();
      const temp = Math.round(data.current?.temperature_2m || 0);
      const code = data.current?.weather_code || 0;
      const desc = code <= 1 ? 'Trời nắng' : code <= 3 ? 'Nhiều mây' : code <= 48 ? 'Sương mù' : 'Mưa';
      setWeather({ temp, desc });
    } catch {
      // Khong hien thi thoi tiet neu loi
    }
  }, [location]);

  useEffect(() => {
    fetchData();
    fetchWeather();
  }, [fetchData, fetchWeather]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    await fetchWeather();
    setRefreshing(false);
  };

  const tier = profile?.stats?.member_tier || 'Newbie';
  const tierColor = TIER_COLORS[tier] || colors.textMuted;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Header: avatar + loi chao */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Avatar uri={user?.avatar_url} name={user?.full_name} size={48} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.greeting}>Xin chào,</Text>
            <Text style={styles.userName}>{user?.full_name || 'Bạn'}</Text>
          </View>
        </View>
        <Badge text={tier} variant={tier === 'Newbie' ? 'muted' : 'warning'} />
      </View>

      {/* Thoi tiet */}
      {weather && (
        <Card style={styles.weatherCard}>
          <Ionicons name="partly-sunny" size={28} color={colors.warning} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.weatherTemp}>{weather.temp}°C</Text>
            <Text style={styles.weatherDesc}>{weather.desc}</Text>
          </View>
        </Card>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickAction}
            onPress={() => router.push(action.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name={action.icon} size={22} color={colors.primary} />
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Goi y dia diem */}
      <Text style={styles.sectionTitle}>Gợi ý cho bạn</Text>
      {recommendations.length === 0 ? (
        <EmptyState icon="location-outline" title="Chưa có gợi ý" description="Hãy khám phá thêm địa điểm!" />
      ) : (
        <FlatList
          data={recommendations}
          numColumns={2}
          scrollEnabled={false}
          keyExtractor={(item) => String(item.location_id)}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <Card
              style={styles.locationCard}
              onPress={() => router.push(`/location/${item.location_id}` as any)}
            >
              {item.first_image ? (
                <Image source={{ uri: item.first_image }} style={styles.locationImage} />
              ) : (
                <View style={[styles.locationImage, styles.locationImageFallback]}>
                  <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.locationInfo}>
                <Text style={styles.locationName} numberOfLines={2}>{item.location_name}</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>{item.address || item.province || ''}</Text>
                {item.avg_rating != null && item.avg_rating > 0 && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color={colors.warning} />
                    <Text style={styles.ratingText}>{item.avg_rating.toFixed(1)}</Text>
                  </View>
                )}
              </View>
            </Card>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  greeting: { fontSize: fontSize.sm, color: colors.textSecondary },
  userName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  weatherTemp: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  weatherDesc: { fontSize: fontSize.sm, color: colors.textSecondary },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  quickAction: { alignItems: 'center', width: 64 },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  gridRow: { gap: spacing.md, marginBottom: spacing.md },
  locationCard: { width: CARD_WIDTH, padding: 0, overflow: 'hidden' },
  locationImage: { width: '100%', height: 100, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  locationImageFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  locationInfo: { padding: spacing.sm },
  locationName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  locationAddress: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  ratingText: { fontSize: fontSize.xs, color: colors.textSecondary, marginLeft: 4 },
});
```

- [ ] **Step 2: Verify on device — home screen loads, shows profile, weather, recommendations**

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/index.tsx"
git commit -m "feat(mobile): rewrite Home Dashboard with theme and shared components"
```

---

### Task 10: Map Screen

**Files:**
- Rewrite: `mobile/app/(tabs)/map.tsx`

- [ ] **Step 1: Rewrite Map screen**

Due to the complexity (~1000+ lines), the map screen should be built in focused sub-steps. Create the file with:

1. **Map base** with 4 tile layers (OSM, Voyager, Positron, Satellite)
2. **GPS button** + category filter pills
3. **Location markers** with circular avatar images from API
4. **Search bar** that filters markers
5. **Detail panel** at bottom when tapping a marker (name, rating, hours, phone, navigate button)
6. **OSRM routing** when tapping "Chỉ đường" (driving + foot profiles, dual fallback URLs)
7. **Routing info panel** (distance, duration, close button)

Key implementation notes:
- Use `react-native-maps` `MapView` with `urlTemplate` for OSM tiles
- Fetch locations from `GET /locations` 
- Each marker uses `Marker` with custom `Image` component (circular avatar)
- Double-tap to pick a point (use `onLongPress` on MapView)
- OSRM routing: `GET https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson`
- Fallback URL: `https://routing.openstreetmap.de/routed-car/route/v1/driving/...`

```tsx
// app/(tabs)/map.tsx
// Man hinh ban do day du: OSM tiles, markers, tim kiem, routing, detail panel

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import { extractOpenClose } from '../../utils/openingHours';
import type { Location as LocationType } from '../../types';

// Cac lop tile ban do
const TILE_LAYERS = [
  { key: 'voyager', label: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
  { key: 'positron', label: 'Sáng', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { key: 'osm', label: 'OSM', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
  { key: 'satellite', label: 'Vệ tinh', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' },
];

// OSRM routing URLs
const OSRM_URLS = [
  'https://router.project-osrm.org/route/v1/driving',
  'https://routing.openstreetmap.de/routed-car/route/v1/driving',
];

// Tinh khoang cach giua 2 diem (meters)
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(null);
  const [layerIndex, setLayerIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Lay vi tri hien tai
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    })();
  }, []);

  // Lay danh sach dia diem va favorites
  useEffect(() => {
    const fetch = async () => {
      try {
        const [locRes, favRes] = await Promise.all([
          axiosClient.get(LOCATIONS_API.LIST),
          axiosClient.get(USER_API.FAVORITES).catch(() => ({ data: [] })),
        ]);
        setLocations(locRes.data.data || locRes.data || []);
        const favIds = new Set<number>((favRes.data.data || favRes.data || []).map((f: any) => f.location_id));
        setFavorites(favIds);
      } catch {
        // Khong lam gi
      }
    };
    fetch();
  }, []);

  // Tim kiem + loc theo danh muc
  const filteredLocations = useMemo(() => {
    let result = locations;
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'saved') {
        result = result.filter((l) => favorites.has(l.location_id));
      } else {
        result = result.filter((l) => l.location_type === selectedCategory);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (l) =>
          l.location_name.toLowerCase().includes(q) ||
          (l.address && l.address.toLowerCase().includes(q)) ||
          (l.province && l.province.toLowerCase().includes(q))
      );
    }
    return result;
  }, [locations, search, selectedCategory, favorites]);

  // Routing voi OSRM
  const handleRoute = useCallback(async (dest: LocationType) => {
    if (!userLocation) return;
    setLoadingRoute(true);
    setRouteCoords([]);
    setRouteInfo(null);

    const { latitude: lat1, longitude: lon1 } = userLocation;
    const { latitude: lat2, longitude: lon2 } = dest;

    for (const baseUrl of OSRM_URLS) {
      try {
        const url = `${baseUrl}/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: number[]) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          setRouteCoords(coords);
          setRouteInfo({
            distance: route.distance < 1000 ? `${Math.round(route.distance)}m` : `${(route.distance / 1000).toFixed(1)}km`,
            duration: route.duration < 3600
              ? `${Math.round(route.duration / 60)} phút`
              : `${Math.floor(route.duration / 3600)}h ${Math.round((route.duration % 3600) / 60)}phút`,
          });
          break;
        }
      } catch {
        // Thu URL tiep theo
      }
    }
    setLoadingRoute(false);
  }, [userLocation]);

  // Xoa tuyen duong
  const clearRoute = () => {
    setRouteCoords([]);
    setRouteInfo(null);
  };

  // Chuyen doi giua cac lop tile
  const toggleLayer = () => {
    setLayerIndex((prev) => (prev + 1) % TILE_LAYERS.length);
  };

  const currentLayer = TILE_LAYERS[layerIndex];

  return (
    <View style={styles.container}>
      {/* Ban do */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: userLocation?.latitude || 10.03,
          longitude: userLocation?.longitude || 105.77,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        onLongPress={(e) => {
          // Double-tap hoac long-press de dat marker tuy chinh
          setSelectedLocation(null);
        }}
      >
        {/* Tile layer */}
        <UrlTile urlTemplate={currentLayer.url} maximumZ={17} />

        {/* Markers cho tung dia diem */}
        {filteredLocations.map((loc) => (
          <Marker
            key={loc.location_id}
            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
            onPress={() => {
              setSelectedLocation(loc);
              setRouteCoords([]);
              setRouteInfo(null);
            }}
          >
            <View style={[styles.markerContainer, favorites.has(loc.location_id) && styles.markerFavorite]}>
              {loc.first_image ? (
                <Image source={{ uri: loc.first_image }} style={styles.markerImage} />
              ) : (
                <View style={[styles.markerImage, styles.markerFallback]}>
                  <Ionicons name="location" size={16} color={colors.primary} />
                </View>
              )}
            </View>
          </Marker>
        ))}

        {/* Tuyen duong */}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />
        )}
      </MapView>

      {/* Tim kiem */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm địa điểm..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity onPress={toggleLayer}>
          <Ionicons name="layers" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Category filters */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          { key: 'all', label: 'Tất cả' },
          { key: 'food', label: 'Ăn uống' },
          { key: 'tourist', label: 'Du lịch' },
          { key: 'hotel', label: 'Khách sạn' },
          { key: 'saved', label: 'Đã lưu' },
        ]}
        style={styles.categoryList}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryPill, selectedCategory === item.key && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(item.key)}
          >
            <Text style={[styles.categoryLabel, selectedCategory === item.key && styles.categoryLabelActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Route info panel */}
      {routeInfo && (
        <View style={styles.routeInfoPanel}>
          <View>
            <Text style={styles.routeDistance}>{routeInfo.distance}</Text>
            <Text style={styles.routeDuration}>{routeInfo.duration}</Text>
          </View>
          <TouchableOpacity onPress={clearRoute}>
            <Ionicons name="close-circle" size={28} color={colors.error} />
          </TouchableOpacity>
        </View>
      )}

      {loadingRoute && (
        <View style={styles.routeInfoPanel}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ marginLeft: spacing.sm, color: colors.textSecondary }}>Đang tìm đường...</Text>
        </View>
      )}

      {/* Detail panel khi chon dia diem */}
      {selectedLocation && !routeInfo && (
        <View style={styles.detailPanel}>
          <View style={styles.detailHeader}>
            <Text style={styles.detailName} numberOfLines={1}>{selectedLocation.location_name}</Text>
            <TouchableOpacity onPress={() => setSelectedLocation(null)}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.detailAddress} numberOfLines={1}>
            {selectedLocation.address || selectedLocation.province || ''}
          </Text>
          <View style={styles.detailMeta}>
            {selectedLocation.avg_rating != null && selectedLocation.avg_rating > 0 && (
              <View style={styles.detailMetaItem}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.detailMetaText}>{selectedLocation.avg_rating.toFixed(1)}</Text>
              </View>
            )}
            {(() => {
              const oc = extractOpenClose(selectedLocation.opening_hours);
              if (oc) {
                const isOpen = (() => {
                  const now = new Date();
                  const nowMin = now.getHours() * 60 + now.getMinutes();
                  const [oh, om] = oc.open.split(':').map(Number);
                  const [ch, cm] = oc.close.split(':').map(Number);
                  const openMin = oh * 60 + om;
                  const closeMin = ch * 60 + cm;
                  if (openMin < closeMin) return nowMin >= openMin && nowMin < closeMin;
                  return nowMin >= openMin || nowMin < closeMin;
                })();
                return (
                  <Badge text={isOpen ? `Mở cửa ${oc.open}-${oc.close}` : 'Đã đóng'} variant={isOpen ? 'success' : 'error'} />
                );
              }
              return null;
            })()}
          </View>
          <View style={styles.detailActions}>
            <TouchableOpacity
              style={styles.detailActionBtn}
              onPress={() => router.push(`/location/${selectedLocation.location_id}` as any)}
            >
              <Ionicons name="information-circle" size={20} color={colors.primary} />
              <Text style={styles.detailActionText}>Chi tiết</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailActionBtn, styles.detailActionPrimary]}
              onPress={() => handleRoute(selectedLocation)}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={[styles.detailActionText, { color: '#fff' }]}>Chỉ đường</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  categoryList: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 115 : 105,
    left: 0,
    right: 0,
  },
  categoryPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryPillActive: { backgroundColor: colors.primary },
  categoryLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium as any },
  categoryLabelActive: { color: '#fff' },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  markerFavorite: { borderColor: colors.warning },
  markerImage: { width: 32, height: 32, borderRadius: 16 },
  markerFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  routeInfoPanel: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  routeDistance: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  routeDuration: { fontSize: fontSize.sm, color: colors.textSecondary },
  detailPanel: {
    position: 'absolute',
    bottom: 100,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  detailAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  detailMetaItem: { flexDirection: 'row', alignItems: 'center' },
  detailMetaText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 4 },
  detailActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  detailActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  detailActionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.primary, marginLeft: 6 },
});
```

- [ ] **Step 2: Verify on device — map loads, markers show, search works, routing works**

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/map.tsx"
git commit -m "feat(mobile): rewrite Map screen with OSM tiles, markers, routing"
```

---

### Task 11: Location Detail Screen

**Files:**
- Rewrite: `mobile/app/location/[id].tsx`

- [ ] **Step 1: Rewrite Location Detail screen**

```tsx
// app/location/[id].tsx
// Chi tiet dia diem: anh, thong tin, dich vu, danh gia, voucher

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, TextInput,
  FlatList, StyleSheet, Linking, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, USER_API } from '../../api/endpoints';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import { extractOpenClose } from '../../utils/openingHours';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Avatar from '../../components/Avatar';
import SegmentedControl from '../../components/SegmentedControl';
import RatingStars from '../../components/RatingStars';
import EmptyState from '../../components/EmptyState';
import type { Location, Service, Review, Voucher } from '../../types';

export default function LocationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const locationId = Number(id);

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [locRes, svcRes, revRes, vchRes, favRes] = await Promise.all([
        axiosClient.get(LOCATIONS_API.DETAIL(locationId)),
        axiosClient.get(LOCATIONS_API.SERVICES(locationId)),
        axiosClient.get(LOCATIONS_API.REVIEWS(locationId)),
        axiosClient.get(USER_API.VOUCHERS_LOCATION(locationId)).catch(() => ({ data: [] })),
        axiosClient.get(USER_API.FAVORITES).catch(() => ({ data: [] })),
      ]);
      setLocation(locRes.data.data || locRes.data);
      setServices(svcRes.data.data || svcRes.data || []);
      setReviews(revRes.data.data || revRes.data || []);
      setVouchers(vchRes.data.data || vchRes.data || []);
      const favs = favRes.data.data || favRes.data || [];
      setIsFavorite(favs.some((f: any) => f.location_id === locationId));
    } catch {
      // Giu trang thai cu
    }
  }, [locationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await axiosClient.delete(USER_API.FAVORITES + `/${locationId}`);
      } else {
        await axiosClient.patch(USER_API.FAVORITES + `/${locationId}`, {});
      }
      setIsFavorite(!isFavorite);
    } catch {
      Alert.alert('Lỗi', 'Không thể cập nhật yêu thích');
    }
  };

  const submitReview = async () => {
    if (reviewRating === 0) {
      Alert.alert('Thông báo', 'Vui lòng chọn số sao');
      return;
    }
    setSubmittingReview(true);
    try {
      await axiosClient.post(USER_API.REVIEWS, {
        location_id: locationId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      setReviewRating(0);
      setReviewComment('');
      await fetchData();
      Alert.alert('Thành công', 'Đánh giá đã được gửi');
    } catch {
      Alert.alert('Lỗi', 'Không thể gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  const claimVoucher = async (voucherId: number) => {
    try {
      await axiosClient.post(USER_API.VOUCHERS_CLAIM(voucherId));
      Alert.alert('Thành công', 'Đã nhận voucher');
      await fetchData();
    } catch {
      Alert.alert('Lỗi', 'Không thể nhận voucher');
    }
  };

  if (!location) {
    return <View style={styles.loadingContainer}><Header title="Đang tải..." /></View>;
  }

  const openingInfo = extractOpenClose(location.opening_hours);

  return (
    <View style={styles.container}>
      <Header title={location.location_name} transparent />
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero image */}
        {location.first_image ? (
          <Image source={{ uri: location.first_image }} style={styles.heroImage} />
        ) : (
          <View style={[styles.heroImage, styles.heroFallback]}>
            <Ionicons name="image-outline" size={64} color={colors.textMuted} />
          </View>
        )}

        {/* Info card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Text style={styles.locationName}>{location.location_name}</Text>
            <TouchableOpacity onPress={toggleFavorite}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite ? colors.error : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.address}>{location.address || location.province || ''}</Text>
          <View style={styles.metaRow}>
            {location.avg_rating != null && location.avg_rating > 0 && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={16} color={colors.warning} />
                <Text style={styles.metaText}>{location.avg_rating.toFixed(1)} ({location.total_reviews || 0})</Text>
              </View>
            )}
            {openingInfo && <Badge text={`${openingInfo.open}-${openingInfo.close}`} variant="success" />}
          </View>
          {/* Quick actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => Linking.openURL(`tel:${location.phone}`)}
            >
              <Ionicons name="call" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Gọi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPrimary]}
              onPress={() => router.push(`/(tabs)/map` as any)}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <Text style={[styles.actionText, { color: '#fff' }]}>Chỉ đường</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Vouchers */}
        {vouchers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Voucher khả dụng</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={vouchers}
              keyExtractor={(item) => String(item.voucher_id)}
              renderItem={({ item }) => (
                <Card style={styles.voucherCard}>
                  <Text style={styles.voucherDiscount}>
                    {item.discount_type === 'percentage' ? `${item.discount_value}%` : `${item.discount_value.toLocaleString()}đ`}
                  </Text>
                  <Text style={styles.voucherCode}>{item.voucher_code}</Text>
                  <Text style={styles.voucherMin}>Đơn tối thiểu {item.min_order.toLocaleString()}đ</Text>
                  <Button title="Nhận" onPress={() => claimVoucher(item.voucher_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                </Card>
              )}
            />
          </View>
        )}

        {/* Segmented tabs */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md }}>
          <SegmentedControl options={['Tổng quan', 'Dịch vụ', 'Đánh giá']} selected={activeTab} onChange={setActiveTab} />
        </View>

        {/* Tab content */}
        <View style={{ padding: spacing.md, paddingBottom: 100 }}>
          {activeTab === 0 && (
            // Tong quan
            <View>
              {location.description && (
                <Text style={styles.description}>{location.description}</Text>
              )}
              <Card style={{ marginTop: spacing.md }}>
                {openingInfo && (
                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailText}>Mở cửa: {openingInfo.open} - {openingInfo.close}</Text>
                  </View>
                )}
                {location.phone && (
                  <TouchableOpacity style={styles.detailRow} onPress={() => Linking.openURL(`tel:${location.phone}`)}>
                    <Ionicons name="call" size={18} color={colors.textSecondary} />
                    <Text style={[styles.detailText, { color: colors.primary }]}>{location.phone}</Text>
                  </TouchableOpacity>
                )}
                {location.email && (
                  <View style={styles.detailRow}>
                    <Ionicons name="mail" size={18} color={colors.textSecondary} />
                    <Text style={styles.detailText}>{location.email}</Text>
                  </View>
                )}
              </Card>
            </View>
          )}

          {activeTab === 1 && (
            // Dich vu
            <View>
              {services.length === 0 ? (
                <EmptyState icon="cube-outline" title="Chưa có dịch vụ" />
              ) : (
                services.map((svc) => (
                  <Card key={svc.service_id} style={styles.serviceCard}>
                    <View style={styles.serviceHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.serviceName}>{svc.service_name}</Text>
                        <Badge text={svc.service_type} variant="info" />
                      </View>
                      <Text style={styles.servicePrice}>{svc.price.toLocaleString()}đ</Text>
                    </View>
                    {svc.description && <Text style={styles.serviceDesc}>{svc.description}</Text>}
                    <Button
                      title="Đặt ngay"
                      onPress={() => router.push(`/booking/${svc.service_id}` as any)}
                      variant="primary"
                      style={{ marginTop: spacing.sm }}
                    />
                  </Card>
                ))
              )}
            </View>
          )}

          {activeTab === 2 && (
            // Danh gia
            <View>
              {/* Form danh gia */}
              <Card style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>Viết đánh giá</Text>
                <RatingStars rating={reviewRating} size={28} interactive onChange={setReviewRating} />
                <TextInput
                  style={styles.reviewInput}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  placeholderTextColor={colors.textMuted}
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  numberOfLines={3}
                />
                <Button title="Gửi đánh giá" onPress={submitReview} loading={submittingReview} />
              </Card>

              {/* Danh sach danh gia */}
              {reviews.length === 0 ? (
                <EmptyState icon="chatbubble-outline" title="Chưa có đánh giá" />
              ) : (
                reviews.map((rev) => (
                  <Card key={rev.review_id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Avatar uri={rev.avatar_url} name={rev.full_name} size={36} />
                      <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                        <Text style={styles.reviewName}>{rev.full_name}</Text>
                        <RatingStars rating={rev.rating} size={14} />
                      </View>
                    </View>
                    {rev.comment && <Text style={styles.reviewComment}>{rev.comment}</Text>}
                    {rev.owner_reply && (
                      <View style={styles.ownerReply}>
                        <Text style={styles.ownerReplyLabel}>Phản hồi từ chủ địa điểm:</Text>
                        <Text style={styles.ownerReplyText}>{rev.owner_reply}</Text>
                      </View>
                    )}
                  </Card>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background },
  heroImage: { width: '100%', height: 220 },
  heroFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  infoCard: { marginHorizontal: spacing.md, marginTop: -40 },
  infoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  locationName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, flex: 1 },
  address: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary, marginLeft: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary,
  },
  actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold as any, color: colors.primary, marginLeft: 6 },
  section: { marginTop: spacing.lg, paddingLeft: spacing.md },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  voucherCard: { width: 160, marginRight: spacing.sm },
  voucherDiscount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  voucherCode: { fontSize: fontSize.sm, color: colors.text, marginTop: 4 },
  voucherMin: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  description: { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  detailText: { fontSize: fontSize.base, color: colors.text, marginLeft: spacing.sm },
  serviceCard: { marginBottom: spacing.sm },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  serviceName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  servicePrice: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  serviceDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  reviewForm: { marginBottom: spacing.md },
  reviewFormTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text, marginBottom: spacing.sm },
  reviewInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.sm, fontSize: fontSize.base, color: colors.text,
    minHeight: 80, textAlignVertical: 'top', marginVertical: spacing.md,
  },
  reviewCard: { marginBottom: spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  reviewComment: { fontSize: fontSize.sm, color: colors.text, marginTop: spacing.sm, lineHeight: 20 },
  ownerReply: { marginTop: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.primary },
  ownerReplyLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
  ownerReplyText: { fontSize: fontSize.sm, color: colors.text, marginTop: 2 },
});
```

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/location/[id].tsx"
git commit -m "feat(mobile): rewrite Location Detail with tabs, reviews, vouchers"
```

---

### Task 12: Booking Screen

**Files:**
- Rewrite: `mobile/app/booking/[serviceId].tsx`

- [ ] **Step 1: Rewrite Booking screen**

```tsx
// app/booking/[serviceId].tsx
// Form dat cho: ticket/table/room, VietQR payment, xac nhan chuyen khoan

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { LOCATIONS_API, BOOKINGS_API } from '../../api/endpoints';
import { buildVietQrImageUrl } from '../../utils/vietqr';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Badge from '../../components/Badge';
import LoadingOverlay from '../../components/LoadingOverlay';
import type { Location, Service, Payment } from '../../types';

export default function BookingScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const svcId = Number(serviceId);

  const [service, setService] = useState<Service | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [quantity, setQuantity] = useState(1);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState('');
  const [notes, setNotes] = useState('');
  const [voucherCode, setVoucherCode] = useState('');

  // Payment state
  const [bookingId, setBookingId] = useState<number | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        // Lay service tu location services
        const allLocs = await axiosClient.get(LOCATIONS_API.LIST);
        const locs = allLocs.data.data || allLocs.data || [];
        for (const loc of locs) {
          const svcRes = await axiosClient.get(LOCATIONS_API.SERVICES(loc.location_id));
          const svcs = svcRes.data.data || svcRes.data || [];
          const found = svcs.find((s: Service) => s.service_id === svcId);
          if (found) {
            setService(found);
            setLocation(loc);
            break;
          }
        }
      } catch {
        Alert.alert('Lỗi', 'Không thể tải thông tin dịch vụ');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [svcId]);

  const handleBooking = async () => {
    if (!service || !location) return;
    if (!contactName.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập tên liên hệ'); return; }
    if (!contactPhone.trim()) { Alert.alert('Lỗi', 'Vui lòng nhập số điện thoại'); return; }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        location_id: location.location_id,
        service_id: service.service_id,
        check_in_date: checkInDate,
        quantity,
        source: 'mobile',
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
      };
      if (checkOutDate) payload.check_out_date = checkOutDate;
      if (notes.trim()) payload.notes = notes.trim();
      if (voucherCode.trim()) payload.voucher_code = voucherCode.trim();

      const res = await axiosClient.post(BOOKINGS_API.CREATE, payload);
      const newBookingId = res.data.bookingId || res.data.data?.bookingId;
      setBookingId(newBookingId);

      // Tao payment
      const payRes = await axiosClient.post(BOOKINGS_API.PAYMENT(newBookingId));
      setPayment(payRes.data.data || payRes.data);
      setShowPayment(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tạo đặt chỗ';
      Alert.alert('Lỗi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!bookingId || !service) return;
    setConfirming(true);
    try {
      const svcType = service.service_type;
      if (svcType === 'ticket') {
        await axiosClient.post(BOOKINGS_API.CONFIRM_TICKETS(bookingId));
      } else if (svcType === 'table') {
        await axiosClient.post(BOOKINGS_API.CONFIRM_TABLES(bookingId));
      } else {
        await axiosClient.post(BOOKINGS_API.CONFIRM_ROOMS(bookingId));
      }
      setShowPayment(false);
      setShowSuccess(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể xác nhận chuyển khoản');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <LoadingOverlay visible message="Đang tải..." />;
  if (!service || !location) return <View style={styles.container}><Header title="Lỗi" /><Text>Không tìm thấy dịch vụ</Text></View>;

  const qrResult = payment
    ? buildVietQrImageUrl({
        bankName: payment.bank_name,
        bankAccount: payment.bank_account,
        accountHolder: payment.account_holder,
        amount: payment.amount,
        addInfo: payment.transaction_content,
      })
    : null;

  return (
    <View style={styles.container}>
      <Header title="Đặt chỗ" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Service info */}
        <Card>
          <Text style={styles.svcName}>{service.service_name}</Text>
          <Badge text={service.service_type} variant="info" />
          <Text style={styles.svcPrice}>{service.price.toLocaleString()}đ</Text>
          <Text style={styles.locName}>{location.location_name}</Text>
        </Card>

        {/* Form */}
        <Card style={{ marginTop: spacing.md }}>
          <Input label="Tên liên hệ *" value={contactName} onChangeText={setContactName} leftIcon="person" />
          <Input label="Số điện thoại *" value={contactPhone} onChangeText={setContactPhone} leftIcon="call" keyboardType="phone-pad" />
          <Input label="Ngày check-in" value={checkInDate} onChangeText={setCheckInDate} leftIcon="calendar" />
          {service.service_type === 'room' && (
            <Input label="Ngày check-out" value={checkOutDate} onChangeText={setCheckOutDate} leftIcon="calendar" />
          )}
          {/* Quantity */}
          <Text style={styles.label}>Số lượng</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
              <Ionicons name="remove" size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantity}</Text>
            <TouchableOpacity style={styles.qtyBtn} onPress={() => setQuantity(Math.min(50, quantity + 1))}>
              <Ionicons name="add" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Input label="Mã voucher" value={voucherCode} onChangeText={setVoucherCode} leftIcon="ticket" />
          <Input label="Ghi chú" value={notes} onChangeText={setNotes} leftIcon="document-text" multiline />
        </Card>

        {/* Tong tien */}
        <Card style={{ marginTop: spacing.md }}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalValue}>{(service.price * quantity).toLocaleString()}đ</Text>
          </View>
        </Card>

        <Button
          title="Đặt chỗ"
          onPress={handleBooking}
          loading={submitting}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide">
        <View style={styles.paymentModal}>
          <Header title="Thanh toán" onRightPress={() => setShowPayment(false)} rightIcon="close" />
          <ScrollView contentContainerStyle={styles.paymentContent}>
            {qrResult?.url && (
              <Image source={{ uri: qrResult.url }} style={styles.qrImage} resizeMode="contain" />
            )}
            {payment && (
              <Card>
                <Text style={styles.bankName}>{payment.bank_name}</Text>
                <Text style={styles.bankAccount}>{payment.bank_account}</Text>
                <Text style={styles.accountHolder}>{payment.account_holder}</Text>
                <Text style={styles.amount}>{payment.amount?.toLocaleString()}đ</Text>
                <Text style={styles.transferContent}>{payment.transaction_content}</Text>
              </Card>
            )}
            <Button
              title="Xác nhận đã chuyển khoản"
              onPress={handleConfirmTransfer}
              loading={confirming}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successTitle}>Đặt chỗ thành công!</Text>
            <Text style={styles.successText}>Mã đặt chỗ: #{bookingId}</Text>
            <Button title="Xem vé" onPress={() => { setShowSuccess(false); router.replace('/(tabs)/tickets'); }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  svcName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  svcPrice: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary, marginTop: spacing.sm },
  locName: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, minWidth: 30, textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
  paymentModal: { flex: 1, backgroundColor: colors.background },
  paymentContent: { padding: spacing.md, alignItems: 'center' },
  qrImage: { width: 280, height: 280, marginBottom: spacing.lg },
  bankName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  bankAccount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary, marginTop: spacing.xs },
  accountHolder: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.error, marginTop: spacing.sm },
  transferContent: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  successOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  successCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%' },
  successTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md },
  successText: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.lg },
});
```

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/booking/[serviceId].tsx"
git commit -m "feat(mobile): rewrite Booking screen with dynamic form and VietQR payment"
```

---

### Task 13: Tickets Screen

**Files:**
- Rewrite: `mobile/app/(tabs)/tickets.tsx`

- [ ] **Step 1: Rewrite Tickets screen**

```tsx
// app/(tabs)/tickets.tsx
// Ve cua toi: ve du lich, dat ban, dat phong voi QR code va VietQR payment

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Image, Modal,
  StyleSheet, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { router } from 'expo-router';
import axiosClient from '../../api/axiosClient';
import { USER_API, BOOKINGS_API } from '../../api/endpoints';
import { buildVietQrImageUrl } from '../../utils/vietqr';
import { colors, spacing, fontSize, radius, fontWeight } from '../../constants/theme';
import SegmentedControl from '../../components/SegmentedControl';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Header from '../../components/Header';
import type { Ticket, TablePass, RoomPass, Payment } from '../../types';

// Mau sac trang thai
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'muted' | 'info'> = {
  active: 'success', confirmed: 'success', paid: 'success', completed: 'success',
  pending: 'warning',
  used: 'muted', expired: 'muted', cancelled: 'muted', failed: 'error',
};

export default function TicketsScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tablePasses, setTablePasses] = useState<TablePass[]>([]);
  const [roomPasses, setRoomPasses] = useState<RoomPass[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // QR modal
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQrValue] = useState('');

  // Payment modal
  const [showPayment, setShowPayment] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentBookingId, setPaymentBookingId] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [tkRes, tpRes, rpRes] = await Promise.all([
        axiosClient.get(USER_API.TICKETS),
        axiosClient.get(BOOKINGS_API.TABLE_RESERVATIONS_PASS).catch(() => ({ data: [] })),
        axiosClient.get(BOOKINGS_API.ROOM_RESERVATIONS_PASS).catch(() => ({ data: [] })),
      ]);
      setTickets(tkRes.data.data || tkRes.data || []);
      setTablePasses(tpRes.data.data || tpRes.data || []);
      setRoomPasses(rpRes.data.data || rpRes.data || []);
    } catch {
      // Giu trang thai cu
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const showQRCode = (code: string) => {
    setQrValue(code);
    setShowQR(true);
  };

  const handlePayment = async (bookingId: number) => {
    try {
      const payRes = await axiosClient.post(BOOKINGS_API.PAYMENT(bookingId));
      setPayment(payRes.data.data || payRes.data);
      setPaymentBookingId(bookingId);
      setShowPayment(true);
    } catch {
      Alert.alert('Lỗi', 'Không thể tạo thanh toán');
    }
  };

  const handleConfirmTransfer = async (type: 'ticket' | 'table' | 'room') => {
    if (!paymentBookingId) return;
    setConfirming(true);
    try {
      if (type === 'ticket') await axiosClient.post(BOOKINGS_API.CONFIRM_TICKETS(paymentBookingId));
      else if (type === 'table') await axiosClient.post(BOOKINGS_API.CONFIRM_TABLES(paymentBookingId));
      else await axiosClient.post(BOOKINGS_API.CONFIRM_ROOMS(paymentBookingId));
      setShowPayment(false);
      setShowSuccess(true);
      await fetchData();
    } catch {
      Alert.alert('Lỗi', 'Không thể xác nhận chuyển khoản');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async (bookingId: number) => {
    Alert.alert('Hủy đặt chỗ', 'Bạn có chắc muốn hủy?', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Hủy đặt chỗ',
        style: 'destructive',
        onPress: async () => {
          try {
            await axiosClient.post(BOOKINGS_API.CANCEL(bookingId));
            await fetchData();
          } catch {
            Alert.alert('Lỗi', 'Không thể hủy');
          }
        },
      },
    ]);
  };

  const qrUrl = payment
    ? buildVietQrImageUrl({
        bankName: payment.bank_name,
        bankAccount: payment.bank_account,
        accountHolder: payment.account_holder,
        amount: payment.amount,
        addInfo: payment.transaction_content,
      })
    : null;

  const TABS = ['Vé du lịch', 'Đặt bàn', 'Đặt phòng'];

  return (
    <View style={styles.container}>
      <Header title="Vé của tôi" showBack={false} />
      <View style={styles.segmentWrap}>
        <SegmentedControl options={TABS} selected={activeTab} onChange={setActiveTab} />
      </View>

      {/* Ticket list */}
      {activeTab === 0 && (
        tickets.length === 0 ? (
          <EmptyState icon="ticket-outline" title="Chưa có vé nào" description="Hãy đặt vé du lịch!" />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.ticket_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.ticket_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.service_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                <Text style={styles.ticketLocation}>{item.location_name}</Text>
                <Text style={styles.ticketCode}>{item.ticket_code}</Text>
                <Text style={styles.ticketDate}>{item.use_date ? `Ngày sử dụng: ${item.use_date}` : ''}</Text>
                {item.payment_status === 'pending' && item.booking_id && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* Table passes */}
      {activeTab === 1 && (
        tablePasses.length === 0 ? (
          <EmptyState icon="restaurant-outline" title="Chưa có đặt bàn" description="Hãy đặt bàn nhà hàng!" />
        ) : (
          <FlatList
            data={tablePasses}
            keyExtractor={(item) => String(item.booking_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.secure_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.location_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                {item.table_names && <Text style={styles.ticketLocation}>Bàn: {item.table_names}</Text>}
                <Text style={styles.ticketCode}>{item.secure_code}</Text>
                <Text style={styles.ticketDate}>Check-in: {item.check_in_date}</Text>
                {item.payment_status === 'pending' && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* Room passes */}
      {activeTab === 2 && (
        roomPasses.length === 0 ? (
          <EmptyState icon="bed-outline" title="Chưa có đặt phòng" description="Hãy đặt phòng khách sạn!" />
        ) : (
          <FlatList
            data={roomPasses}
            keyExtractor={(item) => String(item.booking_id)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            renderItem={({ item }) => (
              <Card style={styles.ticketCard} onPress={() => showQRCode(item.secure_code)}>
                <View style={styles.ticketHeader}>
                  <Text style={styles.ticketName}>{item.location_name}</Text>
                  <Badge text={item.status} variant={STATUS_VARIANT[item.status] || 'muted'} />
                </View>
                <Text style={styles.ticketLocation}>{item.check_in_date} → {item.check_out_date}</Text>
                <Text style={styles.ticketCode}>{item.secure_code}</Text>
                {item.payment_status === 'pending' && (
                  <Button title="Thanh toán" onPress={() => handlePayment(item.booking_id)} variant="primary" style={{ marginTop: spacing.sm }} />
                )}
              </Card>
            )}
          />
        )
      )}

      {/* QR Code Modal */}
      <Modal visible={showQR} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Mã QR</Text>
            {qrValue ? <QRCode value={qrValue} size={220} /> : null}
            <Text style={styles.qrCode}>{qrValue}</Text>
            <Button title="Đóng" onPress={() => setShowQR(false)} variant="outline" style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPayment} animationType="slide">
        <View style={styles.paymentModal}>
          <Header title="Thanh toán" rightIcon="close" onRightPress={() => setShowPayment(false)} />
          <ScrollView contentContainerStyle={styles.paymentContent}>
            {qrUrl?.url && <Image source={{ uri: qrUrl.url }} style={styles.qrImage} resizeMode="contain" />}
            {payment && (
              <Card>
                <Text style={styles.bankName}>{payment.bank_name}</Text>
                <Text style={styles.bankAccount}>{payment.bank_account}</Text>
                <Text style={styles.accountHolder}>{payment.account_holder}</Text>
                <Text style={styles.amount}>{payment.amount?.toLocaleString()}đ</Text>
                <Text style={styles.transferContent}>{payment.transaction_content}</Text>
              </Card>
            )}
            <Button
              title="Xác nhận đã chuyển khoản"
              onPress={() => handleConfirmTransfer(activeTab === 0 ? 'ticket' : activeTab === 1 ? 'table' : 'room')}
              loading={confirming}
              style={{ marginTop: spacing.lg }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
            <Text style={styles.successTitle}>Xác nhận thành công!</Text>
            <Button title="Đóng" onPress={() => setShowSuccess(false)} style={{ marginTop: spacing.md }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentWrap: { padding: spacing.md },
  list: { padding: spacing.md, paddingBottom: 100 },
  ticketCard: { marginBottom: spacing.sm },
  ticketHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text, flex: 1 },
  ticketLocation: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  ticketCode: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary, marginTop: spacing.sm, letterSpacing: 1 },
  ticketDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  qrCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%' },
  qrTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text, marginBottom: spacing.md },
  qrCode: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md },
  paymentModal: { flex: 1, backgroundColor: colors.background },
  paymentContent: { padding: spacing.md, alignItems: 'center' },
  qrImage: { width: 280, height: 280, marginBottom: spacing.lg },
  bankName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.text },
  bankAccount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  accountHolder: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  amount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.error, marginTop: spacing.sm },
  transferContent: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  successCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', width: '100%' },
  successTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md },
});
```

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/tickets.tsx"
git commit -m "feat(mobile): rewrite Tickets screen with 3 tabs, QR codes, payment"
```

---

## Phase 2: Supporting Screens

### Task 14: Profile Screen

**Files:**
- Rewrite: `mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Rewrite Profile screen**

Features:
- Avatar + name + email
- Stats row: checkins, saved, vouchers (from `GET /user/profile`)
- Menu items (each navigates to its screen):
  - Địa điểm đã lưu → `/saved-locations`
  - Voucher → `/vouchers`
  - Nhật ký → `/diary`
  - Bảng xếp hạng → `/leaderboard`
  - Thông báo → `/notifications`
  - Chat AI → `/ai-chat`
- Login history section: `GET /user/profile/login-history`
- Logout button

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/profile.tsx"
git commit -m "feat(mobile): rewrite Profile screen with stats and navigation menu"
```

---

### Task 15: History Screen

**Files:**
- Rewrite: `mobile/app/(tabs)/history.tsx`

- [ ] **Step 1: Rewrite History screen**

Features:
- FlatList of check-in history from `GET /user/checkins`
- Each item: location name, address, timestamp, status badge (verified/pending/failed)
- Tap to navigate to location detail
- Pull-to-refresh
- Empty state

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/(tabs)/history.tsx"
git commit -m "feat(mobile): rewrite History screen"
```

---

### Task 16: Saved Locations + Vouchers + Booking Reminders

**Files:**
- Rewrite: `mobile/app/saved-locations.tsx`
- Rewrite: `mobile/app/vouchers.tsx`
- Rewrite: `mobile/app/booking-reminders.tsx`

- [ ] **Step 1: Rewrite Saved Locations**

Features: `GET /user/favorites` — FlatList of cards with image, name, address, rating, unfavorite button. Navigate to location detail on tap.

- [ ] **Step 2: Rewrite Vouchers**

Features: `GET /user/vouchers/saved` — FlatList of voucher cards showing discount value, code, location, min order, expiry.

- [ ] **Step 3: Rewrite Booking Reminders**

Features: `GET /user/booking-reminders` — FlatList showing location, service, check-in date/time, notes.

- [ ] **Step 4: Verify all three on device**

- [ ] **Step 5: Commit**

```bash
git add app/saved-locations.tsx app/vouchers.tsx app/booking-reminders.tsx
git commit -m "feat(mobile): rewrite Saved Locations, Vouchers, Booking Reminders screens"
```

---

### Task 17: SOS Screen

**Files:**
- Rewrite: `mobile/app/sos/index.tsx`

- [ ] **Step 1: Rewrite SOS screen**

Features:
- Get GPS location via `useLocationPermission`
- Big red SOS button → `POST /sos` with lat/lng
- Confirmation dialog before sending
- "Gọi Cảnh sát (113)" button via `Linking.openURL('tel:113')`
- After SOS sent: show "Đang gửi..." then success message

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add "app/sos/index.tsx"
git commit -m "feat(mobile): rewrite SOS screen"
```

---

## Phase 3: New Screens

### Task 18: Check-in Screen

**Files:**
- Create: `mobile/app/checkin.tsx`

- [ ] **Step 1: Create Check-in screen**

Features:
- Get GPS location
- Show nearby locations within 80m (filter from `/locations`)
- "Check-in" button → `POST /user/checkins` with `action: "checkin"`, coordinates, matched `location_id`
- "Lưu" button → `POST /user/checkins` with `action: "save"`
- Rate limit display (30s min interval)
- Night safety warning (22:00-05:00)
- Success animation/message after check-in
- Vietnam geofence check (lat 8-23.5, lng 102-110.5)

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add app/checkin.tsx
git commit -m "feat(mobile): add Check-in screen with GPS and geofencing"
```

---

### Task 19: Diary Screen

**Files:**
- Create: `mobile/app/diary.tsx`

- [ ] **Step 1: Create Diary screen**

Features:
- `GET /user/diary` — FlatList of diary entries
- Each entry: mood emoji, notes text, location name, date, images
- "Thêm nhật ký" floating button → modal form with mood selector, notes input, image picker (`expo-image-picker`)
- `POST /user/diary` — create entry
- `DELETE /user/diary/:id` — delete entry (swipe or long-press)
- Mood options: happy, excited, neutral, sad, angry, tired (mapped to Ionicons)

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add app/diary.tsx
git commit -m "feat(mobile): add Diary screen with mood tracking"
```

---

### Task 20: Notifications Screen

**Files:**
- Create: `mobile/app/notifications.tsx`

- [ ] **Step 1: Create Notifications screen**

Features:
- `GET /user/notifications` — FlatList of notifications
- Each item: title, body, time (relative via dayjs), read/unread indicator
- "Đánh dấu tất cả đã đọc" button → `POST /user/notifications/read-all`
- "Xóa tất cả" button → `POST /user/notifications/delete-all`
- Pull-to-refresh
- Empty state

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add app/notifications.tsx
git commit -m "feat(mobile): add Notifications screen"
```

---

### Task 21: Leaderboard Screen

**Files:**
- Create: `mobile/app/leaderboard.tsx`

- [ ] **Step 1: Create Leaderboard screen**

Features:
- Province selector (dropdown or text input)
- Month selector (current month default)
- `GET /user/leaderboard?province=&month=YYYY-MM` — top 50
- FlatList with rank number, avatar, name, checkin count
- Top 3 highlighted with gold/silver/bronze styling
- Current user's rank highlighted

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add app/leaderboard.tsx
git commit -m "feat(mobile): add Leaderboard screen"
```

---

### Task 22: AI Chat Screen

**Files:**
- Create: `mobile/app/ai-chat.tsx`

- [ ] **Step 1: Create AI Chat screen**

Features:
- Chat UI with message bubbles (user = right, AI = left)
- Text input at bottom with send button
- `POST /ai/chat` — send message (currently returns maintenance message)
- FlatList of messages with auto-scroll to bottom
- Loading indicator while waiting for response
- Note: backend currently returns maintenance message, so this is a skeleton for future

- [ ] **Step 2: Verify on device**

- [ ] **Step 3: Commit**

```bash
git add app/ai-chat.tsx
git commit -m "feat(mobile): add AI Chat screen"
```

---

## Phase 4: Cleanup

### Task 23: Delete Old Template Files

**Files:**
- Delete: `mobile/components/EditScreenInfo.tsx`
- Delete: `mobile/components/StyledText.tsx`
- Delete: `mobile/components/Themed.tsx`
- Delete: `mobile/components/ExternalLink.tsx`
- Delete: `mobile/components/useColorScheme.ts`
- Delete: `mobile/components/useColorScheme.web.ts`
- Delete: `mobile/components/useClientOnlyValue.ts`
- Delete: `mobile/components/useClientOnlyValue.web.ts`
- Delete: `mobile/constants/Colors.ts`
- Delete: `mobile/app/modal.tsx`

- [ ] **Step 1: Delete unused template files**

```bash
cd mobile
rm components/EditScreenInfo.tsx components/StyledText.tsx components/Themed.tsx components/ExternalLink.tsx
rm components/useColorScheme.ts components/useColorScheme.web.ts
rm components/useClientOnlyValue.ts components/useClientOnlyValue.web.ts
rm constants/Colors.ts app/modal.tsx
```

- [ ] **Step 2: Verify app still builds and runs**

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(mobile): remove unused Expo template files"
```

---

### Task 24: Final Verification

- [ ] **Step 1: Run full app flow on device**

Test the complete user journey:
1. Login with email/password
2. Home → see profile, weather, recommendations
3. Map → search, markers, routing
4. Tap location → Location Detail → view services, reviews, claim voucher
5. Book a service → VietQR payment → confirm transfer
6. Tickets → see ticket, QR code
7. Check-in → GPS-based check-in
8. Profile → navigate to Diary, Notifications, Leaderboard, Saved Locations, Vouchers
9. SOS → send emergency alert
10. Logout

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(mobile): complete mobile app rebuild"
```
