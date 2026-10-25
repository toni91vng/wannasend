import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar, Body, Divider, EmptyState, H3, Row, Screen, Small } from '@/components/ui';
import { ME, useDerived, useStore } from '@/data/store';
import { clock } from '@/lib/format';
import { colors, fonts } from '@/lib/theme';

export default function Mensajes() {
  const { conversations } = useStore();
  const { user, trip } = useDerived();
  const list = [...conversations].sort((a, b) => (b.messages.at(-1)?.at ?? 0) - (a.messages.at(-1)?.at ?? 0));

  return (
    <Screen title="Mensajes" back={false} tabs>
      {!list.length ? <EmptyState icon="chatbubbles-outline" title="Sin mensajes" text="Pregunta más información sobre el envío y acuerda la entrega con el carrier." /> : null}
      <View>
        {list.map((c) => {
          const u = user(c.userId);
          const t = c.tripId ? trip(c.tripId) : undefined;
          const last = c.messages.at(-1);
          return (
            <View key={c.id}>
              <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Row gap={12} style={{ paddingVertical: 14 }}>
                  <Avatar name={u.name} size={48} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <H3 numberOfLines={1} style={{ flex: 1 }}>{u.name}</H3>
                      {last ? <Small style={{ color: c.unread ? colors.primaryDark : colors.muted }}>{clock(last.at)}</Small> : null}
                    </Row>
                    <Small style={{ color: colors.primaryDark, fontFamily: fonts.medium }}>{t ? `${t.from} → ${t.to}` : 'Ayuda'}</Small>
                    <Row>
                      <Body numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: c.unread ? fonts.semibold : fonts.regular, color: c.unread ? colors.text : colors.textSecondary }}>
                        {last ? (last.fromId === ME ? 'Tú: ' : '') + last.text : 'Escribe el primer mensaje'}
                      </Body>
                      {c.unread ? (
                        <View style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                          <Small style={{ color: colors.white, fontFamily: fonts.semibold }}>{c.unread}</Small>
                        </View>
                      ) : null}
                    </Row>
                  </View>
                </Row>
              </Pressable>
              <Divider />
            </View>
          );
        })}
      </View>
    </Screen>
  );
}
