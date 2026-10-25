import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, H3, Loading, Muted, Row, Small } from '@/components/ui';
import { getConversation, markRead, sendMessage } from '@/data/api';
import { useMessages, useProfile, useTrip } from '@/data/hooks';
import { useMe } from '@/data/session';
import { clock } from '@/lib/format';
import { run } from '@/lib/run';
import { colors, fonts, radius } from '@/lib/theme';

/** Chat en tiempo real (los mensajes nuevos llegan por la suscripción de Supabase Realtime). */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const { data: conv } = useQuery({ queryKey: ['conversation', id], queryFn: () => getConversation(id) });
  const otherId = conv ? (conv.user_a === me ? conv.user_b : conv.user_a) : undefined;
  const { data: other } = useProfile(otherId);
  const { data: trip } = useTrip(conv?.trip_id ?? undefined);
  const { data: messages } = useMessages(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const insets = useSafeAreaInsets();

  const unread = messages?.some((m) => m.senderId !== me && !m.readAt);
  useEffect(() => {
    if (unread) markRead(id, me).then(() => qc.invalidateQueries({ queryKey: ['conversations'] })).catch(() => {});
  }, [unread, id, me, qc]);

  const send = async () => {
    const v = text.trim();
    if (!v || sending) return;
    setSending(true);
    const ok = await run(() => sendMessage(id, me, v), 'No se ha enviado el mensaje');
    setSending(false);
    if (ok !== undefined) {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row gap={12} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Atrás" hitSlop={8}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>
        <Pressable onPress={() => otherId && router.push(`/usuario/${otherId}`)}><Avatar name={other?.name ?? '?'} size={40} /></Pressable>
        <View style={{ flex: 1 }}>
          <H3>{other?.name ?? ''}</H3>
          {trip ? <Small>{trip.from} → {trip.to}</Small> : null}
        </View>
      </Row>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Muted style={{ textAlign: 'center', fontSize: 13, marginBottom: 8 }}>Acuerda aquí la recogida y la entrega. No compartas datos bancarios.</Muted>
        {!messages ? <Loading /> : null}
        {messages?.map((m) => {
          const mine = m.senderId === me;
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.primary : colors.surface, borderRadius: radius.md, borderBottomRightRadius: mine ? 4 : radius.md, borderBottomLeftRadius: mine ? radius.md : 4, padding: 12 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: mine ? colors.white : colors.text }}>{m.body}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: mine ? colors.primaryLight : colors.muted, alignSelf: 'flex-end', marginTop: 4 }}>
                {clock(m.at)}{mine && m.readAt ? ' · Leído' : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <Row gap={10} style={{ padding: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Escribir aquí" placeholderTextColor={colors.placeholder} onSubmitEditing={send} returnKeyType="send" maxLength={2000}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }} />
        <Pressable onPress={send} accessibilityLabel="Enviar mensaje" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}
