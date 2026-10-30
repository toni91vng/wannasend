import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { PackagePhoto, PhotoPicker, VerifiedBadge } from '@/components/Photos';
import { QrScanner } from '@/components/QrScanner';
import { Avatar, Button, Card, Divider, ErrorBox, Field, H3, InfoBox, KeyValue, Loading, Muted, Row, Screen, Small } from '@/components/ui';
import { pickupShipment } from '@/data/api';
import { useShipment } from '@/data/hooks';
import { notify } from '@/lib/notify';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { errorText } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/**
 * Recogida (carrier): revisa el paquete, hace una foto y confirma si coincide con lo declarado.
 * Si no coincide, lo rechaza con un motivo; el sender recibe el reembolso automáticamente.
 */
export default function Recogida() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: sh, isLoading, error } = useShipment(id);
  const [photo, setPhoto] = useState<string>();
  const [mismatch, setMismatch] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [scanning, setScanning] = useState(false);

  if (isLoading) return <Screen title="Recoger paquete"><Loading /></Screen>;
  if (error || !sh) return <Screen title="Recoger paquete"><ErrorBox text={error ? errorText(error) : 'Envío no encontrado'} /></Screen>;
  if (sh.status !== 'aceptado') {
    return (
      <Screen title="Recoger paquete" footer={<Button label="Volver" onPress={() => router.back()} />}>
        <Muted>Este paquete ya no está pendiente de recogida.</Muted>
      </Screen>
    );
  }

  const done = async (ok: boolean) => {
    if (!photo) return;
    setBusy(true);
    const st = await run(() => pickupShipment(sh.id, ok, photo, ok ? code : undefined, ok ? undefined : reason.trim()), 'No se ha podido guardar');
    setBusy(false);
    if (!st) return;
    if (st === 'incorrecto') { setCodeError('Código incorrecto. Revísalo con el sender.'); return; }
    if (st === 'bloqueado') { setCodeError('Demasiados intentos. Espera 15 minutos y vuelve a probar.'); return; }
    qc.invalidateQueries({ queryKey: ['tripShipments'] });
    qc.invalidateQueries({ queryKey: ['shipment', id] });
    qc.invalidateQueries({ queryKey: ['trip'] });
    if (st === 'rechazado') notify('Paquete rechazado', `Hemos avisado a ${sh.senderName ?? 'el sender'} y le devolveremos el dinero.`);
    else if (st === 'en_camino') notify('Paquete recogido', 'Como ya has empezado el trayecto, el paquete figura como «En camino».');
    router.back();
  };

  return (
    <Screen title="Recoger paquete" subtitle="Comprueba que el paquete coincide con lo declarado antes de llevártelo."
      footer={mismatch ? (
        <Row gap={10}>
          <Button variant="secondary" label="Atrás" style={{ flex: 1 }} onPress={() => setMismatch(false)} />
          <Button variant="danger" label="Rechazar paquete" style={{ flex: 2 }} loading={busy} disabled={!photo || reason.trim().length < 3} onPress={() => done(false)} />
        </Row>
      ) : (
        <View style={{ gap: 8 }}>
          <Button label="Confirmar recogida" icon="checkmark" loading={busy} disabled={!photo || code.length !== 4} onPress={() => done(true)} />
          <Button variant="ghost" label="No coincide con lo declarado" color={colors.danger} disabled={!photo} onPress={() => setMismatch(true)} />
        </View>
      )}
    >
      <Card>
        <Row>
          <Avatar name={sh.senderName ?? '?'} />
          <View style={{ flex: 1, gap: 2 }}>
            <H3>{sh.senderName}</H3>
            <VerifiedBadge verified={sh.senderVerified} />
          </View>
        </Row>
        <Divider />
        <H3>Lo que ha declarado</H3>
        <PackagePhoto path={sh.photoPath} />
        <KeyValue k="Contenido" v={sh.description ? `${sh.content} · ${sh.description}` : sh.content} />
        <KeyValue k="Tamaño y peso" v={`${sh.size} · ${String(sh.weightKg).replace('.', ',')} kg`} />
        <KeyValue k="Valor declarado" v={euros(sh.declaredValue)} />
      </Card>

      <Card>
        <H3>1. Mira el contenido</H3>
        <Muted>Pide que abran el paquete delante de ti y que lo cierren después. Si no te dejan verlo, puedes rechazarlo.</Muted>
        <H3>2. Haz una foto</H3>
        <PhotoPicker value={photo} onChange={setPhoto} label="Foto del paquete al recogerlo" hint="Queda como prueba para ti si hay cualquier incidencia." />
      </Card>

      {!mismatch ? (
        <Card>
          <H3>3. Código de recogida</H3>
          <Muted>Escanea el QR que {sh.senderName ?? 'el sender'} ve en su app o escribe su código de 4 cifras. Confirma que te ha dado el paquete.</Muted>
          <Button variant="secondary" label="Escanear QR" icon="qr-code-outline" onPress={() => setScanning(true)} />
          <Field placeholder="0000" value={code} keyboardType="number-pad" maxLength={4} error={codeError}
            onChangeText={(v) => { setCode(v.replace(/\D/g, '')); setCodeError(''); }}
            style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
        </Card>
      ) : null}
      <QrScanner visible={scanning} onClose={() => setScanning(false)} onScan={(data) => {
        setScanning(false);
        const m = /^wannasend:recogida:([0-9a-f-]+):(\d{4})$/.exec(data);
        if (!m) { setCodeError('Ese QR no es un código de recogida de WannaSend.'); return; }
        if (m[1] !== sh.id) { setCodeError('Ese QR es de otro paquete.'); return; }
        setCode(m[2]); setCodeError('');
      }} />

      {mismatch ? (
        <Card>
          <H3>¿Qué no coincide?</H3>
          <Field placeholder="Ej.: dice ropa pero hay una batería grande" value={reason} onChangeText={setReason} maxLength={300} multiline />
          <Small>No hay ninguna penalización por rechazar. {sh.senderName ?? 'El sender'} recibirá el reembolso automáticamente.</Small>
        </Card>
      ) : (
        <InfoBox icon="shield-checkmark-outline">Nunca lleves algo que no hayas podido ver o que esté en la lista de objetos prohibidos.</InfoBox>
      )}
    </Screen>
  );
}
