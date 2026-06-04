// app/ai-chat.tsx
// Man hinh chat AI: hien thi tin nhan, gui cau hoi, nhan phan hoi tu backend

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosClient from '../api/axiosClient';
import { colors, spacing, fontSize, radius, fontWeight } from '../constants/theme';
import Header from '../components/Header';

// Cau truc mot tin nhan trong cuoc hoi thoai
interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

// Tao ID duy nhat cho tung tin nhan
let messageIdCounter = 0;
const generateId = (): string => {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
};

export default function AiChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Tu dong scroll xuong khi co tin nhan moi
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  // Gui tin nhan len backend va nhan phan hoi
  const handleSend = useCallback(async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isLoading) return;

    // Them tin nhan cua nguoi dung vao danh sach
    const userMessage: ChatMessage = {
      id: generateId(),
      text: trimmed,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const res = await axiosClient.post('/ai/chat', { message: trimmed });
      const reply = res.data?.data?.reply || res.data?.reply || 'Khong nhan duoc phan hoi.';

      const aiMessage: ChatMessage = {
        id: generateId(),
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      // Hien thi thong bao loi khi khong gui duoc
      const errorMessage: ChatMessage = {
        id: generateId(),
        text: 'Co loi xay ra. Vui long thu lai sau.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  }, [inputText, isLoading, scrollToBottom]);

  // Render tung tin nhan
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.isUser;

    return (
      <View style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}>
        {!isUser && (
          <View style={styles.avatarCircle}>
            <Ionicons name="sparkles" size={16} color={colors.primary} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.aiBubbleText]}>
            {item.text}
          </Text>
        </View>
      </View>
    );
  }, []);

  // Phan footer hien thi loading khi dang cho phan hoi
  const renderFooter = useCallback(() => {
    if (!isLoading) return null;

    return (
      <View style={[styles.messageRow, styles.aiRow]}>
        <View style={styles.avatarCircle}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <View style={[styles.bubble, styles.aiBubble, styles.loadingBubble]}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Dang suy nghi...</Text>
        </View>
      </View>
    );
  }, [isLoading]);

  // Tin nhan dau tien khi chua co lich su
  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.border} />
      <Text style={styles.emptyTitle}>Chat voi AI</Text>
      <Text style={styles.emptyDesc}>Hoi bat cu dieu gi ve chuyen di cua ban!</Text>
    </View>
  ), []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <Header title="Chat AI" />

      {/* Danh sach tin nhan */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
      />

      {/* Thanh nhap tin nhan */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Nhap cau hoi..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          editable={!isLoading}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isLoading}
          activeOpacity={0.7}
        >
          <Ionicons
            name="send"
            size={20}
            color={inputText.trim() && !isLoading ? colors.surface : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Cau truc hang tin nhan
  messageRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  // Avatar AI
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  // Bong chat
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: spacing.xs,
  },
  aiBubble: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  bubbleText: {
    fontSize: fontSize.base,
    lineHeight: 22,
  },
  userBubbleText: {
    color: colors.surface,
  },
  aiBubbleText: {
    color: colors.text,
  },
  // Trang thai loading
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // Trang thai trong
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.md,
  },
  emptyDesc: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Thanh nhap lieu
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.base,
    color: colors.text,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.surfaceAlt,
  },
});
