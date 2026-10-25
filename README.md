# WannaSend — MVP (React Native + Expo)

App de envíos colaborativos: un **sender** envía un paquete con un **carrier** que ya hace ese trayecto.
Esta versión funciona con **datos simulados en memoria** para poder probar todos los flujos antes de conectar el backend.

## Probarla en tu móvil (5 minutos)

1. Instala [Node.js](https://nodejs.org) (versión 20 o superior) en tu ordenador.
2. Instala la app **Expo Go** en tu móvil (Google Play o App Store).
3. En una terminal, dentro de esta carpeta:
   ```bash
   npm install
   npx expo start
   ```
4. Escanea el QR que aparece con Expo Go (Android) o con la cámara (iPhone). Móvil y ordenador en la misma wifi.

También puedes verla en el navegador con `npx expo start --web`.

## Generar el APK

```bash
npx eas-cli@latest login          # crea una cuenta gratuita en expo.dev si no tienes
npx eas-cli@latest build -p android --profile preview
```

Al terminar, EAS te da un enlace para descargar el APK e instalarlo en cualquier Android.
El plan gratuito incluye 15 builds de Android al mes. Para Google Play usa `--profile production` (genera un AAB).

## Usuario de demo

Entras como **Sara**. Tiene:
- Un envío aceptado con Victoria (Lleida → Barcelona) y otro ya entregado con Mario, pendiente de valorar.
- Un trayecto publicado (Barcelona → Lleida) con 2 solicitudes: Laura (código de entrega **1185**) y Pol (**5560**).
- En el seguimiento de un envío hay un enlace gris "Demo: avanzar al siguiente estado" para simular lo que harán el carrier y el destinatario.

## Flujos incluidos

| Sender | Carrier | Cuenta |
|---|---|---|
| Buscar (ruta y fecha primero) → resultados → detalle → datos del paquete y destinatario → pago retenido → seguimiento | Publicar en 4 pasos con precio sugerido → solicitudes (aceptar/rechazar) → marcar recogido → confirmar entrega con código | Registro corto con opt-in y términos, login, recuperar contraseña |
| Compartir código con el destinatario por WhatsApp | Ganancias y retirada | Perfil propio y de otros, reportar usuario |
| Valorar, reportar incidencia, crear alerta | Chat con respuestas simuladas | Ajustes, FAQs |

## Estructura

```
src/
  app/            Pantallas (Expo Router: cada archivo es una ruta)
    (tabs)/       Buscar, Publicar, Trayectos, Mensajes, Mi perfil
  components/     UI reutilizable (botones, campos, tarjetas…)
  data/           Tipos, datos de demo y store (useStore)
  lib/            Tema (colores del Figma), precios, formatos
```

## Reglas de negocio implementadas

- **Precio sugerido** = 2 € + 0,02 €/km + extra por tamaño; el carrier puede ajustarlo ±30 % (mínimo 3 €). Ver `src/lib/pricing.ts`.
- **Total sender** = aportación del carrier + 30 % de gestión e IVA (6,30 € → 9,00 €).
- **Pago** retenido al solicitar; se reembolsa si el carrier rechaza o no responde en 12 h.
- **Entrega** confirmada con el código de 4 dígitos del destinatario.

## Siguientes pasos

1. **Supabase**: login real, tablas (users, trips, shipments, messages, reviews) y chat en tiempo real. Las pantallas no cambian: solo las acciones de `src/data/store.tsx`.
2. **Stripe Connect**: pago retenido (`capture_method: manual`) y transferencia al carrier al confirmar la entrega.
3. **Notificaciones push** (expo-notifications) para solicitudes, aceptaciones y alertas.
4. **Cámara** (expo-camera) para escanear el QR del destinatario.
5. **Enlace del destinatario**: página web sencilla con su código y QR.
