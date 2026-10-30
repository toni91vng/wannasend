import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { View } from 'react-native';
import { useReviews } from '@/data/hooks';
import { User } from '@/data/types';
import { colors, fonts } from '@/lib/theme';
import { Avatar, Body, Card, Divider, EmptyState, H1, Loading, Muted, Rating, Row, Segmented, Small } from './ui';

/** Cabecera + pestañas Información / Valoraciones, compartido entre "Mi perfil" y el perfil de otros. */
export function ProfileView({ u, isMe, children }: { u: User; isMe?: boolean; children?: React.ReactNode }) {
  const [tab, setTab] = useState<'Información' | 'Valoraciones'>('Información');
  const [as, setAs] = useState<'Como carrier' | 'Como sender'>(u.asSender.reviews > u.asCarrier.reviews ? 'Como sender' : 'Como carrier');
  const { data: all } = useReviews(tab === 'Valoraciones' ? u.id : undefined);
  // Como carrier = valoraciones que le han dejado sus senders, y al revés
  const reviews = all?.filter((r) => (as === 'Como carrier' ? r.role === 'Sender' : r.role === 'Carrier'));

  return (
    <>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={u.name} size={96} />
        <H1>{u.name}</H1>
        <Body>Nivel: <Body style={{ color: colors.primaryDark }}>{u.level.toLowerCase()}</Body></Body>
        <Row gap={18}>
          <RoleRating icon="car-outline" label="Como carrier" r={u.asCarrier} />
          <RoleRating icon="cube-outline" label="Como sender" r={u.asSender} />
        </Row>
      </View>
      <Segmented options={['Información', 'Valoraciones'] as const} value={tab} onChange={setTab} />

      {tab === 'Información' ? (
        <Card>
          {u.bio ? <Body style={{ color: colors.textSecondary }}>{u.bio}</Body> : <Muted>{isMe ? 'Añade una breve presentación para generar confianza.' : 'Sin presentación todavía.'}</Muted>}
          <Divider />
          <Row><Ionicons name={u.verified ? 'shield-checkmark' : 'shield-outline'} size={18} color={u.verified ? colors.primary : colors.muted} /><Body>{u.verified ? 'Identidad verificada' : 'Identidad sin verificar'}</Body></Row>
          <Row><Ionicons name="car-outline" size={18} color={colors.primaryDark} /><Body>{u.trips} desplazamientos realizados</Body></Row>
          <Row><Ionicons name="cube-outline" size={18} color={colors.primaryDark} /><Body>{u.packages} paquetes enviados · {u.carried} llevados</Body></Row>
          {children ? <><Divider />{children}</> : null}
        </Card>
      ) : null}

      {tab === 'Valoraciones' ? <Segmented options={['Como carrier', 'Como sender'] as const} value={as} onChange={setAs} /> : null}
      {tab === 'Información' ? null : !reviews ? <Loading /> : reviews.length ? (
        reviews.map((r) => (
          <Card key={r.id} style={{ gap: 8 }}>
            <Row>
              <Avatar name={r.authorName} size={36} />
              <View style={{ flex: 1 }}><Body style={{ fontFamily: fonts.semibold }}>{r.authorName}</Body><Small>{r.role === 'Sender' ? 'Envió un paquete' : 'Llevó su paquete'} · {r.date}</Small></View>
              <Rating value={r.stars} />
            </Row>
            {r.text ? <Body style={{ color: colors.textSecondary }}>{r.text}</Body> : null}
          </Card>
        ))
      ) : (
        <EmptyState icon="star-outline" title={`Aún no hay valoraciones ${as.toLowerCase()}`}
          text={as === 'Como carrier'
            ? (isMe ? 'Lleva un paquete en uno de tus trayectos para recibir valoraciones de tus senders.' : `${u.name} todavía no tiene valoraciones como carrier.`)
            : (isMe ? 'Haz tu primer envío para recibir valoraciones de tu carrier.' : `${u.name} todavía no tiene valoraciones como sender.`)} />
      )}
    </>
  );
}

function RoleRating({ icon, label, r }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; r: { rating: number; reviews: number } }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Row gap={4}><Ionicons name={icon} size={14} color={colors.textSecondary} /><Small>{label}</Small></Row>
      {r.reviews ? <Rating value={r.rating} reviews={r.reviews} /> : <Small>Sin valoraciones</Small>}
    </View>
  );
}
