import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';
import { Trip, User } from '@/data/types';
import { duration, shortDate } from '@/lib/format';
import { euros } from '@/lib/pricing';
import { colors, fonts } from '@/lib/theme';
import { VerifiedBadge } from './Photos';
import { Avatar, Badge, Body, Card, H3, Rating, Row, Small } from './ui';

/** Línea de horario "17:00 · Lleida / 1h55 / 18:55 · Barcelona" del Figma. */
export function Timeline({ trip, showPoints }: { trip: Trip; showPoints?: boolean }) {
  const stop = (time: string, city: string, point: string) => (
    <Row gap={10} style={{ alignItems: 'flex-start' }}>
      <Body numberOfLines={1} style={{ width: 52, color: colors.textSecondary, fontVariant: ['tabular-nums'] }}>{time}</Body>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 6 }} />
      <View style={{ flex: 1 }}>
        <H3>{city}</H3>
        {showPoints ? <Small>{point}</Small> : null}
      </View>
    </Row>
  );
  return (
    <View style={{ gap: 2 }}>
      {stop(trip.departure, trip.from, trip.fromPoint)}
      <Row gap={10}>
        <Small style={{ width: 52, fontSize: 10, textAlign: 'center' }}>{duration(trip)}</Small>
        <View style={{ width: 2, height: 16, backgroundColor: colors.primaryLight, marginLeft: 3 }} />
      </Row>
      {stop(trip.arrival, trip.to, trip.toPoint)}
    </View>
  );
}

/** Tarjeta de trayecto para listados (precio = lo que paga el sender). */
export function TripCard({ trip, carrier, onPress, status, priceMode = 'sender', showDate, note }: {
  trip: Trip; carrier?: User; onPress?: () => void; status?: { label: string; tone: 'green' | 'amber' | 'gray' | 'red' };
  priceMode?: 'sender' | 'carrier'; showDate?: boolean; note?: string;
}) {
  const price = priceMode === 'sender' ? trip.total : trip.pricePerPackage;
  return (
    <Card onPress={onPress}>
      {showDate ? <Small style={{ fontFamily: fonts.semibold, color: colors.primaryDark, textTransform: 'capitalize' }}>{shortDate(trip.date)}</Small> : null}
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Timeline trip={trip} /></View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Body style={{ fontFamily: fonts.semibold, color: colors.primaryDark }}>{euros(price)}</Body>
          {status ? <Badge label={status.label} tone={status.tone} /> : null}
        </View>
      </Row>
      {note ? (
        <Row gap={6}><Ionicons name="git-merge-outline" size={14} color={colors.primaryDark} /><Small style={{ flex: 1, color: colors.primaryDark }}>{note}</Small></Row>
      ) : null}
      {carrier || trip.carrierName ? (
        <Row>
          <Avatar name={carrier?.name ?? trip.carrierName!} size={32} />
          <H3 style={{ fontSize: 14 }}>{carrier?.name ?? trip.carrierName}</H3>
          {trip.carrierRating !== undefined || carrier ? <Rating value={carrier?.rating ?? trip.carrierRating ?? 0} /> : null}
          {(carrier?.verified ?? trip.carrierVerified) ? <VerifiedBadge verified compact /> : null}
          <View style={{ flex: 1 }} />
          <Small>Hasta {trip.maxSize.toLowerCase()} · {trip.maxWeightKg} kg</Small>
        </Row>
      ) : null}
    </Card>
  );
}
