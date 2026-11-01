import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Badge, Button, Card, H3, Muted, Row, Small } from '@/components/ui';
import { Routine, setRoutine, WEEKDAYS } from '@/data/api';
import { useMyRoutines } from '@/data/hooks';
import { euros } from '@/lib/pricing';
import { run } from '@/lib/run';
import { colors } from '@/lib/theme';

/** Trayectos habituales del carrier: pausar, reanudar o borrar. Solo aparece si tiene alguno. */
export function RoutinesCard() {
  const { data } = useMyRoutines();
  if (!data?.length) return null;
  return (
    <Card>
      <Row gap={8}><Ionicons name="repeat" size={18} color={colors.primaryDark} /><H3>Trayectos habituales</H3></Row>
      <Small>Se publican solos con una semana de antelación. Para no ir un día concreto, cancela ese trayecto en la lista de abajo.</Small>
      {data.map((r) => <RoutineRow key={r.id} r={r} />)}
    </Card>
  );
}

function RoutineRow({ r }: { r: Routine }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const act = async (a: 'pausar' | 'reanudar' | 'borrar') => {
    setBusy(a);
    await run(async () => { await setRoutine(r.id, a); return true; }, 'No se ha podido cambiar');
    setBusy(null);
    setConfirmDelete(false);
    qc.invalidateQueries({ queryKey: ['routines'] });
    qc.invalidateQueries({ queryKey: ['myTrips'] });
  };
  return (
    <View style={{ gap: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Row>
        <View style={{ flex: 1 }}>
          <Muted style={{ color: colors.text }}>{r.from} → {r.to}</Muted>
          <Small>{r.weekdays.map((d) => WEEKDAYS[d - 1]).join(' · ')} · {r.departure} · {euros(r.pricePerPackage)}/paquete</Small>
        </View>
        <Badge label={r.active ? 'Activo' : 'En pausa'} tone={r.active ? 'green' : 'gray'} />
      </Row>
      {confirmDelete ? (
        <Row gap={8}>
          <Small style={{ flex: 1 }}>Se retirarán los próximos días que no tengan paquetes.</Small>
          <Button small variant="neutral" label="No" onPress={() => setConfirmDelete(false)} />
          <Button small variant="danger" label="Borrar" loading={busy === 'borrar'} onPress={() => act('borrar')} />
        </Row>
      ) : (
        <Row gap={8}>
          {r.active
            ? <Button small variant="secondary" label="Pausar" loading={busy === 'pausar'} onPress={() => act('pausar')} style={{ flex: 1 }} />
            : <Button small variant="secondary" label="Reanudar" loading={busy === 'reanudar'} onPress={() => act('reanudar')} style={{ flex: 1 }} />}
          <Button small variant="ghost" label="Borrar" color={colors.danger} onPress={() => setConfirmDelete(true)} style={{ flex: 1 }} />
        </Row>
      )}
    </View>
  );
}
