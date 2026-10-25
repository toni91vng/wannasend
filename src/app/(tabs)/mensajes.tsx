import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Avatar, Body, Divider, EmptyState, ErrorBox, H3, Loading, Row, Screen, Small } from '@/components/ui';
import { useConversations } from '@/data/hooks';
import { clock } from '@/lib/format';
import { errorText } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';

export default function Mensajes() {
  const { data: list, isLoading, error, refetch } = useConversations();

  return (
    <Screen title="Mensajes" back={false} tabs>
      {isLoading ? <Loading /> : null}
      {error ? <ErrorBox text={errorText(error)} onRetry={() => refetch()} /> : null}
      {list && !list.length ? <EmptyState icon="chatbubbles-outline" title="Sin mensajes" text="Desde un trayecto o un envío puedes escribir al carrier o al sender para acordar la entrega." /> : null}
      <View>
        {list?.map((c) => (
          <View key={c.id}>
            <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Row gap={12} style={{ paddingVertical: 14 }}>
                <Avatar name={c.otherName} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <H3 numberOfLines={1} style={{ flex: 1 }}>{c.otherName}</H3>
                    <Small style={{ color: c.unread ? colors.primaryDark : colors.muted }}>{clock(c.lastAt)}</Small>
                  </Row>
                  {c.tripLabel ? <Small style={{ color: colors.primaryDark, fontFamily: fonts.medium }}>{c.tripLabel}</Small> : null}
                  <Row>
                    <Body numberOfLines={1} style={{ flex: 1, fontSize: 14, fontFamily: c.unread ? fonts.semibold : fonts.regular, color: c.unread ? colors.text : colors.textSecondary }}>
                      {c.lastBody ? (c.lastMine ? 'Tú: ' : '') + c.lastBody : 'Escribe el primer mensaje'}
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
        ))}
      </View>
    </Screen>
  );
}
