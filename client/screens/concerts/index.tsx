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

interface Concert {
  id: string;
  artist: string;
  venue: string;
  date: string;
  time: string;
  poster: string;
  price: string;
  status: "热卖中" | "即将开售" | "已售罄";
}

// 深翠绿主题色 - 代表澳门奢华与活力
const THEME = {
  primary: "#0A5C36",
  primaryDark: "#074026",
  bg: "#FCF8F3",
  gold: "#C9A96E",
  goldLight: "#F5F0E0",
  text: "#1A1A2E",
  textMuted: "#8B7355",
  textLight: "#B8A88A",
  white: "#FFFFFF",
};

const statusConfig: Record<string, { bg: string; color: string }> = {
  "热卖中": { bg: "#F5F0E0", color: THEME.primary },
  "即将开售": { bg: "#FFFBEB", color: "#D97706" },
  "已售罄": { bg: "#FEF2F2", color: "#DC2626" },
};

export default function ConcertsScreen() {
  const insets = useSafeAreaInsets();
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConcerts = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/entertainment/concerts`);
      const data = await response.json();
      if (data.code === 0 && data.data.concerts) {
        setConcerts(data.data.concerts);
      }
    } catch (error) {
      console.error("Failed to fetch concerts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConcerts();
    }, [fetchConcerts])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConcerts();
  }, [fetchConcerts]);

  const renderConcert = useCallback(
    ({ item }: { item: Concert }) => {
      const sc = statusConfig[item.status] || { bg: "#F5F0E0", color: THEME.textMuted };
      return (
        <TouchableOpacity style={styles.concertCard} activeOpacity={0.8}>
          <View style={styles.posterWrap}>
            <Image source={{ uri: item.poster }} style={styles.concertPoster} />
            <View style={[styles.statusTag, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.color }]}>{item.status}</Text>
            </View>
            {/* 金色底部装饰线 */}
            <View style={styles.goldLine} />
          </View>
          <View style={styles.concertContent}>
            <Text style={styles.artistName} numberOfLines={1}>{item.artist}</Text>
            <View style={styles.infoRow}>
              <FontAwesome6 name="location-dot" size={12} color={THEME.primary} />
              <Text style={styles.infoText}>{item.venue}</Text>
            </View>
            <View style={styles.infoRow}>
              <FontAwesome6 name="calendar" size={12} color={THEME.textLight} />
              <Text style={styles.infoTextMuted}>{item.date} {item.time}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{item.price}</Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    []
  );

  return (
    <Screen>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Hero Header - 深翠绿奢华风 */}
        <View style={styles.heroHeader}>
          {/* 金色装饰圆点 */}
          <View style={styles.heroDot1} />
          <View style={styles.heroDot2} />
          <View style={styles.heroIconWrap}>
            <FontAwesome6 name="music" size={20} color={THEME.white} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>演唱会查询</Text>
            <Text style={styles.heroSub}>澳门现场·声光盛宴</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : (
          <FlatList
            data={concerts}
            renderItem={renderConcert}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome6 name="music" size={48} color={THEME.textLight} />
                <Text style={styles.emptyText}>暂无演唱会信息</Text>
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

  // Hero Header - Deep Green Luxury
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
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    gap: 14,
    position: "relative",
    overflow: "hidden",
  },
  heroDot1: {
    position: "absolute",
    top: -15,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: THEME.gold,
    opacity: 0.08,
  },
  heroDot2: {
    position: "absolute",
    bottom: -20,
    right: 60,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.gold,
    opacity: 0.06,
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

  // Concert Card
  concertCard: {
    flexDirection: "row",
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
  posterWrap: {
    position: "relative",
  },
  concertPoster: {
    width: 120,
    height: 150,
  },
  goldLine: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: THEME.gold,
    opacity: 0.6,
  },
  statusTag: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  concertContent: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  artistName: {
    fontSize: 17,
    fontWeight: "700",
    color: THEME.text,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: "600",
  },
  infoTextMuted: {
    fontSize: 12,
    color: THEME.textLight,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priceText: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.primary,
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