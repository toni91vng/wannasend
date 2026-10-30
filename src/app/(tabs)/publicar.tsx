import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { AddressField } from '@/components/AddressField';
import { TimeField } from '@/components/TimeField';
import {
  Badge, Button, Card, Checkbox, Chips, DatePicker, Divider, H3, InfoBox, KeyValue, Label, Muted, Row, Screen,
  Small, Stepper, Steps,
} from '@/components/ui';
import { publishTrip, routeDistance } from '@/data/api';
import { useAppConfig, useMyVerification } from '@/data/hooks';
import { PackageSize, Place, SIZES } from '@/data/types';
import { longDate } from '@/lib/format';
import { distanceKm, euros, rangeCents, suggestedCents } from '@/lib/pricing';
import { run } from '@/lib/run';
import { colors, fonts } from '@/lib/theme';

const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const at = (date: string, time: string) => new Date(`${date}T${time}:00`);

/**
 * Publicar trayecto (carrier) en 4 pasos. El servidor vuelve a validar distancia, precio y tope.
 * Tope de gastos compartidos: €/km × km por carretera. Limita lo que el carrier cobra sumando todos sus paquetes,
 * así que las plazas se calculan a partir del precio: tope ÷ precio por paquete.
 */
export default function Publicar() {
  const qc = useQueryClient();
  const { data: cfg } = useAppConfig();
  const { data: ver } = useMyVerification();
  const [step, setStep] = useState(1);
  const [from, setFrom] = useState<Place>();
  const [to, setTo] = useState<Place>();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departure, setDeparture] = useState('19:00');
  const [arrival, setArrival] = useState('20:50');
  const [arrivalTouched, setArrivalTouched] = useState(false);
  const [nextDay, setNextDay] = useState(false);
  const [maxSize, setMaxSize] = useState<PackageSize>('Mediano');
  const [capacity, setCapacity] = useState(3);
  const [maxWeightKg, setMaxWeight] = useState(10);
  const [priceCents, setPrice] = useState(0);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [route, setRoute] = useState<{ km: number; source: 'carretera' | 'estimada' }>();

  // Distancia por carretera (la calcula el servidor; si no puede, usa la estimación)
  useEffect(() => {
    setRoute(undefined);
    if (!from || !to) return;
    let alive = true;
    routeDistance(from, to)
      .then((r) => { if (alive) setRoute(r ?? { km: distanceKm(from, to), source: 'estimada' }); })
      .catch(() => { if (alive) setRoute({ km: distanceKm(from, to), source: 'estimada' }); });
    return () => { alive = false; };
  }, [from, to]);

  const km = route?.km ?? 0;
  const capPerKmCents = Math.round((cfg?.capPerKm ?? 0.26) * 100);
  const capCents = km * capPerKmCents;
  const suggested = km ? suggestedCents(km, maxSize) : 0;
  const base = rangeCents(suggested);
  const range = { min: base.min, max: Math.min(base.max, capCents) };
  const tooShort = !!km && km >= 5 && capCents < base.min;
  const minKm = Math.ceil(base.min / capPerKmCents);
  useEffect(() => { setPrice(Math.min(Math.max(suggested, range.min), range.max)); }, [suggested, capCents]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxPackages = priceCents > 0 ? Math.max(0, Math.min(6, Math.floor(capCents / priceCents))) : 0;
  useEffect(() => { if (maxPackages > 0 && capacity > maxPackages) setCapacity(maxPackages); }, [maxPackages]); // eslint-disable-line react-hooks/exhaustive-deps
  const needsPayouts = !!cfg?.carrierVerificationRequired && ver !== undefined && !ver.verified;

  // Llegada propuesta: salida + tiempo estimado (unos 80 km/h de media, redondeado a 5 minutos)
  const suggestArrival = (dep: string) => {
    if (!isTime(dep) || !km) return;
    const [h, m] = dep.split(':').map(Number);
    const mins = Math.max(15, Math.round(((km / 80) * 60) / 5) * 5);
    const total = h * 60 + m + mins;
    setNextDay(total >= 24 * 60);
    setArrival(`${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`);
  };
  const onDeparture = (v: string) => { setDeparture(v); if (!arrivalTouched) suggestArrival(v); };
  useEffect(() => { if (!arrivalTouched) suggestArrival(departure); }, [km]); // eslint-disable-line react-hooks/exhaustive-deps

  const departureAt = isTime(departure) ? at(date, departure) : null;
  let arrivalAt = isTime(arrival) ? at(date, arrival) : null;
  if (arrivalAt && nextDay) arrivalAt = new Date(arrivalAt.getTime() + 86400_000);
  const arrivalOk = !!departureAt && !!arrivalAt && arrivalAt > departureAt;
  const future = !!departureAt && departureAt.getTime() > Date.now() + 30 * 60_000;

  const can = [
    !!from && !!to && !!route && km >= 5 && !tooShort && !needsPayouts,
    !!departureAt && !!arrivalAt && arrivalOk && future,
    priceCents >= range.min && priceCents <= range.max && capacity >= 1 && capacity <= maxPackages,
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

  const subtitles = ['Publica tu trayecto y transporta paquetes. Te convertirás en carrier y compartirás gastos.', '¿Cuándo sales y qué tamaño aceptas?', 'Elige el precio por paquete y cuántos llevas, dentro de los gastos de tu viaje.', 'Revisa tu trayecto antes de publicarlo.'];

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
          {from && to && !route ? <Small>Calculando la distancia…</Small> : null}
          {route && km < 5 ? <Small style={{ color: colors.danger }}>El origen y el destino están demasiado cerca.</Small> : null}
          {tooShort ? <Small style={{ color: colors.danger }}>Este trayecto ({km} km) es demasiado corto para compartir gastos. En WannaSend se publican trayectos a partir de unos {minKm} km.</Small> : null}
          {route && !tooShort && km >= 5 ? <Small>Unos {km} km {route.source === 'carretera' ? 'por carretera' : '(estimación)'}.</Small> : null}
          <View><Label>Cuándo</Label><DatePicker value={date} onChange={setDate} /></View>
          <Small>Indica un punto de encuentro público y cómodo. Solo lo verán usuarios registrados.</Small>
        </Card>
      ) : null}
      {step === 1 && needsPayouts ? (
        <Card>
          <H3>Activa tus cobros para publicar</H3>
          <Muted>Todos los carriers de WannaSend tienen la identidad verificada. Se hace una sola vez con Stripe, al configurar dónde recibes tu dinero.</Muted>
          <Button small label="Configurar cobros" icon="shield-checkmark-outline" onPress={() => router.push('/ganancias')} />
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <Row gap={12} style={{ alignItems: 'flex-start' }}>
            <TimeField style={{ flex: 1 }} label="Salida" value={departure} onChange={onDeparture} />
            <TimeField style={{ flex: 1 }} label="Llegada aprox." value={arrival} onChange={(v) => { setArrival(v); setArrivalTouched(true); }} />
          </Row>
          {departureAt && !future ? <Small style={{ color: colors.danger }}>La salida debe ser al menos dentro de 30 minutos.</Small> : null}
          {departureAt && arrivalAt && !arrivalOk ? <Small style={{ color: colors.danger }}>La llegada tiene que ser después de la salida.</Small> : null}
          <Checkbox checked={nextDay} onChange={(v) => { setNextDay(v); setArrivalTouched(true); }}>
            <Muted>Llego al día siguiente</Muted>
          </Checkbox>
          <View><Label>Tamaño máximo que aceptas</Label><Chips options={SIZES} value={maxSize} onChange={setMaxSize} /></View>
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
            <H3>Gastos de tu viaje</H3>
            <KeyValue k={`${km} km × ${euros(capPerKmCents / 100).replace(' €', '')} €/km`} v={euros(capCents / 100)} accent />
            <Small>Es lo máximo que puedes recibir sumando todos los paquetes: en WannaSend compartes los gastos del viaje, no cobras un servicio.</Small>
            <Row style={{ justifyContent: 'space-between' }}>
              <Muted>Paquetes que llevas</Muted>
              <Stepper value={Math.min(capacity, Math.max(1, maxPackages))} onChange={setCapacity} min={1} max={Math.max(1, maxPackages)} />
            </Row>
            <Small>Con {euros(priceCents / 100)} por paquete caben hasta {maxPackages} paquete{maxPackages === 1 ? '' : 's'}{maxPackages === 6 ? ' (el máximo por trayecto)' : ''}.</Small>
          </Card>
          <InfoBox icon="wallet-outline">Con {capacity} paquete{capacity > 1 ? 's' : ''} recibirías hasta {euros((priceCents * capacity) / 100)} para cubrir gastos. Recibes íntegro tu precio por paquete; la cuota de servicio de WannaSend la paga el sender aparte.</InfoBox>
        </>
      ) : null}

      {step === 4 && from && to ? (
        <>
          <Card>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 18, color: colors.primaryDark }}>{longDate(date)}</Text>
            <KeyValue k={`${departure}  Salida`} v={from.label} />
            <KeyValue k={`${arrival}${nextDay ? ' (+1 día)' : ''}  Llegada`} v={to.label} />
            <Divider />
            <KeyValue k="Paquetes" v={`Hasta ${capacity}`} />
            <KeyValue k="Tamaño máximo" v={maxSize} />
            <KeyValue k="Peso máximo" v={`${maxWeightKg} kg`} />
            <KeyValue k="Precio por paquete" v={euros(priceCents / 100)} accent />
            <KeyValue k="Gastos del viaje (tope)" v={euros(capCents / 100)} />
          </Card>
          <InfoBox icon="shield-checkmark-outline">Todos los senders verifican su identidad antes de enviar: sabrás siempre quién te confía el paquete.</InfoBox>
          <Checkbox checked={agree} onChange={setAgree}>
            <Muted>Revisaré cada paquete al recogerlo y no transportaré objetos prohibidos.</Muted>
          </Checkbox>
        </>
      ) : null}
    </Screen>
  );
}
