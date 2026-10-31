// Intermediario con Google Maps (Places API New y Routes API).
// La clave GOOGLE_MAPS_API_KEY vive solo aquí, como secreto del proyecto: nunca dentro de la app.
// Requiere usuario con sesión (verify_jwt) para que nadie pueda gastar la cuota desde fuera.
//  - autocomplete / details: buscador de direcciones.
//  - route: distancia por carretera para el tope de gastos compartidos. Se guarda en route_quotes (solo el
//    servidor puede escribir ahí) y la base de datos la usa al publicar el trayecto. Si Google no está
//    disponible, devuelve la estimación (línea recta × 1,2) y no guarda nada.
import { admin, callerId, CORS, json } from '../_shared/common.ts';

type Pt = { lat: number; lng: number };
const validPt = (p: any): p is Pt =>
  p && typeof p.lat === 'number' && typeof p.lng === 'number' && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function estimateKm(a: Pt, b: Pt) {
  const R = 6371, rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return Math.max(1, Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.2));
}

/** Decodifica una polilínea de Google (precisión 5) a [lng, lat]. */
function decodePolyline(enc: string): [number, number][] {
  const pts: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < enc.length) {
    for (const k of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = enc.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d; else lng += d;
    }
    pts.push([lng / 1e5, lat / 1e5]);
  }
  return pts;
}

/** Ruta como LINESTRING (máx. ~300 puntos) para buscar trayectos "de paso". */
function routeWkt(enc?: string): string | null {
  if (!enc) return null;
  const pts = decodePolyline(enc);
  if (pts.length < 2) return null;
  const step = Math.max(1, Math.ceil(pts.length / 300));
  const kept = pts.filter((_, i) => i % step === 0);
  if (kept[kept.length - 1] !== pts[pts.length - 1]) kept.push(pts[pts.length - 1]);
  return `SRID=4326;LINESTRING(${kept.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(',')})`;
}

async function route(req: Request, from: Pt, to: Pt, key: string | undefined) {
  const estimate = { km: estimateKm(from, to), source: 'estimada' };
  if (!key) return json(estimate);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const db = admin();
  // Límite razonable para no gastar cuota: 30 cálculos por usuario y hora
  const { count } = await db.from('route_quotes').select('id', { count: 'exact', head: true })
    .eq('user_id', uid).gt('created_at', new Date(Date.now() - 3600_000).toISOString());
  if ((count ?? 0) >= 30) return json(estimate);
  try {
    const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.distanceMeters,routes.polyline.encodedPolyline' },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
    });
    if (!r.ok) return json(estimate);
    const best = (await r.json())?.routes?.[0];
    const meters = best?.distanceMeters;
    if (!meters) return json(estimate);
    const km = Math.max(1, Math.round(meters / 1000));
    await db.from('route_quotes').insert({
      user_id: uid, distance_km: km,
      from_point: `SRID=4326;POINT(${from.lng} ${from.lat})`, to_point: `SRID=4326;POINT(${to.lng} ${to.lat})`,
      path: routeWkt(best?.polyline?.encodedPolyline),
    });
    return json({ km, source: 'carretera' });
  } catch {
    return json(estimate);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('GOOGLE_MAPS_API_KEY');

  let body: { action?: string; input?: string; placeId?: string; sessionToken?: string; from?: Pt; to?: Pt };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }

  if (body.action === 'route') {
    if (!validPt(body.from) || !validPt(body.to)) return json({ error: 'bad_points' }, 400);
    return route(req, body.from, body.to, key);
  }
  if (!key) return json({ error: 'missing_key' }, 503);
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
