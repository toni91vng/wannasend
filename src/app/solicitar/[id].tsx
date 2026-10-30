import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native';
import { askFeedback, sentRecently } from '@/components/FeedbackHost';
import { PhotoPicker } from '@/components/Photos';
import { Button, Card, Checkbox, Chips, Field, H3, InfoBox, Label, Loading, Muted, Row, Screen, Small, Stepper, Steps } from '@/components/ui';
import { getMyPhone, NewPackage } from '@/data/api';
import { useAppConfig, useMyVerification, useProfile, useTrip } from '@/data/hooks';
import { colors, fonts } from '@/lib/theme';
import { useMe } from '@/data/session';
import { CONTENT_TYPES, PackageSize, SIZE_HINT, SIZES } from '@/data/types';

const phoneOk = (p: string) => /^\+?[0-9 ]{9,16}$/.test(p.trim());

/** Paso 1: datos del paquete (con foto, valor declarado y declaración de no prohibidos) y del destinatario. */
export default function Solicitar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: t } = useTrip(id);
  const { data: cfg } = useAppConfig();
  const { data: carrier } = useProfile(t?.carrierId);
  const { data: ver } = useMyVerification();
  const [photoPath, setPhotoPath] = useState<string>();
  const [value, setValue] = useState('');
  const [noProhibited, setNoProhibited] = useState(false);
  const [size, setSize] = useState<PackageSize>('Pequeño');
  const [weight, setWeight] = useState(2);
  const [content, setContent] = useState<string>('Ropa');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [myPhone, setMyPhone] = useState<string | null | undefined>(undefined);
  const [myPhoneInput, setMyPhoneInput] = useState('');

  useEffect(() => { getMyPhone(me).then(setMyPhone).catch(() => setMyPhone(null)); }, [me]);
  // Si sale sin completar la solicitud, le preguntamos qué le ha frenado (solo beta, una vez)
  useEffect(() => () => { askFeedback('abandonar_envio', { delayMs: 700, stillValid: () => !sentRecently() }); }, []);

  if (!t || !cfg) return <Screen title="Tu paquete"><Loading /></Screen>;
  const allowed = SIZES.slice(0, SIZES.indexOf(t.maxSize) + 1);
  const sizeOk = allowed.includes(size) ? size : allowed[allowed.length - 1];

  const declared = Number(value.replace(',', '.'));
  const valueOk = Number.isFinite(declared) && declared >= 1 && declared <= cfg.maxDeclaredValue;
  // Todos los senders verifican su identidad una vez, al contratar su primer envío
  const needsIdentity = cfg.senderVerificationEnabled && !ver?.verified;
  const ok = recipientName.trim().length > 1 && phoneOk(recipientPhone) && (myPhone || phoneOk(myPhoneInput))
    && !!photoPath && valueOk && noProhibited;
  const pkg: NewPackage = {
    size: sizeOk, weightKg: Math.min(weight, t.maxWeightKg), content, description: description.trim(),
    recipientName: recipientName.trim(), recipientPhone: recipientPhone.trim(),
    declaredValue: valueOk ? Math.round(declared * 100) / 100 : 0, photoPath: photoPath ?? '', noProhibited,
  };

  return (
    <Screen title="Tu paquete" subtitle={`${t.from} → ${t.to} · ${t.departure}`}
      footer={<Button label="Continuar" disabled={!ok}
        onPress={() => router.push({ pathname: '/pago/[id]', params: { id: t.id, pkg: JSON.stringify(pkg), myPhone: myPhone ? '' : myPhoneInput.trim() } })} />}
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
        <Field label={`Valor aproximado del contenido (máx. ${cfg.maxDeclaredValue} €)`} icon="pricetag-outline" placeholder="Ej.: 40" value={value}
          onChangeText={(v) => setValue(v.replace(/[^0-9.,]/g, '').slice(0, 7))} keyboardType="decimal-pad"
          error={value && !valueOk ? (declared > cfg.maxDeclaredValue ? `No se pueden enviar objetos de más de ${cfg.maxDeclaredValue} €` : 'Indica un valor en euros') : ''} />
        <Small>WannaSend no asegura el contenido: si algo sale mal, te devolvemos el precio del envío.</Small>
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
        <H3>¿Quién lo recibe?</H3>
        <Field label="Nombre del destinatario" icon="person-outline" placeholder="Nombre" value={recipientName} onChangeText={setRecipientName} maxLength={60} />
        <Field label="Móvil del destinatario" icon="call-outline" placeholder="600 000 000" value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" maxLength={16} />
        <Small>Le enviarás un enlace con su código de entrega por WhatsApp. El carrier solo verá este número si acepta tu paquete.</Small>
      </Card>
      {myPhone === null ? (
        <Card>
          <H3>Tu móvil</H3>
          <Field placeholder="600 000 000" icon="call-outline" value={myPhoneInput} onChangeText={setMyPhoneInput} keyboardType="phone-pad" maxLength={16} />
          <Small>Lo pedimos una vez, antes de tu primer envío. No se muestra a nadie.</Small>
        </Card>
      ) : null}
    </Screen>
  );
}
