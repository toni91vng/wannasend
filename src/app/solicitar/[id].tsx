import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native';
import { askFeedback, sentRecently } from '@/components/FeedbackHost';
import { PhotoPicker } from '@/components/Photos';
import { Button, Card, Checkbox, Chips, Field, H3, InfoBox, Label, Loading, Muted, Row, Screen, Small, Stepper, Steps } from '@/components/ui';
import { NewPackage } from '@/data/api';
import { useAppConfig, useMyVerification, useProfile, useTrip } from '@/data/hooks';
import { colors, fonts } from '@/lib/theme';
import { useMe } from '@/data/session';
import { CONTENT_TYPES, PackageSize, SIZE_HINT, SIZES, VALUE_TIERS, ValueTier } from '@/data/types';


/** Paso 1: datos del paquete (con foto, valor declarado y declaración de no prohibidos) y del destinatario. */
export default function Solicitar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: t } = useTrip(id);
  const { data: cfg } = useAppConfig();
  const { data: carrier } = useProfile(t?.carrierId);
  const { data: ver } = useMyVerification();
  const [photoPath, setPhotoPath] = useState<string>();
  const [valueTier, setValueTier] = useState<ValueTier>();
  const [noProhibited, setNoProhibited] = useState(false);
  const [size, setSize] = useState<PackageSize>('Pequeño');
  const [weight, setWeight] = useState(2);
  const [content, setContent] = useState<string>('Ropa');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [forMe, setForMe] = useState(false);
  const { data: myProfile } = useProfile(me);

  // Si sale sin completar la solicitud, le preguntamos qué le ha frenado (solo beta, una vez)
  useEffect(() => () => { askFeedback('abandonar_envio', { delayMs: 700, stillValid: () => !sentRecently() }); }, []);

  if (!t || !cfg) return <Screen title="Tu paquete"><Loading /></Screen>;
  const allowed = SIZES.slice(0, SIZES.indexOf(t.maxSize) + 1);
  const sizeOk = allowed.includes(size) ? size : allowed[allowed.length - 1];

  const tiers = VALUE_TIERS.filter((v) => v.max <= cfg.maxDeclaredValue);
  const receiver = forMe ? (myProfile?.name ?? '') : recipientName.trim();
  // Todos los senders verifican su identidad una vez, al contratar su primer envío
  const needsIdentity = cfg.senderVerificationEnabled && !ver?.verified;
  const ok = receiver.length > 1 && !!photoPath && !!valueTier && noProhibited;
  const pkg: NewPackage = {
    size: sizeOk, weightKg: Math.min(weight, t.maxWeightKg), content, description: description.trim(),
    recipientName: receiver, valueTier: valueTier ?? 'hasta_50', photoPath: photoPath ?? '', noProhibited,
  };

  return (
    <Screen title="Tu paquete" subtitle={`${t.from} → ${t.to} · ${t.departure}`}
      footer={<Button label="Continuar" disabled={!ok}
        onPress={() => router.push({ pathname: '/pago/[id]', params: { id: t.id, pkg: JSON.stringify(pkg) } })} />}
    >
      <Steps step={1} of={2} />
      <Card>
        <H3>¿Qué envías?</H3>
        <View>
          <Label>Tamaño</Label>
          <Chips options={allowed} value={sizeOk} onChange={setSize} />
          <Small style={{ marginTop: 6 }}>{SIZE_HINT[sizeOk]}</Small>
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Peso aprox. (máx. {t.maxWeightKg} kg)</Label>
          <Stepper value={Math.min(weight, t.maxWeightKg)} onChange={setWeight} min={0.5} max={t.maxWeightKg} step={0.5} format={(n) => `${String(n).replace('.', ',')} kg`} />
        </Row>
        <View>
          <Label>Tipo de contenido</Label>
          <Chips options={CONTENT_TYPES} value={content} onChange={setContent} />
        </View>
        <Field label="Descripción (opcional)" placeholder="Ej.: ropa y dos libros" value={description} onChangeText={setDescription} maxLength={200} />
        <PhotoPicker value={photoPath} onChange={setPhotoPath} label="Foto del contenido (obligatoria)"
          hint="Haz la foto con el paquete abierto. El carrier la verá antes de aceptar y la comparará al recogerlo." />
        <View>
          <Label>Valor aproximado del contenido</Label>
          <Chips options={tiers.map((v) => v.label)} value={tiers.find((v) => v.id === valueTier)?.label ?? ''}
            onChange={(l) => setValueTier(tiers.find((v) => v.label === l)?.id)} />
          <Small style={{ marginTop: 6 }}>Solo lo ve WannaSend, para gestionar incidencias. El carrier no lo ve. No se pueden enviar objetos de más de {cfg.maxDeclaredValue} €.</Small>
        </View>
        <Checkbox checked={noProhibited} onChange={setNoProhibited}>
          <Muted>
            Confirmo que el paquete no contiene{' '}
            <Text style={{ fontFamily: fonts.semibold, color: colors.primaryDark }} onPress={() => router.push('/prohibidos')}>objetos prohibidos</Text>
            {' '}y que soy responsable de su contenido.
          </Muted>
        </Checkbox>
      </Card>
      {needsIdentity ? (
        <InfoBox icon="shield-checkmark-outline">
          Para oficializar tu primer envío verificarás tu identidad, una sola vez. Te lo pediremos antes de pagar: tarda 2 minutos y WannaSend nunca ve tu DNI.
        </InfoBox>
      ) : null}
      <Card>
        <H3>¿A quién se lo entrega el carrier?</H3>
        <Checkbox checked={forMe} onChange={setForMe}><Muted>Lo recojo yo</Muted></Checkbox>
        {forMe ? null : (
          <Field label="Nombre de quien lo recoge" icon="person-outline" placeholder="Nombre" value={recipientName} onChangeText={setRecipientName} maxLength={60} />
        )}
        <Small>{forMe ? 'Cuando lo recibas, dale al carrier tu código de entrega.' : 'El carrier verá este nombre. Comparte con esa persona el código de entrega: se lo dará al carrier al recibir el paquete.'}</Small>
      </Card>
    </Screen>
  );
}
