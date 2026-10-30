import { StyleProp, ViewStyle } from 'react-native';
import { Field } from './ui';

/** Versión web (demo): campo de texto con formato HH:MM. */
export function TimeField({ label, value, onChange, style }: {
  label: string; value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle>;
}) {
  const ok = /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return <Field style={style} label={label} icon="time-outline" value={value} onChangeText={onChange} maxLength={5} placeholder="19:00" error={value && !ok ? 'Formato HH:MM' : ''} />;
}
