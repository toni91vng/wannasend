-- 07d · Registro de intentos de verificación de identidad (límite de 5 al día por usuario, para evitar costes por abuso).
-- Solo el servidor lee y escribe esta tabla.
create table public.identity_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  session_id text not null,
  created_at timestamptz not null default now()
);
alter table public.identity_attempts enable row level security;
revoke all on public.identity_attempts from anon, authenticated;
create index identity_attempts_user_idx on public.identity_attempts (user_id, created_at desc);
