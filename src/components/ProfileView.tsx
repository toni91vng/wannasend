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
  const { data: reviews } = useReviews(tab === 'Valoraciones' ? u.id : undefined);

  return (
    <>
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={u.name} size={96} />
        <H1>{u.name}</H1>
        <Row gap={14}>
          <Body>Nivel: <Body style={{ color: colors.primaryDark }}>{u.level.toLowerCase()}</Body></Body>
          {u.rating ? <Rating value={u.rating} reviews={u.reviews} /> : <Small>0 opiniones</Small>}
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
      ) : !reviews ? <Loading /> : reviews.length ? (
        reviews.map((r) => (
          <Card key={r.id} style={{ gap: 8 }}>
            <Row>
              <Avatar name={r.authorName} size={36} />
              <View style={{ flex: 1 }}><Body style={{ fontFamily: fonts.semibold }}>{r.authorName}</Body><Small>Como {r.role.toLowerCase()} · {r.date}</Small></View>
              <Rating value={r.stars} />
            </Row>
            {r.text ? <Body style={{ color: colors.textSecondary }}>{r.text}</Body> : null}
          </Card>
        ))
      ) : (
        <EmptyState icon="star-outline" title="Aún no hay valoraciones" text={isMe ? 'Haz tu primer envío o lleva un paquete como carrier para recibir valoraciones.' : `${u.name} todavía no tiene valoraciones.`} />
      )}
    </>
  );
}
