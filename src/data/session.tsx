import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

interface SessionState {
  session: Session | null;
  userId: string | null;
  loading: boolean;
}
const Ctx = createContext<SessionState>({ session: null, userId: null, loading: true });

/** Escucha los cambios en la base de datos que afectan al usuario y refresca las pantallas. */
function RealtimeBridge({ userId }: { userId: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shipments' }, () => {
        qc.invalidateQueries({ queryKey: ['shipments'] });
        qc.invalidateQueries({ queryKey: ['shipment'] });
        qc.invalidateQueries({ queryKey: ['myTrips'] });
        qc.invalidateQueries({ queryKey: ['tripShipments'] });
        qc.invalidateQueries({ queryKey: ['balance'] });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        qc.invalidateQueries({ queryKey: ['conversations'] });
        qc.invalidateQueries({ queryKey: ['messages', (p.new as { conversation_id: string }).conversation_id] });
      })
      // El otro ha leído mis mensajes: actualiza el doble tick
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => {
        qc.invalidateQueries({ queryKey: ['messages', (p.new as { conversation_id: string }).conversation_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, qc]);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, userId: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, userId: data.session?.user.id ?? null, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setState({ session, userId: session?.user.id ?? null, loading: false });
      if (!session) queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Ctx.Provider value={state}>
        {state.userId ? <RealtimeBridge userId={state.userId} /> : null}
        {children}
      </Ctx.Provider>
    </QueryClientProvider>
  );
}

export const useSession = () => useContext(Ctx);

/** Id del usuario con sesión (las pantallas de pestañas solo se muestran con sesión). */
export function useMe(): string {
  const { userId } = useSession();
  return userId ?? '';
}
