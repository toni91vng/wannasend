import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import { useMe } from './session';
import { Place } from './types';

export const useProfile = (id?: string) =>
  useQuery({ queryKey: ['profile', id], queryFn: () => api.getProfile(id!), enabled: !!id });
export const useMyProfile = () => useProfile(useMe());
export const useReviews = (id?: string) =>
  useQuery({ queryKey: ['reviews', id], queryFn: () => api.getReviews(id!), enabled: !!id });

export const useSearch = (from?: Place, to?: Place, day?: string) =>
  useQuery({
    queryKey: ['search', from?.lat, from?.lng, to?.lat, to?.lng, day],
    queryFn: () => api.searchTrips(from!, to!, day!),
    enabled: !!from && !!to && !!day,
  });
export const useNearbyDays = (from?: Place, to?: Place, enabled = true) =>
  useQuery({
    queryKey: ['nearbyDays', from?.lat, from?.lng, to?.lat, to?.lng],
    queryFn: () => api.nearbyDays(from!, to!),
    enabled: enabled && !!from && !!to,
  });

export const useTrip = (id?: string) => useQuery({ queryKey: ['trip', id], queryFn: () => api.getTrip(id!), enabled: !!id });
export const useMyTrips = () => {
  const me = useMe();
  return useQuery({ queryKey: ['myTrips', me], queryFn: () => api.myTrips(me), enabled: !!me });
};
export const useMyShipments = () => {
  const me = useMe();
  return useQuery({ queryKey: ['shipments', me], queryFn: () => api.myShipments(me), enabled: !!me });
};
export const useShipment = (id?: string) => useQuery({ queryKey: ['shipment', id], queryFn: () => api.getShipment(id!), enabled: !!id });
export const useTripShipments = (tripId?: string) =>
  useQuery({ queryKey: ['tripShipments', tripId], queryFn: () => api.tripShipments(tripId!), enabled: !!tripId });
export const useDeliveryCode = (id?: string, enabled = true) =>
  useQuery({ queryKey: ['code', id], queryFn: () => api.getDeliveryCode(id!), enabled: !!id && enabled });
export const usePickupCode = (id?: string, enabled = true) =>
  useQuery({ queryKey: ['pickupCode', id], queryFn: () => api.getPickupCode(id!), enabled: !!id && enabled });
export const useHasReviewed = (shipmentId?: string, enabled = true) => {
  const me = useMe();
  return useQuery({ queryKey: ['reviewed', shipmentId, me], queryFn: () => api.hasReviewed(shipmentId!, me), enabled: !!shipmentId && enabled });
};

export const useConversations = () => useQuery({ queryKey: ['conversations'], queryFn: api.myConversations });
export const useMessages = (convId?: string) =>
  useQuery({ queryKey: ['messages', convId], queryFn: () => api.getMessages(convId!), enabled: !!convId });

export const useBalance = () => useQuery({ queryKey: ['balance'], queryFn: api.myBalance });
export const useMovements = () => useQuery({ queryKey: ['movements'], queryFn: api.myMovements });
export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: api.myAlerts });

/** Mutación que, al terminar, refresca las listas indicadas. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: A) => fn(...args),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}

export const useAppConfig = () => useQuery({ queryKey: ['appConfig'], queryFn: api.getAppConfig, staleTime: 5 * 60_000 });
export const usePaymentsEnabled = () => {
  const q = useAppConfig();
  return { ...q, data: q.data?.paymentsEnabled };
};
export const useMyVerification = () => {
  const me = useMe();
  return useQuery({ queryKey: ['verification', me], queryFn: api.myVerification, enabled: !!me });
};
