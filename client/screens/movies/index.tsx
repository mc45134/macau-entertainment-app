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

interface Movie {
  id: string;
  title: string;
  poster: string;
  rating: number;
  genre: string;
  duration: string;
  cinema: string;
  showtimes: string[];
}

// 陶土红主题色 - 代表葡式建筑屋顶瓦片
const THEME = {
  primary: "#C85D3E",
  primaryDark: "#A0472E",
  bg: "#FCF8F3",
  gold: "#C9A96E",
  goldLight: "#F5F0E0",
  text: "#1A1A2E",
  textMuted: "#8B7355",
  textLight: "#B8A88A",
  white: "#FFFFFF",
};

export default function MoviesScreen() {
  const insets = useSafeAreaInsets();
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMovies = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/entertainment/movies`);
      const data = await response.json();
      if (data.code === 0 && data.data.movies) {
        setMovies(data.data.movies);
      }
    } catch (error) {
      console.error("Failed to fetch movies:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMovies();
    }, [fetchMovies])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMovies();
  }, [fetchMovies]);

  const renderMovie = useCallback(
    ({ item }: { item: Movie }) => (
      <TouchableOpacity style={styles.movieCard} activeOpacity={0.8}>
        <View style={styles.posterWrap}>
          <Image source={{ uri: item.poster }} style={styles.moviePoster} />
          {/* 金色装饰角标 */}
          <View style={styles.goldCorner} />
        </View>
        <View style={styles.movieContent}>
          <Text style={styles.movieTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.ratingRow}>
            <FontAwesome6 name="star" size={13} color="#F59E0B" solid />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome6 name="film" size={11} color={THEME.textLight} />
            <Text style={styles.infoText}>{item.genre} · {item.duration}</Text>
          </View>
          <View style={styles.infoRow}>
            <FontAwesome6 name="location-dot" size={11} color={THEME.primary} />
            <Text style={styles.infoTextAccent}>{item.cinema}</Text>
          </View>
          <View style={styles.showtimesRow}>
            {item.showtimes.map((time, index) => (
              <View key={index} style={[styles.showtimeBadge, { backgroundColor: THEME.goldLight }]}>
                <Text style={[styles.showtimeText, { color: THEME.primary }]}>{time}</Text>
              </View>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    ),
    []
  );

  return (
    <Screen>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Hero Header - 陶土红 */}
        <View style={styles.heroHeader}>
          <View style={styles.heroIconWrap}>
            <FontAwesome6 name="film" size={20} color={THEME.white} />
          </View>
          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>电影推荐</Text>
            <Text style={styles.heroSub}>院线热映·光影澳门</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.primary} />
          </View>
        ) : (
          <FlatList
            data={movies}
            renderItem={renderMovie}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <FontAwesome6 name="clapperboard" size={48} color={THEME.textLight} />
                <Text style={styles.emptyText}>暂无电影推荐</Text>
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

  // Hero Header
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
    color: "rgba(255,255,255,0.7)",
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

  // Movie Card
  movieCard: {
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
    overflow: "hidden",
    position: "relative",
  },
  goldCorner: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    backgroundColor: THEME.gold,
    opacity: 0.8,
  },
  moviePoster: {
    width: 110,
    height: 160,
  },
  movieContent: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
  },
  movieTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.text,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#F59E0B",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  infoText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  infoTextAccent: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: "600",
  },
  showtimesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  showtimeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  showtimeText: {
    fontSize: 11,
    fontWeight: "600",
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