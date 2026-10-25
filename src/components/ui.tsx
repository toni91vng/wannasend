import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text, TextInput,
  TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '@/lib/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

/* ---------- Texto ---------- */
type TxtProps = { children: React.ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number; onPress?: () => void };
const mk = (base: TextStyle) => ({ children, style, ...rest }: TxtProps) => <Text style={[base, style]} {...rest}>{children}</Text>;
export const H1 = mk({ fontFamily: fonts.semibold, fontSize: 30, color: colors.text, textAlign: 'center' });
export const H2 = mk({ fontFamily: fonts.semibold, fontSize: 20, color: colors.text });
export const H3 = mk({ fontFamily: fonts.semibold, fontSize: 16, color: colors.text });
export const Body = mk({ fontFamily: fonts.medium, fontSize: 15, color: colors.text, lineHeight: 21 });
export const Muted = mk({ fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, lineHeight: 20 });
export const Small = mk({ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary });
export const Label = mk({ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 });

/* ---------- Pantalla ---------- */
export function Screen({
  title, subtitle, back = true, children, scroll = true, footer, right, tabs,
}: {
  title?: string; subtitle?: string; back?: boolean; tabs?: boolean; children: React.ReactNode;
  scroll?: boolean; footer?: React.ReactNode; right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12 }}>
      <View style={st.headerRow}>
        <View style={st.headerSide}>
          {back && router.canGoBack() ? (
            <Pressable accessibilityLabel="Atrás" onPress={() => router.back()} style={st.back} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.white} />
            </Pressable>
          ) : null}
        </View>
        <H1 style={{ flex: 1 }} numberOfLines={1}>{title}</H1>
        <View style={[st.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
      {subtitle ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{subtitle}</Muted> : null}
    </View>
  ) : <View style={{ height: insets.top }} />;
  const content = <View style={{ padding: 16, gap: 14 }}>{children}</View>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>{content}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
      {footer ? <View style={{ padding: 16, paddingBottom: 16 + (tabs ? 0 : insets.bottom), gap: 10 }}>{footer}</View> : null}
    </View>
  );
}

