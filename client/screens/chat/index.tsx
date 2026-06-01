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
  Alert,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useSafeRouter } from "@/hooks/useSafeRouter";
import RNSSE from "react-native-sse";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";

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
  
  // 录音相关
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  
  // 语音播报相关
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);

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

  // 请求麦克风权限
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === "granted";
    } catch {
      return false;
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      // 检查权限
      const hasPermission = await requestMicPermission();
      if (!hasPermission) {
        Alert.alert("权限不足", "需要麦克风权限才能使用语音输入");
        return;
      }

      // 配置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // 开始录音
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("录音失败", "无法开始录音，请重试");
    }
  };

  // 停止录音并识别
  const stopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      setIsRecognizing(true);

      // 停止录音
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error("No recording URI");
      }

      // 读取音频文件并转换为 base64
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64data = (reader.result as string).split(",")[1];
        
        try {
          // 调用后端 STT API
          const sttResponse = await fetch(`${API_BASE}/api/v1/stt`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio: base64data,
              mimeType: "audio/webm",
            }),
          });

          const result = await sttResponse.json();

          if (result.success && result.text) {
            setInputText(result.text);
            // 自动发送
            handleSendMessage(result.text);
          } else {
            Alert.alert("识别失败", result.error || "无法识别语音内容");
          }
        } catch (error) {
          console.error("STT error:", error);
          Alert.alert("识别失败", "语音识别服务暂时不可用");
        } finally {
          setIsRecognizing(false);
          // 重置音频模式
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
          });
        }
      };

      reader.onerror = () => {
        setIsRecognizing(false);
        Alert.alert("识别失败", "无法读取录音文件");
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsRecording(false);
      setIsRecognizing(false);
      Alert.alert("录音失败", "停止录音时出错");
    }
  };

  // 语音播报
  const speakText = useCallback((text: string) => {
    if (!autoPlayEnabled || isSpeaking) return;

    // 停止之前的播报
    Speech.stop();

    setIsSpeaking(true);
    Speech.speak(text, {
      language: "zh-CN",
      pitch: 1.0,
      rate: 1.0,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  }, [autoPlayEnabled, isSpeaking]);

  // 停止语音播报
  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // 发送消息（支持直接传入文字）
  const handleSendMessage = useCallback(async (text?: string) => {
    const messageToSend = text || inputText.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!text) setInputText("");
    setIsLoading(true);
    setCurrentStreamingContent("");

    // 停止语音播报
    stopSpeaking();

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
        } else {
          // AI 回复完成，语音播报
          speakText(fullResponse);
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
  }, [inputText, isLoading, conversationId, speakText]);

  // 清理：组件卸载时停止语音
  useEffect(() => {
    return () => {
      Speech.stop();
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
    };
  }, []);

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
            onPress={() => setAutoPlayEnabled(!autoPlayEnabled)}
            style={styles.soundToggle}
          >
            <FontAwesome6 
              name={autoPlayEnabled ? "volume-high" : "volume-xmark"} 
              size={18} 
              color={autoPlayEnabled ? MACAU_GOLD : "#999"} 
            />
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
          
          {/* Voice Input Button */}
          <TouchableOpacity
            style={[
              styles.voiceButton,
              isRecording && styles.voiceButtonRecording,
              isRecognizing && styles.voiceButtonDisabled,
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isRecognizing}
          >
            {isRecognizing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <FontAwesome6 
                name={isRecording ? "stop" : "microphone"} 
                size={18} 
                color="#FFFFFF" 
              />
            )}
          </TouchableOpacity>
          
          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => handleSendMessage()}
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
  soundToggle: {
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
    marginRight: 8,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: MACAU_GOLD_LIGHT,
  },
  input: {
    fontSize: 15,
    color: "#1A1A2E",
  },
  voiceButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: MACAU_GOLD,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    shadowColor: MACAU_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  voiceButtonRecording: {
    backgroundColor: "#E53935",
    shadowColor: "#E53935",
  },
  voiceButtonDisabled: {
    backgroundColor: "#B8A88A",
    shadowOpacity: 0,
    elevation: 0,
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
