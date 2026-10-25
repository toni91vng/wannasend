import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  Badge, Button, Card, Checkbox, Chips, DatePicker, Divider, Field, H3, InfoBox, KeyValue, Label, Muted, Row, Screen,
  SelectField, Small, Stepper, Steps,
} from '@/components/ui';
import { useStore } from '@/data/store';
import { CITY_NAMES, CityName, PackageSize, SIZES } from '@/data/types';
import { longDate } from '@/lib/format';
import { breakdown, distanceKm, euros, priceRange, suggestedCarrierPrice } from '@/lib/pricing';
import { colors, fonts } from '@/lib/theme';

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Publicar trayecto (carrier) en 4 pasos. */
export default function Publicar() {
  const { publishTrip } = useStore();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<CityName | undefined>();
  const [to, setTo] = useState<CityName | undefined>();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departure, setDeparture] = useState('19:00');
  const [arrival, setArrival] = useState('20:50');
  const [fromPoint, setFromPoint] = useState('');
  const [toPoint, setToPoint] = useState('');
  const [maxSize, setMaxSize] = useState<PackageSize>('Mediano');
  const [capacity, setCapacity] = useState(3);
  const [maxWeightKg, setMaxWeight] = useState(10);
  const [price, setPrice] = useState(0);
  const [agree, setAgree] = useState(false);

  const suggested = from && to ? suggestedCarrierPrice(from, to, maxSize) : 0;
  const range = priceRange(suggested);
  useEffect(() => { setPrice(suggested); }, [suggested]);

  const can = [
    !!from && !!to && from !== to,
    isTime(departure) && isTime(arrival) && fromPoint.trim().length > 1 && toPoint.trim().length > 1,
    price >= range.min && price <= range.max,
    agree,
  ][step - 1];

  const publish = () => {
    const id = publishTrip({ from: from!, to: to!, date, departure, arrival, fromPoint, toPoint, capacity, maxSize, maxWeightKg, pricePerPackage: price });
    setStep(1); setFrom(undefined); setTo(undefined); setAgree(false); setFromPoint(''); setToPoint('');
    router.push(`/publicado/${id}`);
  };

  const subtitles = ['Publica tu trayecto y transporta paquetes. Te convertirás en carrier y compartirás gastos.', '¿Cuándo sales y cuánto espacio tienes?', 'Te proponemos un precio por paquete. Puedes ajustarlo.', 'Revisa tu trayecto antes de publicarlo.'];

  return (
    <Screen title="Publicar" subtitle={subtitles[step - 1]} back={false} tabs
      footer={<Row gap={10}>
        {step > 1 ? <Button variant="secondary" label="Atrás" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button label={step < 4 ? 'Continuar' : 'Publicar trayecto'} disabled={!can} onPress={() => (step < 4 ? setStep(step + 1) : publish())} style={{ flex: 2 }} />
      </Row>}
    >
      <Steps step={step} of={4} />

      {step === 1 ? (
        <Card>
          <SelectField label="De" icon="location-outline" placeholder="Ciudad de salida" value={from} options={CITY_NAMES} onChange={setFrom} />
          <SelectField label="A" icon="flag-outline" placeholder="Ciudad de llegada" value={to} options={CITY_NAMES.filter((c) => c !== from)} onChange={setTo} />
          <View><Label>Cuándo</Label><DatePicker value={date} onChange={setDate} /></View>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Row gap={12}>
            <Field style={{ flex: 1 }} label="Salida" icon="time-outline" value={departure} onChangeText={setDeparture} maxLength={5} placeholder="19:00" error={departure && !isTime(departure) ? 'HH:MM' : ''} />
            <Field style={{ flex: 1 }} label="Llegada aprox." icon="time-outline" value={arrival} onChangeText={setArrival} maxLength={5} placeholder="20:50" error={arrival && !isTime(arrival) ? 'HH:MM' : ''} />
          </Row>
          <Field label="Punto de recogida" icon="location-outline" placeholder={`Barrio o lugar en ${from}`} value={fromPoint} onChangeText={setFromPoint} />
          <Field label="Punto de entrega" icon="flag-outline" placeholder={`Barrio o lugar en ${to}`} value={toPoint} onChangeText={setToPoint} />
          <View><Label>Tamaño máximo que aceptas</Label><Chips options={SIZES} value={maxSize} onChange={setMaxSize} /></View>
          <Row style={{ justifyContent: 'space-between' }}><Muted>Paquetes que puedes llevar</Muted><Stepper value={capacity} onChange={setCapacity} min={1} max={6} /></Row>
          <Row style={{ justifyContent: 'space-between' }}><Muted>Peso máximo por paquete</Muted><Stepper value={maxWeightKg} onChange={setMaxWeight} min={1} max={30} format={(n) => `${n} kg`} /></Row>
        </Card>
      ) : null}

      {step === 3 && from && to ? (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Muted>Precio por paquete</Muted>
            <Stepper big value={price} onChange={setPrice} min={range.min} max={range.max} step={0.1} format={euros} />
            {Math.abs(price - suggested) < 0.05 ? <Badge label="Precio recomendado" /> : <Button small variant="ghost" label={`Volver al recomendado (${euros(suggested)})`} onPress={() => setPrice(suggested)} />}
            <Small style={{ textAlign: 'center' }}>Rango permitido: {euros(range.min)} – {euros(range.max)} según distancia ({distanceKm(from, to)} km), tamaño y peso.</Small>
          </Card>
          <Card>
            <H3>Lo que paga el sender</H3>
            <KeyValue k="Tu aportación" v={euros(price)} />
            <KeyValue k="Gastos de gestión e IVA" v={euros(breakdown(price).fees)} />
            <Divider />
            <KeyValue k="Total" v={euros(breakdown(price).total)} bold />
            <InfoBox icon="wallet-outline">Con {capacity} paquete{capacity > 1 ? 's' : ''} ganarías hasta {euros(price * capacity)}</InfoBox>
          </Card>
        </>
      ) : null}

      {step === 4 && from && to ? (
        <>
          <Card>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{longDate(date)}</Text>
            <KeyValue k={`${departure}  ${from}`} v={fromPoint} />
            <KeyValue k={`${arrival}  ${to}`} v={toPoint} />
            <Divider />
            <KeyValue k="Paquetes" v={`Hasta ${capacity}`} />
            <KeyValue k="Tamaño máximo" v={maxSize} />
            <KeyValue k="Peso máximo" v={`${maxWeightKg} kg`} />
            <KeyValue k="Precio por paquete" v={euros(price)} accent />
          </Card>
          <Checkbox checked={agree} onChange={setAgree}>
            <Muted>Revisaré cada paquete al recogerlo y no transportaré objetos prohibidos.</Muted>
          </Checkbox>
        </>
      ) : null}
    </Screen>
  );
}
