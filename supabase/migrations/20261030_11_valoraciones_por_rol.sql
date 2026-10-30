-- 11 · Valoraciones separadas como carrier y como sender (30/10/2026).
-- reviews.role es el papel de quien escribe: 'sender' valora a un carrier y 'carrier' valora a un sender.
-- get_profile_v2 = get_profile + medias por papel (get_profile se mantiene para el APK 1.0.0).
create or replace function public.get_profile_v2(p_user uuid)
returns table(id uuid, name text, bio text, avatar_url text, verified boolean, created_at timestamptz,
  trips_done integer, packages_sent integer, packages_carried integer, rating numeric, reviews_count integer, level text,
  rating_as_carrier numeric, reviews_as_carrier integer, rating_as_sender numeric, reviews_as_sender integer)
language sql stable security definer set search_path = '' as $$
  with s as (
    select
      (select count(*) from public.trips t where t.carrier_id = p_user and t.status <> 'cancelado' and t.departure_at < now())::integer as trips_done,
      (select count(*) from public.shipments x where x.sender_id = p_user and x.status = 'entregado')::integer as sent,
      (select count(*) from public.shipments x join public.trips t on t.id = x.trip_id where t.carrier_id = p_user and x.status = 'entregado')::integer as carried,
      (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.about_id = p_user) as rating,
      (select count(*) from public.reviews r where r.about_id = p_user)::integer as reviews,
      (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.about_id = p_user and r.role = 'sender') as r_carrier,
      (select count(*) from public.reviews r where r.about_id = p_user and r.role = 'sender')::integer as n_carrier,
      (select round(avg(r.stars)::numeric, 1) from public.reviews r where r.about_id = p_user and r.role = 'carrier') as r_sender,
      (select count(*) from public.reviews r where r.about_id = p_user and r.role = 'carrier')::integer as n_sender
  )
  select p.id, p.name, p.bio, p.avatar_url, p.verified, p.created_at,
    s.trips_done, s.sent, s.carried, coalesce(s.rating, 0), s.reviews,
    case when s.sent + s.carried = 0 then 'Nuevo' when s.sent + s.carried < 10 then 'Habitual' else 'Experto' end,
    coalesce(s.r_carrier, 0), s.n_carrier, coalesce(s.r_sender, 0), s.n_sender
  from public.profiles p, s where p.id = p_user and (select auth.uid()) is not null;
$$;
revoke execute on function public.get_profile_v2(uuid) from public, anon;
grant execute on function public.get_profile_v2(uuid) to authenticated;
