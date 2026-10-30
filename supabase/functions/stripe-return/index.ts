// Vuelta a la app tras el alta de cobros o la verificación de identidad en Stripe.
// Supabase sirve el HTML de las funciones como texto plano, así que no se usa una página: se redirige (302)
// directamente al enlace de la app. Solo a pantallas conocidas (?to=verificacion); por defecto, a Ganancias.
const TARGETS: Record<string, string> = { ganancias: 'wannasend://ganancias', verificacion: 'wannasend://verificar' };

Deno.serve((req) => {
  const to = new URL(req.url).searchParams.get('to') ?? 'ganancias';
  const target = TARGETS[to] ?? TARGETS.ganancias;
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } });
});
