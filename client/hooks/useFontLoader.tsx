import { useEffect, useState } from 'react';
import { Font, Platform } from 'expo-font';
import { View, Text, ActivityIndicator } from 'react-native';

export function useFontLoader() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      if (Platform.OS === 'web') {
        // Web 环境：跳过字体加载，避免 FontFaceObserver 超时
        // 图标会显示为方块，但不影响应用核心功能
        setIsReady(true);
        return;
      }

      try {
        await Font.loadAsync({
          FontAwesome: require('@expo/vector-icons/build/vendor/family/FontAwesome.ttf'),
        });
      } catch (e) {
        // 忽略字体加载错误
      }
      setIsReady(true);
    }

    loadFonts();
  }, []);

  return isReady;
}

export function FontLoaderProvider({ children }: { children: React.ReactNode }) {
  const isReady = useFontLoader();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading...</Text>
      </View>
    );
  }

  return <>{children}</>;
}
