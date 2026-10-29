-- 07e · Activa la verificación obligatoria de carriers (alta de cobros en Stripe antes de publicar).
-- La de senders (sender_verification_enabled) se activa cuando Stripe Identity esté disponible en la cuenta.
update public.app_config set carrier_verification_required = true;
