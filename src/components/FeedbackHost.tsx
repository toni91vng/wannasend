import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { askedFeedback, FeedbackContext, getAppConfig, sendFeedback } from '@/data/api';
import { supabase } from '@/lib/supabase';
import { colors, fonts, radius } from '@/lib/theme';

/**
 * Ventana de opiniones de la beta. Sale una sola vez por persona y momento (publicar, enviar, buscar,
 * abandonar una solicitud), y siempre desde "Enviar opinión" en el perfil. Se apaga con
 * app_config.beta_feedback_enabled = false.
 */

const QUESTIONS: Record<FeedbackContext, { title: string; placeholder: string }> = {
  publicar: { title: '¿Qué tal ha ido publicar tu trayecto?', placeholder: '¿Algo confuso o que cambiarías?' },
  enviar: { title: '¿Qué tal ha ido pedir tu envío?', placeholder: '¿Algo te ha hecho dudar o que cambiarías?' },
  buscar: { title: '¿Has encontrado lo que buscabas?', placeholder: '¿Qué echas en falta?' },
  abandonar_envio: { title: '¿Qué te ha frenado?', placeholder: 'Ej.: no me fío, el precio, me piden demasiados datos…' },
  general: { title: '¿Qué te parece WannaSend?', placeholder: 'Cuéntanos lo que quieras: dudas, fallos, ideas…' },
};
const FACES = ['😞', '🙁', '😐', '🙂', '😍'];

let open: ((c: FeedbackContext) => void) | null = null;
const asking = new Set<FeedbackContext>();
let lastSentAt = 0;

/** El sender ha completado su solicitud: no se le pregunta qué le ha frenado. */
export function markShipmentSent() { lastSentAt = Date.now(); }
export const sentRecently = () => Date.now() - lastSentAt < 60_000;

/**
 * Pide opinión si toca. `always` la muestra aunque ya se haya preguntado (botón del perfil).
 * `stillValid` se comprueba justo antes de mostrarla (p. ej. que el usuario siga en la pantalla).
 */
export async function askFeedback(context: FeedbackContext, opts: { always?: boolean; delayMs?: number; stillValid?: () => boolean } = {}) {
  if (asking.has(context)) return;
  asking.add(context);
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const cfg = await getAppConfig();
    if (!cfg.betaFeedback && !opts.always) return;
    if (!opts.always && (await askedFeedback()).includes(context)) return;
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (opts.stillValid && !opts.stillValid()) return;
    open?.(context);
  } catch {
    /* la opinión nunca debe molestar: si falla, no se muestra */
  } finally {
    asking.delete(context);
  }
}

export function FeedbackHost() {
  const [context, setContext] = useState<FeedbackContext | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    open = (c) => { setContext(c); setRating(null); setComment(''); setThanks(false); };
    return () => { open = null; };
  }, []);

  const close = async (submit: boolean) => {
    if (!context) return;
    if (submit) {
      setBusy(true);
      try { await sendFeedback(context, rating, comment, Constants.expoConfig?.version); } catch { /* se ignora */ }
      setBusy(false);
      setThanks(true);
      setTimeout(() => setContext(null), 1200);
    } else {
      // Cerrar sin responder también cuenta como preguntado, para no volver a molestar
      if (context !== 'general') sendFeedback(context, null, '', Constants.expoConfig?.version).catch(() => undefined);
      setContext(null);
    }
  };

  const q = context ? QUESTIONS[context] : null;
  const canSend = rating !== null || comment.trim().length > 2;

  return (
    <Modal transparent visible={!!context} animationType="slide" onRequestClose={() => close(false)}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <View style={{ backgroundColor: colors.white, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, padding: 20, paddingBottom: 32, gap: 14 }}>
          {thanks ? (
            <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.primaryDark, textAlign: 'center', paddingVertical: 24 }}>¡Gracias! Nos ayuda muchísimo 💚</Text>
          ) : (
            <>
              <View style={{ gap: 4 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primaryDark }}>BETA · TU OPINIÓN</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.text }}>{q?.title}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {FACES.map((f, i) => (
                  <Pressable key={f} onPress={() => setRating(i + 1)} accessibilityLabel={`${i + 1} de 5`}
                    style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: rating === i + 1 ? colors.primaryLight : colors.surface,
                      borderWidth: 2, borderColor: rating === i + 1 ? colors.primary : 'transparent' }}>
                    <Text style={{ fontSize: 28 }}>{f}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={comment} onChangeText={setComment} placeholder={q?.placeholder} placeholderTextColor={colors.placeholder}
                multiline maxLength={1000}
                style={{ minHeight: 80, textAlignVertical: 'top', fontFamily: fonts.regular, fontSize: 15, backgroundColor: colors.surface,
                  borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, color: colors.text }} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => close(false)} style={{ flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.textSecondary }}>Ahora no</Text>
                </Pressable>
                <Pressable disabled={!canSend || busy} onPress={() => close(true)}
                  style={{ flex: 2, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: canSend ? colors.primary : colors.border }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.white }}>{busy ? 'Enviando…' : 'Enviar'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
