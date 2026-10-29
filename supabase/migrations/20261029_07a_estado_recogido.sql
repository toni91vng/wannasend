-- 07a · Nuevo estado "recogido" entre "aceptado" y "en_camino".
-- Va en una migración aparte porque un valor nuevo de un enum no se puede usar en la misma transacción.
alter type public.shipment_status add value if not exists 'recogido' before 'en_camino';
