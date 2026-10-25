// Intermediario con Google Places (API New).
// La clave GOOGLE_MAPS_API_KEY vive solo aquí, como secreto del proyecto: nunca dentro de la app.
// Requiere usuario con sesión (verify_jwt) para que nadie pueda gastar la cuota desde fuera.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!key) return json({ error: 'missing_key' }, 503);

  let body: { action?: string; input?: string; placeId?: string; sessionToken?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const session = typeof body.sessionToken === 'string' ? body.sessionToken.slice(0, 64) : undefined;

  if (body.action === 'autocomplete') {
    const input = (body.input ?? '').toString().trim().slice(0, 120);
    if (input.length < 2) return json({ suggestions: [] });
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({
        input,
        sessionToken: session,
        languageCode: 'es',
        includedRegionCodes: ['es', 'it', 'fr', 'pt', 'ad'],
      }),
    });
    if (!r.ok) return json({ error: 'upstream', status: r.status }, 502);
    const data = await r.json();
    const suggestions = (data.suggestions ?? [])
      .filter((s: any) => s.placePrediction)
      .slice(0, 6)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        main: s.placePrediction.structuredFormat?.mainText?.text ?? s.placePrediction.text?.text,
        secondary: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
      }));
    return json({ suggestions });
  }

  if (body.action === 'details') {
    const placeId = (body.placeId ?? '').toString();
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return json({ error: 'bad_place' }, 400);
    const url = `https://places.googleapis.com/v1/places/${placeId}?languageCode=es${session ? `&sessionToken=${encodeURIComponent(session)}` : ''}`;
    const r = await fetch(url, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'formattedAddress,location,addressComponents' },
    });
    if (!r.ok) return json({ error: 'upstream', status: r.status }, 502);
    const p = await r.json();
    const comp = (type: string) => p.addressComponents?.find((c: any) => c.types?.includes(type))?.longText;
    return json({
      label: p.formattedAddress,
      city: comp('locality') ?? comp('administrative_area_level_2') ?? comp('administrative_area_level_1') ?? '',
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    });
  }

  return json({ error: 'unknown_action' }, 400);
});
