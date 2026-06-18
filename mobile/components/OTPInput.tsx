import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Keyboard,
} from 'react-native';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoFocus?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  autoFocus = true,
}) => {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChangeText = (text: string, index: number) => {
    // Chỉ cho phép nhập số
    const sanitizedText = text.replace(/[^0-9]/g, '');

    if (sanitizedText.length > 0) {
      // Nếu nhập nhiều ký tự (paste), lấy ký tự đầu
      const digit = sanitizedText[0];

      // Cập nhật giá trị
      const newValue = value.split('');
      newValue[index] = digit;
      const updatedValue = newValue.join('').slice(0, length);
      onChange(updatedValue);

      // Chuyển focus sang ô tiếp theo
      if (index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // Nếu đã nhập đủ, ẩn bàn phím
        Keyboard.dismiss();
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (value[index]) {
        // Nếu ô hiện tại có giá trị, xóa nó
        const newValue = value.split('');
        newValue[index] = '';
        onChange(newValue.join(''));
      } else if (index > 0) {
        // Nếu ô hiện tại trống, quay lại ô trước
        const newValue = value.split('');
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const renderInputs = () => {
    const inputs = [];

    for (let i = 0; i < length; i++) {
      inputs.push(
        <TextInput
          key={i}
          ref={(ref) => {
            inputRefs.current[i] = ref;
          }}
          style={[
            styles.input,
            focusedIndex === i && styles.inputFocused,
            value[i] && styles.inputFilled,
            error && styles.inputError,
          ]}
          maxLength={1}
          keyboardType="number-pad"
          onChangeText={(text) => handleChangeText(text, i)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
          onFocus={() => handleFocus(i)}
          value={value[i] || ''}
          selectTextOnFocus
          caretHidden
        />
      );
    }

    return inputs;
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>{renderInputs()}</View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  input: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  inputFocused: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  inputFilled: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default OTPInput;
