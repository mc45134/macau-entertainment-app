import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  LayoutAnimation,
  Image,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import RNSSE from "react-native-sse";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

const quickQuestions = [
  { icon: "clock", text: "娱乐场营业时间", color: "#6366F1" },
  { icon: "utensils", text: "澳门美食推荐", color: "#EC4899" },
  { icon: "plane-departure", text: "通关口岸资讯", color: "#F59E0B" },
  { icon: "cloud-sun", text: "澳门天气查询", color: "#06B6D4" },
];

export default function ConsultScreen() {
  const insets = useSafeAreaInsets();
  const [currentResponse, setCurrentResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [activeTab, setActiveTab] = useState("consult");
  const [sessionId] = useState(() => "sess_" + Math.random().toString(36).substring(2, 10));
  const [recommendations, setRecommendations] = useState<{ tags: string[]; items: { title: string; reason: string }[] } | null>(null);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // 监听键盘显示/隐藏
  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // 子页面数据
  const [headlines, setHeadlines] = useState<any[]>([]);
  const [movies, setMovies] = useState<any[]>([]);
  const [concerts, setConcerts] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const tabs = [
    { key: "consult", label: "AI咨询", icon: "comments" },
    { key: "headlines", label: "活动头条", icon: "newspaper" },
    { key: "movies", label: "电影", icon: "film" },
    { key: "concerts", label: "演唱会", icon: "music" },
  ];

  const sendMessage = useCallback((message: string) => {
    setIsLoading(true);
    setCurrentResponse("");
    setRecommendations(null);

    const sse = new RNSSE(`${API_BASE}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    }) as any;

    sse.addEventListener("message", (event: any) => {
      if (event.data === "[DONE]") {
        sse.close();
        setIsLoading(false);
        return;
      }
      try {
        const data = JSON.parse(event.data);
        if (data.type === "answer" && data.content) {
          setCurrentResponse((prev) => prev + data.content);
        } else if (data.type === "recommendations" && data.content) {
          setRecommendations(data.content);
          if (data.content.tags) {
            setUserInterests(data.content.tags);
          }
        }
      } catch (_e) {
        // 忽略解析错误
      }
    });

    sse.addEventListener("error", () => {
      setIsLoading(false);
    });
  }, [sessionId]);

  // 加载子页面数据
  const fetchTabData = useCallback(async (tab: string) => {
    if (tab === "consult") return;
    setDataLoading(true);
    try {
      const endpoint =
        tab === "headlines"
          ? "/api/v1/entertainment/headlines"
          : tab === "movies"
            ? "/api/v1/entertainment/movies"
            : "/api/v1/entertainment/concerts";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const res = await fetch(`${API_BASE}${endpoint}`, { signal: controller.signal });
        clearTimeout(timeout);
        const json = await res.json();
        const rawData = json.data || {};
        if (tab === "headlines") setHeadlines(rawData.headlines || []);
        else if (tab === "movies") setMovies(rawData.movies || []);
        else setConcerts(rawData.concerts || []);
      } catch (_e) {
        clearTimeout(timeout);
      }
    } catch (_e) {
      // ignore
    }
    setDataLoading(false);
  }, []);

  const handleTabChange = (tab: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tab);
    if (tab !== "consult") {
      fetchTabData(tab);
    }
  };

  useEffect(() => {
    if (currentResponse) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [currentResponse]);

  const handleQuickQuestion = (q: string) => {
    Keyboard.dismiss();
    setShowInput(false);
    setCurrentResponse("");
    sendMessage(q);
  };

  const handleSend = () => {
    if (!inputText.trim() || isLoading) return;
    const msg = inputText.trim();
    setInputText("");
    Keyboard.dismiss();
    sendMessage(msg);
  };

  const toggleInput = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowInput((prev) => {
      if (!prev) {
        setTimeout(() => inputRef.current?.focus(), 300);
      }
      return !prev;
    });
  };

  // ===== 渲染子页面内容 =====
  const renderConsultTab = () => (
    <ScrollView
      ref={scrollViewRef}
      style={styles.mainScroll}
      contentContainerStyle={[
        styles.mainContent,
        isKeyboardVisible && styles.mainContentKeyboard,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* AI 回答卡片 */}
      <View style={styles.aiCard}>
        <View style={styles.aiCardHeader}>
          <View style={styles.aiIconWrap}>
            <FontAwesome6 name="wand-magic" size={16} color="#FFFFFF" />
          </View>
          <Text style={styles.aiCardTitle}>助手回答</Text>
          {isLoading && (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color={MACAU_GREEN} />
              <Text style={styles.typingText}>思考中</Text>
            </View>
          )}
        </View>
        <View style={styles.aiCardBody}>
          {currentResponse ? (
            <Text style={styles.aiResponseText}>{currentResponse}</Text>
          ) : !isLoading ? (
            <View style={styles.emptyState}>
              <FontAwesome6 name="message" size={28} color="#CBD5E1" />
              <Text style={styles.emptyText}>点击下方问题或输入您的疑问</Text>
              <Text style={styles.emptySubtext}>AI 将为您即时解答</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* 为你推荐区域 */}
      {recommendations && recommendations.items && recommendations.items.length > 0 && (
        <View style={styles.recoSection}>
          <View style={styles.recoHeader}>
            <FontAwesome6 name="gem" size={14} color={MACAU_GREEN} />
            <Text style={styles.recoTitle}>为你推荐</Text>
          </View>
          {/* 兴趣标签 */}
          {userInterests.length > 0 && (
            <View style={styles.tagRow}>
              {userInterests.slice(0, 4).map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
          {/* 推荐内容 */}
          {recommendations.items.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.recoCard}
              onPress={() => handleQuickQuestion(item.title)}
              activeOpacity={0.7}
            >
              <View style={styles.recoIconWrap}>
                <FontAwesome6 name="lightbulb" size={14} color={MACAU_GREEN} />
              </View>
              <View style={styles.recoContent}>
                <Text style={styles.recoItemTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.recoReason} numberOfLines={1}>{item.reason}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={10} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 常见问题区域 - 键盘弹出时隐藏 */}
      {!isKeyboardVisible && (
        <View style={styles.faqSection}>
          <Text style={styles.faqTitle}>常见问题</Text>
          <View style={styles.faqGrid}>
            {quickQuestions.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={styles.faqCard}
                onPress={() => handleQuickQuestion(q.text)}
                activeOpacity={0.7}
              >
                <View style={[styles.faqIconWrap, { backgroundColor: `${q.color}15` }]}>
                  <FontAwesome6 name={q.icon as any} size={16} color={q.color} />
                </View>
                <Text style={styles.faqText} numberOfLines={1}>{q.text}</Text>
                <FontAwesome6 name="chevron-right" size={10} color="#CBD5E1" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );

  const renderHeadlinesTab = () => {
    if (dataLoading) return <LoadingView />;
    if (headlines.length === 0) return <EmptyView text="暂无活动头条" icon="newspaper" />;
    return (
      <FlatList
        data={headlines}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <View style={styles.listCard}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.headlineImage} />
            ) : null}
            <View style={styles.listCardInner}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <Text style={styles.listCardTitle} numberOfLines={2}>{item.title}</Text>
              {item.summary ? <Text style={styles.listCardSub} numberOfLines={2}>{item.summary}</Text> : null}
              {item.source && <Text style={styles.listCardMeta}>{item.source}</Text>}
            </View>
          </View>
        )}
      />
    );
  };

  const renderMoviesTab = () => {
    if (dataLoading) return <LoadingView />;
    if (movies.length === 0) return <EmptyView text="暂无电影推荐" icon="film" />;
    return (
      <FlatList
        data={movies}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.listCard}>
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.moviePoster} />
            ) : null}
            <View style={styles.listCardInner}>
              <Text style={styles.listCardTitle} numberOfLines={2}>{item.title}</Text>
              {item.genre && <Text style={styles.listCardSub}>{item.genre}</Text>}
              {item.rating && (
                <View style={styles.ratingRow}>
                  <FontAwesome6 name="star" size={12} color="#F59E0B" />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              )}
              {item.showtimes && <Text style={styles.listCardMeta}>场次: {Array.isArray(item.showtimes) ? item.showtimes.join(" / ") : item.showtimes}</Text>}
            </View>
          </View>
        )}
      />
    );
  };

  const renderConcertsTab = () => {
    if (dataLoading) return <LoadingView />;
    if (concerts.length === 0) return <EmptyView text="暂无演唱会信息" icon="music" />;
    return (
      <FlatList
        data={concerts}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.listCard}>
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.concertImage} />
            ) : null}
            <View style={styles.listCardInner}>
              <Text style={styles.listCardTitle} numberOfLines={2}>{item.artist || item.title}</Text>
              {item.date && <Text style={styles.listCardSub}>{item.date}</Text>}
              {item.venue && <Text style={styles.listCardMeta}>{item.venue}</Text>}
              {item.price && <Text style={styles.priceText}>{item.price}</Text>}
              {item.status && (
                <View style={[styles.statusBadge, item.status.includes("售") ? styles.statusActive : styles.statusEnded]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "headlines": return renderHeadlinesTab();
      case "movies": return renderMoviesTab();
      case "concerts": return renderConcertsTab();
      default: return renderConsultTab();
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* 顶部 Hero 区域 */}
        <View style={styles.heroHeader}>
          <View style={styles.heroInner}>
            <Text style={styles.heroTitle}>澳门娱乐咨询</Text>
            <Text style={styles.heroSubtitle}>你的澳门小管家，隨時陪伴你左右~</Text>
          </View>
          {/* 顶部标签导航 */}
          <View style={styles.tabRow}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tabItem, isActive && styles.tabItemActive]}
                  onPress={() => handleTabChange(tab.key)}
                  activeOpacity={0.7}
                >
                  <FontAwesome6
                    name={tab.icon as any}
                    size={13}
                    color={isActive ? MACAU_GREEN : "rgba(255,255,255,0.8)"}
                  />
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 子页面内容 */}
        <View style={[styles.contentArea, isKeyboardVisible && styles.contentAreaKeyboardVisible]}>
          {renderTabContent()}
        </View>

        {/* 底部输入区域 (仅咨询Tab显示) */}
        {activeTab === "consult" && (
          <View
            style={[
              styles.bottomSection,
              { paddingBottom: insets.bottom || 12 },
              isKeyboardVisible && styles.bottomSectionKeyboard,
            ]}
          >
            {showInput ? (
              <View style={styles.inputRow}>
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  placeholder="输入您的问题..."
                  placeholderTextColor="#94A3B8"
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                  activeOpacity={0.7}
                >
                  <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.collapseButton} onPress={toggleInput} activeOpacity={0.7}>
                  <FontAwesome6 name="chevron-down" size={14} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.askButton} onPress={toggleInput} activeOpacity={0.7}>
                <FontAwesome6 name="pen-to-square" size={16} color={MACAU_GREEN} />
                <Text style={styles.askButtonText}>输入问题</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ===== 辅助组件 =====
function LoadingView() {
  return (
    <View style={auxStyles.center}>
      <ActivityIndicator size="large" color={MACAU_GREEN} />
      <Text style={auxStyles.loadingText}>AI 正在获取最新数据...</Text>
      <Text style={auxStyles.loadingSubtext}>首次加载可能需要10-30秒</Text>
    </View>
  );
}

function EmptyView({ text, icon }: { text: string; icon: string }) {
  return (
    <View style={auxStyles.center}>
      <FontAwesome6 name={icon as any} size={36} color="#CBD5E1" />
      <Text style={auxStyles.emptyText}>{text}</Text>
    </View>
  );
}

const auxStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingSubtext: { fontSize: 12, color: "#B8A88A" },
  loadingText: { fontSize: 14, color: "#8B7355", fontWeight: "500" },
  emptyText: { fontSize: 14, color: "#B8A88A", fontWeight: "500" },
});

// ===== 主样式 =====
const MACAU_GOLD = "#C9A96E";
const MACAU_GREEN = "#0A5C36";
const MACAU_BLUE = "#1A6B8A";
const MACAU_RED = "#C85D3E";
const MACAU_WARM = "#FCF8F3";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MACAU_WARM,
  },

  // Hero Header - Macau Deep Green luxury
  heroHeader: {
    backgroundColor: MACAU_GREEN,
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroInner: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(201,169,110,0.85)",
    marginTop: 3,
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // Tabs - Gold accent
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 0,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  tabItemActive: {
    backgroundColor: MACAU_WARM,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.75)",
  },
  tabLabelActive: {
    color: MACAU_GREEN,
    fontWeight: "700",
  },

  // Content Area
  contentArea: {
    flex: 1,
  },
  // 键盘弹出时内容区域样式
  contentAreaKeyboardVisible: {
    flex: 1,
  },

  // Main Scroll (consult tab)
  mainScroll: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  // 键盘弹出时内容底部留空间给输入框
  mainContentKeyboard: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 80,
  },

  // AI Card - White with gold accent header
  aiCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
    marginBottom: 16,
  },
  aiCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFDF5",
    borderBottomWidth: 1,
    borderBottomColor: MACAU_GOLD,
    gap: 10,
  },
  aiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: MACAU_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
    flex: 1,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(201,169,110,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  typingText: {
    fontSize: 11,
    color: MACAU_GREEN,
    fontWeight: "600",
  },
  aiCardBody: {
    padding: 18,
    minHeight: 120,
  },
  aiResponseText: {
    fontSize: 15,
    color: "#2D2A3D",
    lineHeight: 24,
    fontWeight: "400",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#8B7355",
    fontWeight: "500",
  },
  emptySubtext: {
    fontSize: 12,
    color: "#B8A88A",
  },

  // Recommendation Section - Gold themed
  recoSection: {
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: MACAU_GOLD,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  recoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  recoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: "rgba(201,169,110,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: MACAU_GOLD,
    fontWeight: "600",
  },
  recoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCF8F3",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: MACAU_GOLD,
  },
  recoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(201,169,110,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  recoContent: {
    flex: 1,
  },
  recoItemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  recoReason: {
    fontSize: 11,
    color: "#8B7355",
    marginTop: 2,
  },

  // FAQ Section
  faqSection: {
    marginBottom: 8,
  },
  faqTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A2E",
    marginBottom: 12,
    paddingLeft: 2,
  },
  faqGrid: {
    gap: 10,
  },
  faqCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  faqIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  faqText: {
    flex: 1,
    fontSize: 14,
    color: "#2D2A3D",
    fontWeight: "600",
  },

  // List styles (headlines/movies/concerts)
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
  },
  listCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  listCardInner: {
    padding: 16,
    gap: 6,
  },
  listCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1A2E",
    lineHeight: 22,
  },
  listCardSub: {
    fontSize: 13,
    color: "#8B7355",
    lineHeight: 18,
  },
  listCardMeta: {
    fontSize: 12,
    color: "#B8A88A",
    fontWeight: "500",
  },

  // Headline specific
  headlineImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  rankBadge: {
    position: "absolute",
    top: -8,
    left: -8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: MACAU_GREEN,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Movie specific
  moviePoster: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F59E0B",
  },

  // Concert specific
  concertImage: {
    width: "100%",
    height: 180,
    resizeMode: "cover",
  },
  priceText: {
    fontSize: 15,
    fontWeight: "700",
    color: MACAU_GREEN,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 2,
  },
  statusActive: {
    backgroundColor: "#F5F0E0",
  },
  statusEnded: {
    backgroundColor: "#FEF2F2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A5C36",
  },

  // Bottom Section
  bottomSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: MACAU_WARM,
  },
  // 键盘弹出时底部输入区域 - 绝对定位覆盖内容
  bottomSectionKeyboard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: MACAU_WARM,
    borderTopWidth: 1,
    borderTopColor: MACAU_GOLD,
    shadowColor: MACAU_GREEN,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },

  // Ask Button (collapsed) - Gold styled
  askButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: MACAU_GOLD,
  },
  askButtonText: {
    fontSize: 15,
    color: MACAU_GOLD,
    fontWeight: "700",
  },

  // Input Row (expanded)
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1A1A2E",
    maxHeight: 100,
    borderWidth: 1.5,
    borderColor: MACAU_GOLD,
    shadowColor: MACAU_GOLD,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButton: {
    width: 48,
    height: 48,
    backgroundColor: MACAU_GREEN,
    borderRadius: 14,
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
  collapseButton: {
    width: 40,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
});
