-- 07c · Mensajes claros para trayectos demasiado cortos (la 07b del repo ya incluye este cambio)
create or replace function public.validate_trip() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_sugg integer; v_min integer; v_max integer; cfg public.app_config; v_type public.carrier_type; v_km integer;
begin
  if tg_op = 'UPDATE' then
    -- Solo se puede cambiar el estado; la distancia, el precio y el tope quedan fijados al publicar
    return new;
  end if;
  select * into cfg from public.app_config;

  if new.departure_at < now() then raise exception 'La salida debe ser en el futuro'; end if;
  if new.departure_at > now() + interval '90 days' then raise exception 'Solo puedes publicar con 90 días de antelación'; end if;
  new.status := 'publicado';
  new.started_at := null;

  if cfg.carrier_verification_required and not private.is_verified(new.carrier_id) then
    raise exception 'Completa tu alta de cobros para publicar trayectos';
  end if;

  -- Distancia por carretera si hay un cálculo reciente del mismo usuario para los mismos puntos (±300 m)
  select q.distance_km into v_km from public.route_quotes q
   where q.user_id = new.carrier_id and q.created_at > now() - interval '2 hours'
     and extensions.st_dwithin(q.from_point, new.from_point, 300)
     and extensions.st_dwithin(q.to_point, new.to_point, 300)
   order by q.created_at desc limit 1;
  if v_km is not null then
    new.distance_km := v_km; new.distance_source := 'carretera';
  else
    new.distance_km := greatest(1, round(extensions.st_distance(new.from_point, new.to_point) / 1000 * 1.2))::integer;
    new.distance_source := 'estimada';
  end if;
  if new.distance_km < 5 then raise exception 'El origen y el destino están demasiado cerca'; end if;

  v_sugg := public.suggested_price_cents(new.distance_km, new.max_size);
  v_min := greatest(300, round(v_sugg * 0.7 / 10.0) * 10);
  v_max := greatest(v_min, round(v_sugg * 1.3 / 10.0) * 10);
  -- Trayecto demasiado corto: el tope no llega ni al precio mínimo
  if coalesce((select carrier_type from public.profile_private where id = new.carrier_id), 'particular') = 'particular'
     and new.distance_km * cfg.trip_cap_cents_per_km < v_min then
    raise exception 'Este trayecto es demasiado corto para compartir gastos (mínimo unos % km)', ceil(v_min::numeric / cfg.trip_cap_cents_per_km);
  end if;
  if new.price_cents < v_min or new.price_cents > v_max then
    raise exception 'El precio debe estar entre % y % céntimos', v_min, v_max;
  end if;

  -- Tope de gastos compartidos (solo particulares)
  select carrier_type into v_type from public.profile_private where id = new.carrier_id;
  if coalesce(v_type, 'particular') = 'particular' then
    new.earnings_cap_cents := new.distance_km * cfg.trip_cap_cents_per_km;
    if new.price_cents > new.earnings_cap_cents then
      raise exception 'En este trayecto puedes pedir como máximo % € por paquete', replace(to_char(new.earnings_cap_cents / 100.0, 'FM990.00'), '.', ',');
    end if;
    if new.price_cents * new.capacity > new.earnings_cap_cents then
      raise exception 'Con este precio puedes llevar como máximo % paquetes', new.earnings_cap_cents / new.price_cents;
    end if;
  else
    new.earnings_cap_cents := null;
  end if;
  return new;
end $$;
revoke execute on function public.validate_trip() from public, anon, authenticated;
