// Página de vuelta tras el alta en Stripe: devuelve al usuario a la app.
const APP_URL = 'wannasend://ganancias';

Deno.serve(() => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>WannaSend</title><meta http-equiv="refresh" content="0;url=${APP_URL}"></head>
<body style="font-family:system-ui,sans-serif;background:#5DB075;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0">
<div><h1 style="font-weight:600">Listo</h1><p>Vuelve a WannaSend para continuar.</p>
<p><a href="${APP_URL}" style="color:#fff;font-weight:600">Abrir WannaSend</a></p></div></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
));
