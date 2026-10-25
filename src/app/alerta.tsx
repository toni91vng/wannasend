import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, DatePicker, Divider, Label, Screen, SelectField, ToggleRow } from '@/components/ui';
import { useStore } from '@/data/store';
import { CITY_NAMES, CityName } from '@/data/types';
import { notify } from '@/lib/notify';

export default function CrearAlerta() {
  const params = useLocalSearchParams<{ from?: CityName; to?: CityName; date?: string }>();
  const { addAlert } = useStore();
  const [from, setFrom] = useState<CityName | undefined>(params.from);
  const [to, setTo] = useState<CityName | undefined>(params.to);
  const [dates, setDates] = useState<string[]>(params.date ? [params.date] : []);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const toggle = (d: string) => setDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));

  return (
    <Screen title="Crear alerta" subtitle="Te avisamos cuando aparezca un trayecto que encaje."
      footer={<Button label="Guardar alerta" disabled={!from || !to || from === to || !dates.length || (!push && !email)}
        onPress={() => { addAlert({ from: from!, to: to!, dates, push, email }); notify('Alerta creada', `Te avisaremos cuando alguien publique ${from} → ${to}.`); router.dismissAll(); }} />}
    >
      <Card>
        <SelectField label="De" icon="location-outline" placeholder="Origen" value={from} options={CITY_NAMES} onChange={setFrom} />
        <SelectField label="A" icon="flag-outline" placeholder="Destino" value={to} options={CITY_NAMES.filter((c) => c !== from)} onChange={setTo} />
        <View><Label>Fechas (puedes elegir varias)</Label><DatePicker multi value={dates} onChange={toggle} /></View>
        <Divider />
        <ToggleRow title="Notificación push" subtitle="Al momento en tu móvil" value={push} onChange={setPush} />
        <ToggleRow title="Email" subtitle="Resumen diario" value={email} onChange={setEmail} />
      </Card>
    </Screen>
  );
}
