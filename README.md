# RadarTech BA

RadarTech BA es una landing estática hecha con Astro para descubrir eventos de tecnología en Buenos Aires y Argentina. La web lista eventos, permite filtrarlos, muestra detalles individuales y ayuda a agregarlos a Google Calendar.

## Camino rápido

```bash
npm install
npm run dev
```

Para validar antes de deployar:

```bash
npm run verify
```

Ese comando ejecuta el build de Astro y el smoke test del sitio generado.

## Qué incluye

| Área | Descripción |
|------|-------------|
| Framework | Astro 5 con Tailwind CSS. |
| Tipo de sitio | Static site, publica HTML en `dist/`. |
| Fuente de eventos | Google Sheets CSV público, con fallback local. |
| Filtros | Búsqueda por nombre, categoría y estado. |
| Estados | `Próximo`, `Pasado` y `A confirmar`. |
| Calendario | Links para agregar eventos confirmados a Google Calendar. |
| SEO | Metadata, canonical URL y structured data. |
| Deploy | Netlify con build command `npm run build` y publish directory `dist`. |

## Scripts disponibles

```bash
npm run dev      # servidor local de desarrollo
npm run build    # genera el sitio estático en dist/
npm run preview  # previsualiza el build local
npm run smoke    # prueba básica contra dist/
npm run verify   # build + smoke test
```

## Variables de entorno

Copiá `.env.example` a `.env` para desarrollo local si necesitás configurar valores.

```env
PUBLIC_GOOGLE_SHEETS_CSV_URL=
PUBLIC_SITE_URL=
NETLIFY_BUILD_HOOK_URL=
```

| Variable | Uso |
|----------|-----|
| `PUBLIC_GOOGLE_SHEETS_CSV_URL` | URL pública del CSV de Google Sheets usado como fuente de eventos. |
| `PUBLIC_SITE_URL` | URL pública del sitio, usada para canonical URLs y metadata. |
| `NETLIFY_BUILD_HOOK_URL` | URL secreta del Build Hook de Netlify para disparar rebuilds diarios. |

> Importante: `NETLIFY_BUILD_HOOK_URL` es secreta. No la subas al repo. Configurala en Netlify como environment variable.

## Cómo se actualizan los eventos

El sitio estático calcula los estados en build time, pero también tiene una protección client-side:

1. Astro genera el HTML inicial con el estado del evento.
2. Al cargar la página, un script recalcula el estado usando la fecha actual del navegador.
3. Si un evento ya terminó, el badge cambia automáticamente de `Próximo` a `Pasado`.
4. Después de medianoche, el script vuelve a recalcular los estados.
5. En Netlify, una función programada dispara un rebuild diario para mantener fresco también el HTML generado y el SEO.

La función está en:

```txt
netlify/functions/daily-rebuild.mjs
```

Corre todos los días a las `08:15 UTC`, que equivale aproximadamente a `05:15` en Argentina.

## Deploy en Netlify

Configuración esperada:

| Campo | Valor |
|-------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | `20` |

El archivo `netlify.toml` ya define:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"
```

### Build Hook diario

Para que el rebuild diario funcione:

1. En Netlify, conectá el sitio a un repositorio Git.
2. Andá a `Project configuration > Build & deploy > Continuous deployment > Build hooks`.
3. Creá un hook, por ejemplo `daily-rebuild`.
4. Copiá la URL generada.
5. Agregala como environment variable secreta:

```env
NETLIFY_BUILD_HOOK_URL=https://api.netlify.com/build_hooks/...
```

Después hacé un deploy nuevo para que Netlify tome la variable y publique la función programada.

## Estructura del proyecto

```txt
src/
  components/       # componentes visuales como cards, filtros y header
  data/             # datos locales de fallback
  layouts/          # layout base, SEO y scripts globales
  lib/              # lectura/parsing de eventos y helpers de fechas/calendario
  pages/            # home y páginas de detalle de eventos
  styles/           # estilos globales
netlify/functions/  # funciones programadas de Netlify
scripts/            # smoke tests
public/             # assets públicos estáticos
```

## Qué no se sube a Git

El `.gitignore` evita subir archivos generados o secretos:

```txt
node_modules/
dist/
.astro/
.env
.env.*
.netlify/
```

Sí se sube `.env.example`, porque solo documenta las variables vacías.

## Checklist antes de publicar

- [ ] `.env` no está trackeado por Git.
- [ ] `NETLIFY_BUILD_HOOK_URL` está cargada en Netlify, no en el repo.
- [ ] El sitio está conectado a un repositorio Git.
- [ ] `npm run verify` pasa localmente.
- [ ] Netlify muestra la función `daily-rebuild` después del deploy.
