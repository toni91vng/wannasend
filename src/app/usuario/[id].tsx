import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ProfileView } from '@/components/ProfileView';
import { Button, Card, Chips, Field, H3, InfoBox, Loading, Screen } from '@/components/ui';
import { report } from '@/data/api';
import { useProfile } from '@/data/hooks';
import { useMe } from '@/data/session';
import { run } from '@/lib/run';
import { colors } from '@/lib/theme';

const REASONS = ['Comportamiento inapropiado', 'Perfil falso', 'No se presentó', 'Otro'] as const;

/** Perfil de otro usuario. Solo "Reportar usuario" (se quitó "Seguir usuario" del MVP). */
export default function Usuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data: u } = useProfile(id);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | undefined>();
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!u) return <Screen title="Perfil"><Loading /></Screen>;
  const send = async () => {
    setBusy(true);
    const ok = await run(() => report({ reportedUserId: u.id, reason: reason!, details }));
    setBusy(false);
    if (ok !== undefined) setSent(true);
  };

  return (
    <Screen title="Perfil">
      <ProfileView u={u} />
      {u.id === me ? null : sent ? <InfoBox icon="checkmark-circle-outline">Gracias. Revisaremos el perfil de {u.name} en menos de 24 h.</InfoBox>
        : reporting ? (
          <Card>
            <H3>¿Por qué quieres reportar a {u.name}?</H3>
            <Chips options={REASONS} value={reason} onChange={setReason} />
            <Field placeholder="Cuéntanos qué ha pasado (opcional)" multiline value={details} onChangeText={setDetails} maxLength={2000} textAlignVertical="top" />
            <Button label="Enviar reporte" variant="danger" loading={busy} disabled={!reason} onPress={send} />
          </Card>
        ) : <Button variant="ghost" label="Reportar usuario" icon="flag-outline" color={colors.danger} onPress={() => setReporting(true)} />}
    </Screen>
  );
}
