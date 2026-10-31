-- 13 · Chat sin datos de contacto (decisión del 31/10/2026).
-- Como en BlaBlaCar o Wallapop: el servidor oculta con "•••" teléfonos, emails, enlaces, IBAN y usuarios
-- de redes sociales antes de guardar el mensaje. Funciona con cualquier versión de la app.
-- No es infalible (p. ej. números escritos con letras), pero evita que sea lo fácil.
create or replace function private.mask_contact(p_text text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(p_text,
    -- emails
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '•••', 'g'),
    -- enlaces y dominios (wa.me, t.me, instagram.com…)
    '(https?://|www\.)\S+|\m[A-Za-z0-9-]+\.(com|es|net|org|me|io|ly|link|app|cat|eu)(/\S*)?', '•••', 'gi'),
    -- IBAN
    '\m[A-Z]{2}\d{2}(\s?[A-Z0-9]{4}){4,7}(\s?[A-Z0-9]{1,4})?', '•••', 'gi'),
    -- teléfonos españoles: 9 cifras que empiezan por 6, 7, 8 o 9 (con o sin +34 / 0034, espacios, puntos o guiones)
    '(?<![0-9])((\+|00)\s*34[\s.-]*)?[6789]([\s.-]*[0-9]){8}(?![0-9])', '•••', 'g'),
    -- usuario de redes después de nombrar la red
    '\m(insta|instagram|ig|telegram|tiktok|twitter|facebook|fb|snapchat|snap)\M(\s*(es|:|=|->)?\s*)@?[A-Za-z0-9._]{3,}', '\1 •••', 'gi'),
    -- @usuario suelto
    '(^|\s)@[A-Za-z0-9._]{2,}', '\1•••', 'g');
$$;

create or replace function private.messages_mask_contact()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.body := private.mask_contact(new.body);
  return new;
end $$;

drop trigger if exists messages_mask_contact on public.messages;
create trigger messages_mask_contact before insert or update of body on public.messages
  for each row execute function private.messages_mask_contact();
