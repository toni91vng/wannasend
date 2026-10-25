import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, ScrollViewInstance, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, H3, Muted, Row, Small } from '@/components/ui';
import { ME, useDerived, useStore } from '@/data/store';
import { clock } from '@/lib/format';
import { colors, fonts, radius } from '@/lib/theme';

// Respuestas simuladas mientras no hay backend
const REPLIES = ['¡Perfecto!', 'Me va bien, nos vemos allí.', 'Genial, te escribo cuando salga.', 'Sin problema 👍', '¿Me confirmas el tamaño del paquete?'];

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversations, sendMessage, receiveMessage, markRead } = useStore();
  const { user, trip } = useDerived();
  const conv = conversations.find((c) => c.id === id)!;
  const other = user(conv.userId);
  const t = conv.tripId ? trip(conv.tripId) : undefined;
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => { if (conv.unread) markRead(conv.id); }, [conv.unread]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const v = text.trim();
    if (!v) return;
    sendMessage(conv.id, v);
    setText('');
    if (conv.userId !== 'soporte') {
      setTyping(true);
      setTimeout(() => { setTyping(false); receiveMessage(conv.id, conv.userId, REPLIES[Math.floor(Math.random() * REPLIES.length)]); }, 1500);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Row gap={12} style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Atrás" hitSlop={8}><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>
        <Pressable onPress={() => router.push(`/usuario/${other.id}`)}><Avatar name={other.name} size={40} /></Pressable>
        <View style={{ flex: 1 }}>
          <H3>{other.name}</H3>
          <Small>{typing ? 'escribiendo…' : t ? `${t.from} → ${t.to}` : 'Ayuda'}</Small>
        </View>
      </Row>
      <ScrollView ref={scroll} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Muted style={{ textAlign: 'center', fontSize: 13, marginBottom: 8 }}>Pregunta más información sobre el envío y acuerda la entrega.</Muted>
        {conv.messages.map((m) => {
          const mine = m.fromId === ME;
          return (
            <View key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.primary : colors.surface, borderRadius: radius.md, borderBottomRightRadius: mine ? 4 : radius.md, borderBottomLeftRadius: mine ? radius.md : 4, padding: 12 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: mine ? colors.white : colors.text }}>{m.text}</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: mine ? colors.primaryLight : colors.muted, alignSelf: 'flex-end', marginTop: 4 }}>{clock(m.at)}</Text>
            </View>
          );
        })}
      </ScrollView>
      <Row gap={10} style={{ padding: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: colors.border }}>
        <TextInput value={text} onChangeText={setText} placeholder="Escribir aquí" placeholderTextColor={colors.placeholder} onSubmitEditing={send} returnKeyType="send"
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: colors.border }} />
        <Pressable onPress={send} accessibilityLabel="Enviar mensaje" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: text.trim() ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="send" size={18} color={colors.white} />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}
