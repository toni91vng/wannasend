import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AddressField } from '@/components/AddressField';
import { Button, Card, DatePicker, Divider, Label, Screen, ToggleRow } from '@/components/ui';
import { addAlert } from '@/data/api';
import { useMe } from '@/data/session';
import { Place } from '@/data/types';
import { notify } from '@/lib/notify';
import { run } from '@/lib/run';

export default function CrearAlerta() {
  const params = useLocalSearchParams<{ from?: string; to?: string; date?: string }>();
  const me = useMe();
  const qc = useQueryClient();
  const [from, setFrom] = useState<Place | undefined>(params.from ? JSON.parse(params.from) : undefined);
  const [to, setTo] = useState<Place | undefined>(params.to ? JSON.parse(params.to) : undefined);
  const [dates, setDates] = useState<string[]>(params.date ? [params.date] : []);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (d: string) => setDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));

  const save = async () => {
    setBusy(true);
    const ok = await run(() => addAlert(me, { from: from!, to: to!, dates, push, email }));
    setBusy(false);
    if (ok === undefined) return;
    qc.invalidateQueries({ queryKey: ['alerts'] });
    notify('Alerta creada', `Te avisaremos cuando alguien publique un trayecto que pase cerca.`);
    router.dismissAll();
  };

  return (
    <Screen title="Crear alerta" subtitle="Te avisamos cuando aparezca un trayecto que encaje."
      footer={<Button label="Guardar alerta" loading={busy} disabled={!from || !to || !dates.length || (!push && !email)} onPress={save} />}
    >
      <Card>
        <AddressField label="De" icon="location-outline" placeholder="Origen" value={from} onChange={setFrom} />
        <AddressField label="A" icon="flag-outline" placeholder="Destino" value={to} onChange={setTo} />
        <View><Label>Fechas (puedes elegir varias)</Label><DatePicker multi value={dates} onChange={toggle} /></View>
        <Divider />
        <ToggleRow title="Notificación push" subtitle="Al momento en tu móvil" value={push} onChange={setPush} />
        <ToggleRow title="Email" subtitle="Resumen diario" value={email} onChange={setEmail} />
      </Card>
    </Screen>
  );
}
