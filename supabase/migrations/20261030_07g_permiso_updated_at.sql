-- 07g · Al pagar, la app guarda el móvil del sender junto con updated_at y faltaba permiso sobre esa columna
-- ("permission denied for table profile_private"). Detectado por Toni el 30/10/2026.
grant update (updated_at) on public.profile_private to authenticated;