/* ---------- Contenedores ---------- */
export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const inner = <View style={[st.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>{inner}</Pressable> : inner;
}
export const Row = ({ children, style, gap = 8 }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);
export const Divider = () => <View style={{ height: 1, backgroundColor: colors.border }} />;

export function KeyValue({ k, v, accent, bold }: { k: string; v: string; accent?: boolean; bold?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Body style={{ color: bold ? colors.text : colors.textSecondary, fontFamily: bold ? fonts.semibold : fonts.medium, flexShrink: 1 }}>{k}</Body>
      <Body style={{ fontFamily: fonts.semibold, color: accent ? colors.primaryDark : colors.text }}>{v}</Body>
    </Row>
  );
}

/* ---------- Botones ---------- */
export function Button({
  label, onPress, variant = 'primary', icon, disabled, loading, small, style, color: colorOverride,
}: {
  label: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'neutral';
  icon?: IconName; disabled?: boolean; loading?: boolean; small?: boolean; style?: StyleProp<ViewStyle>; color?: string;
}) {
  const color = colorOverride ?? (variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : variant === 'neutral' ? colors.textSecondary : colors.primaryDark);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        st.btn,
        small && { paddingVertical: 10 },
        variant === 'primary' && { backgroundColor: colors.primary },
        (variant === 'secondary' || variant === 'neutral' || variant === 'danger') && { borderWidth: 1.5, borderColor: color },
        variant === 'ghost' && { paddingVertical: 6 },
        (disabled || pressed) && { opacity: disabled ? 0.45 : 0.8 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : (
        <Row gap={8}>
          {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
          <Text style={{ fontFamily: fonts.semibold, fontSize: small ? 14 : 16, color }}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

/* ---------- Formularios ---------- */
export function Field({ label, icon, right, error, style, ...props }: TextInputProps & { label?: string; icon?: IconName; right?: React.ReactNode; error?: string }) {
  return (
    <View style={style as StyleProp<ViewStyle>}>
      {label ? <Label>{label}</Label> : null}
      <View style={[st.input, error ? { borderColor: colors.danger } : null, props.multiline ? { alignItems: 'flex-start', minHeight: 96 } : null]}>
        {icon ? <Ionicons name={icon} size={20} color={colors.primaryDark} /> : null}
        <TextInput placeholderTextColor={colors.placeholder} style={st.inputText} {...props} />
        {right}
      </View>
      {error ? <Small style={{ color: colors.danger, marginTop: 4 }}>{error}</Small> : null}
    </View>
  );
}

/** Selector que abre una lista simple de opciones (evita depender de pickers nativos). */
export function SelectField<T extends string>({ label, icon, value, placeholder, options, onChange }: {
  label?: string; icon?: IconName; value?: T; placeholder: string; options: readonly T[]; onChange: (v: T) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <Pressable onPress={() => setOpen((o) => !o)} style={st.input} accessibilityRole="button">
        {icon ? <Ionicons name={icon} size={20} color={colors.primaryDark} /> : null}
        <Text style={[st.inputText, { color: value ? colors.text : colors.placeholder }]}>{value ?? placeholder}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={st.dropdown}>
          {options.map((o) => (
            <Pressable key={o} onPress={() => { onChange(o); setOpen(false); }} style={st.option}>
              <Body style={{ fontFamily: o === value ? fonts.semibold : fonts.medium, color: o === value ? colors.primaryDark : colors.text }}>{o}</Body>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({ options, value, onChange, multi }: {
  options: readonly T[]; value: T | T[] | undefined; onChange: (v: T) => void; multi?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((o) => {
        const on = multi ? (value as T[] | undefined)?.includes(o) : value === o;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[st.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: on ? colors.white : colors.text }}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 10, step = 1, format = String, big }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (n: number) => string; big?: boolean;
}) {
  const b = (label: string, sign: number) => { const d = sign * step; return (
    <Pressable accessibilityLabel={label === '−' ? 'Menos' : 'Más'} disabled={value + d < min || value + d > max} onPress={() => onChange(+(value + d).toFixed(2))} style={[st.stepBtn, (value + d < min || value + d > max) && { opacity: 0.35 }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{label}</Text>
    </Pressable>
  ); };
  return <Row gap={big ? 20 : 14}>{b('−', -1)}<H3 style={{ minWidth: 28, textAlign: 'center', fontSize: big ? 36 : 16 }}>{format(value)}</H3>{b('+', 1)}</Row>;
}

export function ToggleRow({ title, subtitle, value, onChange }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}><H3 style={{ fontSize: 15 }}>{title}</H3>{subtitle ? <Small>{subtitle}</Small> : null}</View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} thumbColor={colors.white} />
    </Row>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={() => onChange(!checked)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[st.check, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/** Próximos 14 días como chips (funciona igual en Android, iOS y web). */
export function DatePicker({ value, onChange, multi }: { value: string | string[]; onChange: (v: string) => void; multi?: boolean }) {
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {days.map((d, i) => {
        const on = multi ? (value as string[]).includes(d) : value === d;
        const date = new Date(d + 'T12:00:00');
        return (
          <Pressable key={d} onPress={() => onChange(d)} style={[st.day, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: on ? colors.white : colors.textSecondary }}>
              {i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : date.toLocaleDateString('es-ES', { weekday: 'short' })}
            </Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: on ? colors.white : colors.text }}>{date.getDate()}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: on ? colors.white : colors.textSecondary }}>
              {date.toLocaleDateString('es-ES', { month: 'short' })}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border }}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} accessibilityRole="tab" accessibilityState={{ selected: o === value }}
          style={{ flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center', backgroundColor: o === value ? colors.white : 'transparent', ...(o === value ? shadow : {}) }}>
          <Text style={{ fontFamily: o === value ? fonts.semibold : fonts.medium, fontSize: 14, color: o === value ? colors.primaryDark : colors.textSecondary }}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function MenuRow({ icon, label, value, onPress, danger }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, opacity: pressed ? 0.6 : 1 }]}>
      {icon ? <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.primaryDark} /> : null}
      <Body style={{ flex: 1, color: danger ? colors.danger : colors.text }}>{label}</Body>
      {value ? <Small style={{ fontSize: 13 }}>{value}</Small> : null}
      {!danger ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

/* ---------- Elementos ---------- */
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: size * 0.4, color: colors.primaryDark }}>{name[0]}</Text>
    </View>
  );
}

export function Badge({ label, tone = 'green' }: { label: string; tone?: 'green' | 'amber' | 'gray' | 'red' }) {
  const map = { green: [colors.primaryLight, colors.primaryDark], amber: [colors.warningLight, colors.warning], gray: [colors.surface, colors.textSecondary], red: ['#FBE9E8', colors.danger] } as const;
  const [bg, fg] = map[tone];
  return <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' }}><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: fg }}>{label}</Text></View>;
}

export function Rating({ value, reviews }: { value: number; reviews?: number }) {
  if (!value) return <Small>Sin valoraciones</Small>;
  return (
    <Row gap={4}>
      <Ionicons name="star" size={13} color={colors.primary} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{value.toFixed(1).replace('.', ',')}/5</Text>
      {reviews !== undefined ? <Small>· {reviews} opiniones</Small> : null}
    </Row>
  );
}

export function Steps({ step, of }: { step: number; of: number }) {
  return (
    <View style={{ gap: 6 }}>
      <Row gap={6}>{Array.from({ length: of }, (_, i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < step ? colors.primary : colors.border }} />)}</Row>
      <Small>Paso {step} de {of}</Small>
    </View>
  );
}

export function InfoBox({ icon = 'information-circle-outline', children, tone = 'green' }: { icon?: IconName; children: React.ReactNode; tone?: 'green' | 'amber' }) {
  const fg = tone === 'green' ? colors.primaryDark : colors.warning;
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: tone === 'green' ? colors.primaryLight : colors.warningLight, alignItems: 'center' }}>
      <Ionicons name={icon} size={22} color={fg} />
      <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: fg }}>{children}</Text>
    </View>
  );
}

export function BigIcon({ name, tone = 'green', size = 96 }: { name: IconName; tone?: 'green' | 'amber'; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: tone === 'green' ? colors.primaryLight : colors.warningLight }}>
      <Ionicons name={name} size={size * 0.5} color={tone === 'green' ? colors.primary : colors.warning} />
    </View>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
      <BigIcon name={icon} />
      <H2 style={{ textAlign: 'center' }}>{title}</H2>
      <Muted style={{ textAlign: 'center' }}>{text}</Muted>
      {children ? <View style={{ alignSelf: 'stretch', gap: 8 }}>{children}</View> : null}
    </Card>
  );
}

export const st = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerSide: { width: 40 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#D9D9D9', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.white, borderRadius: radius.sm, padding: 16, gap: 12, ...shadow },
  btn: { paddingVertical: 15, paddingHorizontal: 16, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 14, minHeight: 50 },
  inputText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 12 },
  dropdown: { marginTop: 4, backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  option: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  check: { width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  day: { width: 62, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 2 },
});

/* ---------- Estados de carga ---------- */
export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
      <ActivityIndicator color={colors.primary} />
      <Small>{label}</Small>
    </View>
  );
}

export function ErrorBox({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <View style={{ padding: 14, borderRadius: radius.sm, backgroundColor: '#FBE9E8', gap: 8 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.danger }}>{text}</Text>
      {onRetry ? <Button small variant="danger" label="Reintentar" onPress={onRetry} /> : null}
    </View>
  );
}
