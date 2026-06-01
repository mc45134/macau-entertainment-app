import { AuthProvider } from '@/contexts/AuthContext';
import { type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WebOnlyColorSchemeUpdater } from './ColorSchemeUpdater';
import { WebOnlyPrettyScrollbar } from './PrettyScrollbar'
import { HeroUINativeProvider } from '@/heroui';
import { FontLoaderProvider } from '@/hooks/useFontLoader';

function Provider({ children }: { children: ReactNode }) {
  return (
    <FontLoaderProvider>
      <WebOnlyColorSchemeUpdater>
        <WebOnlyPrettyScrollbar>
          <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <HeroUINativeProvider>
                {children}
              </HeroUINativeProvider>
            </GestureHandlerRootView>
          </AuthProvider>
        </WebOnlyPrettyScrollbar>
      </WebOnlyColorSchemeUpdater>
    </FontLoaderProvider>
  );
}

export {
  Provider,
}
