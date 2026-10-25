import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Field, H3, Label, Loading, Row, Screen, Small, Stepper, Steps } from '@/components/ui';
import { getMyPhone, NewPackage } from '@/data/api';
import { useTrip } from '@/data/hooks';
import { useMe } from '@/data/session';
import { CONTENT_TYPES, PackageSize, SIZE_HINT, SIZES } from '@/data/types';

const phoneOk = (p: string) => /^\+?[0-9 ]{9,16}$/.test(p.trim());

/** Paso 1: datos del paquete y del destinatario. */
export default function Solicitar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: t } = useTrip(id);
  const [size, setSize] = useState<PackageSize>('Pequeño');
  const [weight, setWeight] = useState(2);
  const [content, setContent] = useState<string>('Ropa');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [myPhone, setMyPhone] = useState<string | null | undefined>(undefined);
  const [myPhoneInput, setMyPhoneInput] = useState('');

  useEffect(() => { getMyPhone(me).then(setMyPhone).catch(() => setMyPhone(null)); }, [me]);

  if (!t) return <Screen title="Tu paquete"><Loading /></Screen>;
  const allowed = SIZES.slice(0, SIZES.indexOf(t.maxSize) + 1);
  const sizeOk = allowed.includes(size) ? size : allowed[allowed.length - 1];

  const ok = recipientName.trim().length > 1 && phoneOk(recipientPhone) && (myPhone || phoneOk(myPhoneInput));
  const pkg: NewPackage = { size: sizeOk, weightKg: Math.min(weight, t.maxWeightKg), content, description: description.trim(), recipientName: recipientName.trim(), recipientPhone: recipientPhone.trim() };

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
      </Card>
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
