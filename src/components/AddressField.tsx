import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { placeDetails, placesAutocomplete, PlacesUnavailable } from '@/data/api';
import { Place } from '@/data/types';
import { colors, fonts, radius } from '@/lib/theme';
import { IconName, Label, Small, st } from './ui';

// Ciudades de respaldo mientras el buscador de Google no esté activado
const FALLBACK: Place[] = [
  { label: 'Lleida', city: 'Lleida', lat: 41.6176, lng: 0.62 },
  { label: 'Barcelona', city: 'Barcelona', lat: 41.3874, lng: 2.1686 },
  { label: 'Tarragona', city: 'Tarragona', lat: 41.1189, lng: 1.2445 },
  { label: 'Girona', city: 'Girona', lat: 41.9794, lng: 2.8214 },
  { label: 'Zaragoza', city: 'Zaragoza', lat: 41.6488, lng: -0.8891 },
  { label: 'Valencia', city: 'Valencia', lat: 39.4699, lng: -0.3763 },
  { label: 'Madrid', city: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { label: 'Sitges', city: 'Sitges', lat: 41.2372, lng: 1.8059 },
  { label: 'Vilanova i la Geltrú', city: 'Vilanova i la Geltrú', lat: 41.2241, lng: 1.7256 },
  { label: 'Milano', city: 'Milano', lat: 45.4642, lng: 9.19 },
];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type Suggestion = { key: string; main: string; secondary: string; placeId?: string; place?: Place };

/** Buscador de direcciones tipo Google Maps. */
export function AddressField({ label, icon, placeholder, value, onChange }: {
  label?: string; icon?: IconName; placeholder: string; value?: Place; onChange: (p: Place | undefined) => void;
}) {
  const [text, setText] = useState(value?.label ?? '');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [focused, setFocused] = useState(false);
  const session = useRef(Crypto.randomUUID());
  const seq = useRef(0);

  useEffect(() => { setText(value?.label ?? ''); }, [value?.label]);

  useEffect(() => {
    if (!focused || (value && text === value.label)) return;
    const q = text.trim();
    if (q.length < 2) { setItems([]); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      if (fallback) {
        setItems(FALLBACK.filter((c) => norm(c.label).includes(norm(q))).map((c) => ({ key: c.label, main: c.label, secondary: 'Ciudad', place: c })));
        return;
      }
      setLoading(true);
      try {
        const res = await placesAutocomplete(q, session.current);
        if (my === seq.current) setItems(res.map((r) => ({ key: r.placeId, main: r.main, secondary: r.secondary, placeId: r.placeId })));
      } catch (e) {
        if (e instanceof PlacesUnavailable) {
          setFallback(true);
          setItems(FALLBACK.filter((c) => norm(c.label).includes(norm(q))).map((c) => ({ key: c.label, main: c.label, secondary: 'Ciudad', place: c })));
        }
      } finally {
        if (my === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [text, focused, fallback]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = async (s: Suggestion) => {
    setItems([]);
    setFocused(false);
    if (s.place) { onChange(s.place); setText(s.place.label); return; }
    setLoading(true);
    try {
      const p = await placeDetails(s.placeId!, session.current);
      const place = { ...p, label: [s.main, p.city && !s.main.includes(p.city) ? p.city : ''].filter(Boolean).join(', ') || p.label };
      onChange(place);
      setText(place.label);
    } catch {
      setFallback(true);
    } finally {
      setLoading(false);
      session.current = Crypto.randomUUID(); // una sesión por búsqueda (así Google cobra menos)
    }
  };

  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <View style={st.input}>
        {icon ? <Ionicons name={icon} size={20} color={colors.primaryDark} /> : null}
        <TextInput
          value={text}
          onChangeText={(v) => { setText(v); if (value) onChange(undefined); }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          style={st.inputText}
          autoCorrect={false}
          accessibilityLabel={label ?? placeholder}
        />
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : value ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
      </View>
      {items.length && focused ? (
        <View style={{ marginTop: 4, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {items.map((s) => (
            <Pressable key={s.key} onPress={() => pick(s)} style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: pressed ? colors.surface : colors.white })}>
              <Ionicons name="location-outline" size={18} color={colors.muted} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.text }}>{s.main}</Text>
                {s.secondary ? <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary }}>{s.secondary}</Text> : null}
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
      {fallback && focused ? <Small style={{ marginTop: 4 }}>Buscador de direcciones pendiente de activar: de momento, elige una ciudad.</Small> : null}
    </View>
  );
}
