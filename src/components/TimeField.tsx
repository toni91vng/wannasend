import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/lib/theme';
import { Label, st } from './ui';

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};
const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Hora con el reloj nativo del móvil (Android: reloj de Material; iOS: rueda). Valor en formato HH:MM. */
export function TimeField({ label, value, onChange, style }: {
  label: string; value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle>;
}) {
  const [iosOpen, setIosOpen] = useState(false);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value), mode: 'time', is24Hour: true, minuteInterval: 5 as never,
        onChange: (event, date) => { if (event.type === 'set' && date) onChange(toHHMM(date)); },
      });
    } else {
      setIosOpen((o) => !o);
    }
  };

  return (
    <View style={style}>
      <Label>{label}</Label>
      <Pressable onPress={open} style={st.input} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`}>
        <Ionicons name="time-outline" size={20} color={colors.primaryDark} />
        <Text style={st.inputText}>{value}</Text>
      </Pressable>
      {Platform.OS === 'ios' && iosOpen ? (
        <RNDateTimePicker value={toDate(value)} mode="time" display="spinner" locale="es-ES" minuteInterval={5}
          onChange={(_, date) => { if (date) onChange(toHHMM(date)); }} />
      ) : null}
    </View>
  );
}
