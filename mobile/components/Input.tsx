import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  errorStyle?: TextStyle;
  isPassword?: boolean;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  containerStyle,
  inputStyle,
  labelStyle,
  errorStyle,
  isPassword = false,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getBorderColor = () => {
    if (error) return '#ef4444';
    if (isFocused) return '#3b82f6';
    return '#e5e7eb';
  };

  return (
    <View style={[{ marginBottom: 16 }, containerStyle]}>
      {label && (
        <Text
          style={[
            {
              fontSize: 14,
              fontWeight: '500',
              color: '#374151',
              marginBottom: 6,
            },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f9fafb',
          borderWidth: 1.5,
          borderColor: getBorderColor(),
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 2,
        }}
      >
        {leftIcon && (
          <View style={{ marginRight: 8 }}>{leftIcon}</View>
        )}

        <TextInput
          style={[
            {
              flex: 1,
              fontSize: 16,
              color: '#111827',
              paddingVertical: 12,
            },
            inputStyle,
          ]}
          placeholderTextColor="#9ca3af"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPassword && !showPassword}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={{ marginLeft: 8 }}
          >
            <Text style={{ fontSize: 18 }}>
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </Text>
          </TouchableOpacity>
        )}

        {rightIcon && !isPassword && (
          <View style={{ marginLeft: 8 }}>{rightIcon}</View>
        )}
      </View>

      {error && (
        <Text
          style={[
            {
              fontSize: 12,
              color: '#ef4444',
              marginTop: 4,
              marginLeft: 4,
            },
            errorStyle,
          ]}
        >
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text
          style={{
            fontSize: 12,
            color: '#6b7280',
            marginTop: 4,
            marginLeft: 4,
          }}
        >
          {hint}
        </Text>
      )}
    </View>
  );
};

export default Input;
