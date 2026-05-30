import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Screen } from "@/components/Screen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FontAwesome6 } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || "http://localhost:9091";

interface Headline {
  id: string;
  title: string;
  summary: string;
  image: string;
  publishTime: string;
  category: string;
}

// 葡式蓝主题色 - 代表澳门葡萄牙文化
const THEME = {
  primary: "#1A6B8A",
  primaryDark: "#0F4A60",
  bg: "#FCF8F3",
  gold: "#C9A96E",
  goldLight: "#F5F0E0",
  text: "#1A1A2E",
  textMuted: "#8B7355",
  textLight: "#B8A88A",
  white: "#FFFFFF",
};

export default function HeadlinesScreen() {
  const insets = useSafeAreaInsets();
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHeadlines = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/entertainment/headlines`);
      const data = await response.json();
      if (data.code === 0 && data.data.headlines) {
        setHeadlines(data.data.headlines);
      }
    } catch (error) {
      console.error("Failed to fetch headlines:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHeadlines();
    }, [fetchHeadlines])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHeadlines();
  }, [fetchHeadlines]);

  const renderHeadline = useCallback(
    ({ item, index }: { item: Headline; index: number }) => (
      <TouchableOpacity style={styles.headlineCard} activeOpacity={0.8}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.image }} style={styles.headlineImage} />
          {/* 葡式瓷砖风格装饰角标 */}
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>{index + 1}</Text>
          </View>
          {/* 金色装饰线 */}
          <View style={styles.goldLine} />
        </View>
        <View style={styles.headlineContent}>
          <View style={[styles.categoryBadge, { backgroundColor: THEME.goldLight }]}>
            <Text style={[styles.categoryText, { color: THEME.primary }]}>{item.category}</Text>
          </View>
          <Text style={styles.headlineTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.headlineSummary} numberOfLines={2}>{item.summary}</Text>
          <View style={styles.metaRow}>
            <FontAwesome6 name="clock" size={11} color={THEME.textLight} />
            <Text style={styles.publishTime}>
              {new Date(item.publishTime).toLocaleDateString("zh-CN")}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    ),
    []
  );

  return (
    <Screen>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Hero Header - 葡萄牙蓝 */}
        <View style={styles.heroHeader}>
          {/* 装饰性葡式花纹背景 */}
          <View style={styles.heroPattern}>
            <Text style={styles.patternTile}>✦</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <FontAwesome6 name="newspaper" size={20} color={THEME.white} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>活动头条</Text>
            <Text style={styles.heroSub}>澳门热事·一手掌握</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : (
          <FlatList
            data={headlines}
            renderItem={renderHeadline}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome6 name="newspaper" size={48} color={THEME.textLight} />
                <Text style={styles.emptyText}>暂无头条内容</Text>
              </View>
            }
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },

  // Hero Header - Portuguese Blue theme
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.primary,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
    gap: 14,
    position: "relative",
    overflow: "hidden",
  },
  heroPattern: {
    position: "absolute",
    top: -10,
    right: -10,
    opacity: 0.1,
  },
  patternTile: {
    fontSize: 60,
    color: THEME.white,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: THEME.white,
    letterSpacing: 0.5,
  },
  heroSub: {
    fontSize: 12,
    color: "rgba(201,169,110,0.8)",
    marginTop: 2,
    fontWeight: "500",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Headline Card
  headlineCard: {
    backgroundColor: THEME.white,
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  imageWrap: {
    position: "relative",
  },
  headlineImage: {
    width: "100%",
    height: 200,
  },
  goldLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: THEME.gold,
  },
  rankBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: THEME.primary,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rankText: {
    fontSize: 14,
    fontWeight: "800",
    color: THEME.white,
  },
  headlineContent: {
    padding: 18,
    gap: 6,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  headlineTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: THEME.text,
    lineHeight: 24,
  },
  headlineSummary: {
    fontSize: 13,
    color: THEME.textMuted,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
  },
  publishTime: {
    fontSize: 11,
    color: THEME.textLight,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: THEME.textLight,
    fontWeight: "500",
  },
});