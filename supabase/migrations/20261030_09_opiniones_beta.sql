-- 09 · Opiniones de la beta (30/10/2026): ventana corta tras publicar, pedir un envío, buscar o abandonar una solicitud.
alter table public.app_config add column if not exists beta_feedback_enabled boolean not null default true;

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  context text not null check (context in ('publicar', 'enviar', 'buscar', 'abandonar_envio', 'general')),
  rating smallint check (rating between 1 and 5),       -- null = cerró la ventana sin responder
  comment text check (char_length(comment) <= 1000),
  app_version text,
  created_at timestamptz not null default now()
);
create index if not exists beta_feedback_user_idx on public.beta_feedback (user_id, context);
alter table public.beta_feedback enable row level security;

create policy "Enviar mi opinión" on public.beta_feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Ver mis opiniones" on public.beta_feedback for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.beta_feedback from anon, authenticated;
grant select (context) on public.beta_feedback to authenticated;
grant insert (context, rating, comment, app_version) on public.beta_feedback to authenticated;
