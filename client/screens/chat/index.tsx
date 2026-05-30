import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import RNSSE from "react-native-sse";

// API Base URL
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

// 澳门奢华绿金色系
const MACAU_GREEN = "#0A5C36";
const MACAU_GOLD = "#C9A96E";
const MACAU_GOLD_LIGHT = "#F5F0E0";
const MACAU_WARM = "#FCF8F3";

// Types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export default function ChatScreen() {
  const router = useSafeRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "0",
      role: "assistant",
      content: "你好！我是澳门娱乐咨询助手，有什么可以帮到你的吗？",
      timestamp: Date.now(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStreamingContent, setCurrentStreamingContent] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);
    setCurrentStreamingContent("");

    // Add temporary assistant message for streaming
    const tempAssistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempAssistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      },
    ]);

    try {
      const sse = new RNSSE(`${API_BASE}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId,
        }),
      });

      let fullResponse = "";
      let resolvedConversationId: string | null = null;

      sse.addEventListener("message", (event) => {
        if (event.data === "[DONE]") {
          sse.close();
          return;
        }
        try {
          const data = JSON.parse(event.data || "{}");
          if (data.type === "answer" && data.content) {
            fullResponse += data.content;
            setCurrentStreamingContent(fullResponse);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, content: fullResponse }
                  : msg
              )
            );
          } else if (data.type === "completed" && data.conversation_id) {
            resolvedConversationId = data.conversation_id;
          }
        } catch {
          // Skip invalid JSON
        }
      });

      sse.addEventListener("error", (error) => {
        console.error("SSE error:", error);
        sse.close();
        if (!fullResponse) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, content: "抱歉，发生了错误，请稍后再试。" }
                : msg
            )
          );
        }
        setIsLoading(false);
      });

      sse.addEventListener("close", () => {
        setIsLoading(false);
        setCurrentStreamingContent("");
        if (resolvedConversationId) {
          setConversationId(resolvedConversationId);
        }
        if (!fullResponse) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, content: "抱歉，暂未获取到回复，请稍后再试。" }
                : msg
            )
          );
        }
      });
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempAssistantId
            ? { ...msg, content: "发送消息失败，请检查网络连接。" }
            : msg
        )
      );
      setIsLoading(false);
    }
  }, [inputText, isLoading, conversationId]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isUser = item.role === "user";
      return (
        <View
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
          ]}
        >
          {!isUser && (
            <View style={styles.avatarContainer}>
              <View style={styles.assistantAvatar}>
                <FontAwesome6 name="robot" size={18} color="#FFFFFF" />
              </View>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.assistantMessageText,
              ]}
            >
              {item.content}
              {isLoading && !isUser && item.content === "" && (
                <ActivityIndicator size="small" color={MACAU_GREEN} />
              )}
            </Text>
          </View>
          {isUser && (
            <View style={styles.avatarContainer}>
              <View style={styles.userAvatar}>
                <FontAwesome6 name="user" size={16} color="#FFFFFF" />
              </View>
            </View>
          )}
        </View>
      );
    },
    [isLoading]
  );

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome6 name="arrow-left" size={20} color={MACAU_GREEN} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>AI对话</Text>
            <View style={styles.headerGoldDot} />
          </View>
          <TouchableOpacity
            onPress={() => {
              setMessages([
                {
                  id: "0",
                  role: "assistant",
                  content: "你好！我是澳门娱乐咨询助手，有什么可以帮到你的吗？",
                  timestamp: Date.now(),
                },
              ]);
              setConversationId(null);
            }}
            style={styles.clearButton}
          >
            <FontAwesome6 name="trash" size={18} color={MACAU_GOLD} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Input Area */}
        <View style={[styles.inputArea, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="输入消息..."
              placeholderTextColor={MACAU_GOLD}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 name="paper-plane" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MACAU_WARM,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: MACAU_GOLD_LIGHT,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: MACAU_GREEN,
  },
  headerGoldDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: MACAU_GOLD,
  },
  clearButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: 16,
  },
  userMessageContainer: {
    justifyContent: "flex-end",
  },
  assistantMessageContainer: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    justifyContent: "center",
    marginHorizontal: 8,
  },
  assistantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MACAU_GREEN,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MACAU_GOLD,
    justifyContent: "center",
    alignItems: "center",
  },
  messageBubble: {
    maxWidth: "70%",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: MACAU_GREEN,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: "#FFFFFF",
  },
  assistantMessageText: {
    color: "#2D2A3D",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: MACAU_GOLD_LIGHT,
  },
  inputContainer: {
    flex: 1,
    backgroundColor: MACAU_WARM,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: MACAU_GOLD_LIGHT,
  },
  input: {
    fontSize: 15,
    color: "#1A1A2E",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MACAU_GREEN,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: "#B8A88A",
    shadowOpacity: 0,
    elevation: 0,
  },
});