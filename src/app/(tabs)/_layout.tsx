import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConversations } from '@/data/hooks';
import { useSession } from '@/data/session';
import { colors, fonts } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const TABS: Record<string, { label: string; icon?: IconName; brand?: boolean }> = {
  buscar: { label: 'Buscar', icon: 'search' },
  publicar: { label: 'Publicar', icon: 'add-circle-outline' },
  trayectos: { label: 'Trayectos', brand: true },
  mensajes: { label: 'Mensajes', icon: 'chatbubbles-outline' },
  perfil: { label: 'Mi perfil', icon: 'person-circle-outline' },
};

/** Barra verde del Figma. Pestaña activa en blanco con fondo más oscuro (más contraste que el gris original). */
function GreenTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { data: conversations = [] } = useConversations();
  const unread = conversations.reduce((a, c) => a + c.unread, 0);
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.primary, paddingBottom: insets.bottom + 6, paddingTop: 6, paddingHorizontal: 6 }}>
      {state.routes.map((route, i) => {
        const cfg = TABS[route.name];
        if (!cfg) return null;
        const focused = state.index === i;
        const color = focused ? colors.white : 'rgba(255,255,255,0.82)';
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={cfg.label}
            onPress={() => { if (!focused) navigateToTab(route.key); }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: focused ? colors.primaryDark : 'transparent' }}
          >
            <View>
              {cfg.brand
                ? <Text style={{ fontFamily: fonts.brand, fontSize: 22, lineHeight: 26, color }}>WS</Text>
                : <Ionicons name={cfg.icon!} size={24} color={color} style={{ height: 26 }} />}
              {route.name === 'mensajes' && unread > 0 ? (
                <View style={{ position: 'absolute', top: -2, right: -8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 10, color: colors.primaryDark }}>{unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ fontFamily: focused ? fonts.semibold : fonts.medium, fontSize: 11.5, color, marginTop: 2 }}>{cfg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { userId, loading } = useSession();
  if (!loading && !userId) return <Redirect href="/bienvenida" />;
  return (
    <Tabs tabBar={(p) => <GreenTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="buscar" />
      <Tabs.Screen name="publicar" />
      <Tabs.Screen name="trayectos" />
      <Tabs.Screen name="mensajes" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}
