import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
  textStyle,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: disabled ? '#93c5fd' : '#3b82f6',
        };
      case 'secondary':
        return {
          backgroundColor: disabled ? '#86efac' : '#22c55e',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? '#93c5fd' : '#3b82f6',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
        };
      case 'danger':
        return {
          backgroundColor: disabled ? '#fca5a5' : '#ef4444',
        };
      default:
        return {
          backgroundColor: disabled ? '#93c5fd' : '#3b82f6',
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 8,
        };
      case 'md':
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
        };
      case 'lg':
        return {
          paddingVertical: 16,
          paddingHorizontal: 24,
          borderRadius: 16,
        };
      default:
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
        };
    }
  };

  const getTextStyles = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    switch (size) {
      case 'sm':
        baseStyle.fontSize = 14;
        break;
      case 'md':
        baseStyle.fontSize = 16;
        break;
      case 'lg':
        baseStyle.fontSize = 18;
        break;
    }

    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        baseStyle.color = '#ffffff';
        break;
      case 'outline':
        baseStyle.color = disabled ? '#93c5fd' : '#3b82f6';
        break;
      case 'ghost':
        baseStyle.color = disabled ? '#93c5fd' : '#3b82f6';
        break;
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          ...getVariantStyles(),
          ...getSizeStyles(),
          opacity: disabled ? 0.6 : 1,
          ...(fullWidth && { width: '100%' }),
        },
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? '#3b82f6' : '#ffffff'}
          size="small"
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              getTextStyles(),
              icon ? { marginLeft: 8 } : {},
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;
