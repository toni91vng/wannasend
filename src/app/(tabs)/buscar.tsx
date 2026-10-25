import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AddressField } from '@/components/AddressField';
import { Button, Card, DatePicker, H3, Label, Muted, Row, Screen, Small } from '@/components/ui';
import { useAlerts } from '@/data/hooks';
import { Place } from '@/data/types';
import { shortDate } from '@/lib/format';

const todayPlus = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

/** Buscar: primero la ruta y la fecha. Los datos del paquete se piden al enviar la solicitud. */
export default function Buscar() {
  const { data: alerts = [] } = useAlerts();
  const [from, setFrom] = useState<Place>();
  const [to, setTo] = useState<Place>();
  const [date, setDate] = useState(todayPlus(1));

  return (
    <Screen title="Buscar carrier" subtitle="Busca trayectos que pasen cerca del origen y el destino de tu paquete." back={false} tabs
      footer={<Button label="Buscar" icon="search" disabled={!from || !to}
        onPress={() => router.push({ pathname: '/resultados', params: { from: JSON.stringify(from), to: JSON.stringify(to), date } })} />}
    >
      <Card>
        <AddressField label="De" icon="location-outline" placeholder="Calle, barrio o ciudad de recogida" value={from} onChange={setFrom} />
        <AddressField label="A" icon="flag-outline" placeholder="Calle, barrio o ciudad de entrega" value={to} onChange={setTo} />
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
              <Muted style={{ flex: 1 }} numberOfLines={1}>{a.fromLabel} → {a.toLabel}</Muted>
              <Small>{a.dates.map(shortDate).join(', ')}</Small>
            </Row>
          ))}
        </Card>
      ) : null}
      <Button variant="ghost" label="Consultar FAQs" onPress={() => router.push('/faqs')} />
    </Screen>
  );
}
