import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AddressField } from '@/components/AddressField';
import {
  Badge, Button, Card, Checkbox, Chips, DatePicker, Divider, Field, H3, InfoBox, KeyValue, Label, Muted, Row, Screen,
  Small, Stepper, Steps,
} from '@/components/ui';
import { publishTrip } from '@/data/api';
import { PackageSize, Place, SIZES } from '@/data/types';
import { longDate } from '@/lib/format';
import { breakdown, distanceKm, euros, rangeCents, suggestedCents } from '@/lib/pricing';
import { run } from '@/lib/run';
import { colors, fonts } from '@/lib/theme';

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const at = (date: string, time: string) => new Date(`${date}T${time}:00`);

/** Publicar trayecto (carrier) en 4 pasos. El servidor vuelve a validar distancia y precio. */
export default function Publicar() {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<Place>();
  const [to, setTo] = useState<Place>();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departure, setDeparture] = useState('19:00');
  const [arrival, setArrival] = useState('20:50');
  const [maxSize, setMaxSize] = useState<PackageSize>('Mediano');
  const [capacity, setCapacity] = useState(3);
  const [maxWeightKg, setMaxWeight] = useState(10);
  const [priceCents, setPrice] = useState(0);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const km = from && to ? distanceKm(from, to) : 0;
  const suggested = km ? suggestedCents(km, maxSize) : 0;
  const range = rangeCents(suggested);
  useEffect(() => { setPrice(Math.min(Math.max(suggested, range.min), range.max)); }, [suggested]); // eslint-disable-line react-hooks/exhaustive-deps

  const departureAt = isTime(departure) ? at(date, departure) : null;
  let arrivalAt = isTime(arrival) ? at(date, arrival) : null;
  if (departureAt && arrivalAt && arrivalAt <= departureAt) arrivalAt = new Date(arrivalAt.getTime() + 86400_000); // llega al día siguiente
  const future = !!departureAt && departureAt.getTime() > Date.now() + 30 * 60_000;

  const can = [
    !!from && !!to && km >= 5,
    !!departureAt && !!arrivalAt && future,
    priceCents >= range.min && priceCents <= range.max,
    agree,
  ][step - 1];

  const publish = async () => {
    setBusy(true);
    const id = await run(() => publishTrip({ from: from!, to: to!, departureAt: departureAt!, arrivalAt: arrivalAt!, capacity, maxSize, maxWeightKg, priceCents }), 'No se ha podido publicar');
    setBusy(false);
    if (!id) return;
    qc.invalidateQueries({ queryKey: ['myTrips'] });
    setStep(1); setFrom(undefined); setTo(undefined); setAgree(false);
    router.push(`/publicado/${id}`);
  };

  const subtitles = ['Publica tu trayecto y transporta paquetes. Te convertirás en carrier y compartirás gastos.', '¿Cuándo sales y cuánto espacio tienes?', 'Te proponemos un precio por paquete. Puedes ajustarlo.', 'Revisa tu trayecto antes de publicarlo.'];

  return (
    <Screen title="Publicar" subtitle={subtitles[step - 1]} back={false} tabs
      footer={<Row gap={10}>
        {step > 1 ? <Button variant="secondary" label="Atrás" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        <Button label={step < 4 ? 'Continuar' : 'Publicar trayecto'} loading={busy} disabled={!can} onPress={() => (step < 4 ? setStep(step + 1) : publish())} style={{ flex: 2 }} />
      </Row>}
    >
      <Steps step={step} of={4} />

      {step === 1 ? (
        <Card>
          <AddressField label="Punto de recogida" icon="location-outline" placeholder="Desde dónde sales (calle, barrio…)" value={from} onChange={setFrom} />
          <AddressField label="Punto de entrega" icon="flag-outline" placeholder="A dónde vas" value={to} onChange={setTo} />
          {from && to && km < 5 ? <Small style={{ color: colors.danger }}>El origen y el destino están demasiado cerca.</Small> : null}
          <View><Label>Cuándo</Label><DatePicker value={date} onChange={setDate} /></View>
          <Small>Indica un punto de encuentro público y cómodo. Solo lo verán usuarios registrados.</Small>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Row gap={12}>
            <Field style={{ flex: 1 }} label="Salida" icon="time-outline" value={departure} onChangeText={setDeparture} maxLength={5} placeholder="19:00" error={departure && !isTime(departure) ? 'Formato HH:MM' : ''} />
            <Field style={{ flex: 1 }} label="Llegada aprox." icon="time-outline" value={arrival} onChangeText={setArrival} maxLength={5} placeholder="20:50" error={arrival && !isTime(arrival) ? 'Formato HH:MM' : ''} />
          </Row>
          {departureAt && !future ? <Small style={{ color: colors.danger }}>La salida debe ser al menos dentro de 30 minutos.</Small> : null}
          <View><Label>Tamaño máximo que aceptas</Label><Chips options={SIZES} value={maxSize} onChange={setMaxSize} /></View>
          <Row style={{ justifyContent: 'space-between' }}><Muted>Paquetes que puedes llevar</Muted><Stepper value={capacity} onChange={setCapacity} min={1} max={6} /></Row>
          <Row style={{ justifyContent: 'space-between' }}><Muted>Peso máximo por paquete</Muted><Stepper value={maxWeightKg} onChange={setMaxWeight} min={1} max={30} format={(n) => `${n} kg`} /></Row>
        </Card>
      ) : null}

      {step === 3 && from && to ? (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Muted>Precio por paquete</Muted>
            <Stepper big value={priceCents / 100} onChange={(v) => setPrice(Math.round(v * 100))} min={range.min / 100} max={range.max / 100} step={0.1} format={euros} />
            {Math.abs(priceCents - suggested) < 5 ? <Badge label="Precio recomendado" /> : <Button small variant="ghost" label={`Volver al recomendado (${euros(suggested / 100)})`} onPress={() => setPrice(suggested)} />}
            <Small style={{ textAlign: 'center' }}>Rango permitido: {euros(range.min / 100)} – {euros(range.max / 100)} según distancia (unos {km} km) y tamaño.</Small>
          </Card>
          <Card>
            <H3>Lo que paga el sender</H3>
            <KeyValue k="Tu aportación" v={euros(priceCents / 100)} />
            <KeyValue k="Gastos de gestión e IVA" v={euros(breakdown(priceCents / 100).fees)} />
            <Divider />
            <KeyValue k="Total" v={euros(breakdown(priceCents / 100).total)} bold />
            <InfoBox icon="wallet-outline">Con {capacity} paquete{capacity > 1 ? 's' : ''} ganarías hasta {euros((priceCents * capacity) / 100)}</InfoBox>
          </Card>
        </>
      ) : null}

      {step === 4 && from && to ? (
        <>
          <Card>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{longDate(date)}</Text>
            <KeyValue k={`${departure}  Salida`} v={from.label} />
            <KeyValue k={`${arrival}  Llegada`} v={to.label} />
            <Divider />
            <KeyValue k="Paquetes" v={`Hasta ${capacity}`} />
            <KeyValue k="Tamaño máximo" v={maxSize} />
            <KeyValue k="Peso máximo" v={`${maxWeightKg} kg`} />
            <KeyValue k="Precio por paquete" v={euros(priceCents / 100)} accent />
          </Card>
          <Checkbox checked={agree} onChange={setAgree}>
            <Muted>Revisaré cada paquete al recogerlo y no transportaré objetos prohibidos.</Muted>
          </Checkbox>
        </>
      ) : null}
    </Screen>
  );
}
