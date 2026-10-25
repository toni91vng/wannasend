import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chips, Field, H3, Label, Row, Screen, Small, Stepper, Steps } from '@/components/ui';
import { NewPackage } from '@/data/store';
import { useDerived } from '@/data/store';
import { CONTENT_TYPES, PackageSize, SIZE_HINT, SIZES } from '@/data/types';

/** Paso 1: datos del paquete y del destinatario. */
export default function Solicitar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { trip } = useDerived();
  const t = trip(id)!;
  const allowed = SIZES.slice(0, SIZES.indexOf(t.maxSize) + 1);

  const [size, setSize] = useState<PackageSize>(allowed[Math.min(2, allowed.length - 1)]);
  const [weight, setWeight] = useState(Math.min(3, t.maxWeightKg));
  const [content, setContent] = useState<string>('Ropa');
  const [description, setDescription] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');

  const ok = recipientName.trim().length > 1 && recipientPhone.replace(/\D/g, '').length >= 9;
  const pkg: NewPackage = { size, weightKg: weight, content, description: description || content, recipientName: recipientName.trim(), recipientPhone };

  return (
    <Screen title="Tu paquete" subtitle={`${t.from} → ${t.to} · ${t.departure}`}
      footer={<Button label="Continuar" disabled={!ok} onPress={() => router.push({ pathname: '/pago/[id]', params: { id: t.id, pkg: JSON.stringify(pkg) } })} />}
    >
      <Steps step={1} of={2} />
      <Card>
        <H3>¿Qué envías?</H3>
        <View>
          <Label>Tamaño</Label>
          <Chips options={allowed} value={size} onChange={setSize} />
          <Small style={{ marginTop: 6 }}>{SIZE_HINT[size]}</Small>
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Label>Peso aproximado (máx. {t.maxWeightKg} kg)</Label>
          <Stepper value={weight} onChange={setWeight} min={0.5} max={t.maxWeightKg} step={0.5} format={(n) => `${String(n).replace('.', ',')} kg`} />
        </Row>
        <View>
          <Label>Tipo de contenido</Label>
          <Chips options={CONTENT_TYPES} value={content} onChange={setContent} />
        </View>
        <Field label="Descripción (opcional)" placeholder="Ej.: ropa y dos libros" value={description} onChangeText={setDescription} />
      </Card>
      <Card>
        <H3>¿Quién lo recibe?</H3>
        <Field label="Nombre del destinatario" icon="person-outline" placeholder="Nombre" value={recipientName} onChangeText={setRecipientName} />
        <Field label="Móvil del destinatario" icon="call-outline" placeholder="600 000 000" value={recipientPhone} onChangeText={setRecipientPhone} keyboardType="phone-pad" />
        <Small>Le enviaremos por WhatsApp o SMS un enlace con su código de entrega. No necesita tener la app.</Small>
      </Card>
    </Screen>
  );
}
