import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, DatePicker, H3, Label, Muted, Row, Screen, SelectField, Small } from '@/components/ui';
import { useStore } from '@/data/store';
import { CITY_NAMES, CityName } from '@/data/types';
import { shortDate } from '@/lib/format';

/** Buscar: primero la ruta y la fecha. Los datos del paquete se piden al enviar la solicitud. */
export default function Buscar() {
  const { alerts } = useStore();
  const [from, setFrom] = useState<CityName | undefined>('Lleida');
  const [to, setTo] = useState<CityName | undefined>('Barcelona');
  const [date, setDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().slice(0, 10); });
  const ok = from && to && from !== to;

  return (
    <Screen title="Buscar carrier" subtitle="Busca trayectos que coincidan con el origen y el destino de tu paquete." back={false} tabs
      footer={<Button label="Buscar" icon="search" disabled={!ok} onPress={() => router.push({ pathname: '/resultados', params: { from: from!, to: to!, date } })} />}
    >
      <Card>
        <SelectField label="De" icon="location-outline" placeholder="Ciudad de origen" value={from} options={CITY_NAMES} onChange={setFrom} />
        <SelectField label="A" icon="flag-outline" placeholder="Ciudad de destino" value={to} options={CITY_NAMES.filter((c) => c !== from)} onChange={setTo} />
        <View>
          <Label>Cuándo</Label>
          <DatePicker value={date} onChange={setDate} />
        </View>
      </Card>
      {alerts.length ? (
        <Card>
          <H3>Mis alertas</H3>
          {alerts.map((a) => (
            <Row key={a.id} style={{ justifyContent: 'space-between' }}>
              <Muted>{a.from} → {a.to}</Muted>
              <Small>{a.dates.map(shortDate).join(', ')}</Small>
            </Row>
          ))}
        </Card>
      ) : null}
      <Button variant="ghost" label="Consultar FAQs" onPress={() => router.push('/faqs')} />
    </Screen>
  );
}
