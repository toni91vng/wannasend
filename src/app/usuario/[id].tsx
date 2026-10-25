import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ProfileView } from '@/components/ProfileView';
import { Button, Card, Chips, H3, InfoBox, Screen } from '@/components/ui';
import { useDerived } from '@/data/store';
import { colors } from '@/lib/theme';

const REASONS = ['Comportamiento inapropiado', 'Perfil falso', 'No se presentó', 'Otro'] as const;

/** Perfil de otro usuario. Solo "Reportar usuario" (se quitó "Seguir usuario" del MVP). */
export default function Usuario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useDerived();
  const u = user(id);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number] | undefined>();
  const [sent, setSent] = useState(false);

  return (
    <Screen title="Perfil">
      <ProfileView u={u} />
      {sent ? <InfoBox icon="checkmark-circle-outline">Gracias. Nuestro equipo revisará el perfil de {u.name} en 24 h.</InfoBox>
        : reporting ? (
          <Card>
            <H3>¿Por qué quieres reportar a {u.name}?</H3>
            <Chips options={REASONS} value={reason} onChange={setReason} />
            <Button label="Enviar reporte" variant="danger" disabled={!reason} onPress={() => setSent(true)} />
          </Card>
        ) : <Button variant="ghost" label="Reportar usuario" icon="flag-outline" color={colors.danger} onPress={() => setReporting(true)} />}
    </Screen>
  );
}
