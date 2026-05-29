/**
 * Smoke test for RadarTech BA build output.
 * Runs against dist/ (generated HTML) and src/lib/eventos.js (helpers).
 * Uses Node built-ins only; no external test runner needed.
 *
 * Usage: node scripts/smoke-test.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_TODAY = new Date('2026-05-17T00:00:00');
loadLocalEnv();

const {
  getEventoStatus,
  buildGoogleCalendarUrl,
  getEventos,
  sortEventsByStartDate,
} = await import('../src/lib/eventos.js');

const eventos = await getEventos();

function loadLocalEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) return;

  const envFile = readFileSync(envPath, 'utf-8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    process.env[key] ??= value;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`❌ FAIL: ${message}`);
  console.log(`✅ ${message}`);
}

// ── 1. Branding ──────────────────────────────────────────────────────────────

function checkBranding() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');
  assert(indexHtml.includes('RadarTech BA'), 'Home contains RadarTech BA branding');
  assert(indexHtml.includes('tech en Buenos Aires') || indexHtml.includes('Tecnología'), 'Home contains tagline text');
  console.log('  ✓ Branding verified');
}

// ── 1b. SEO and accessibility basics ─────────────────────────────────────────

function checkSeoAndAccessibilityBasics() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');

  assert(indexHtml.includes('property="og:title"'), 'Open Graph title meta present');
  assert(indexHtml.includes('name="twitter:card"'), 'Twitter card meta present');
  assert(indexHtml.includes('application/ld+json'), 'Structured data script present');
  assert(indexHtml.includes('class="skip-link"') && indexHtml.includes('#contenido-principal'), 'Skip link targets main content');
  assert(indexHtml.includes('<h1'), 'Home has a primary h1 heading');
  assert(indexHtml.includes('Buscar eventos por nombre'), 'Search input has an accessible label');
  assert(indexHtml.includes('aria-pressed="true"'), 'Filter buttons expose pressed state');

  console.log('  ✓ SEO and accessibility basics verified');
}

// ── 2. Event cards & summaries ────────────────────────────────────────────────

function checkEventCards() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');

  // All event names should appear in the home page
  const eventNames = eventos.map(e => e.nombre);
  const missingNames = eventNames.filter(n => !indexHtml.includes(n));
  assert(missingNames.length === 0, `All ${eventNames.length} event names present on home (missing: ${missingNames.join(', ')})`);

  // Every event's resumen should appear as a card summary
  const missingResúmenes = eventos.filter(e => !indexHtml.includes(e.resumen));
  assert(missingResúmenes.length === 0, `All event summaries present on cards (missing: ${missingResúmenes.map(e => e.nombre).join(', ')})`);

  console.log(`  ✓ All ${eventNames.length} event cards with summaries verified`);
}

// ── 2b. Event card order ─────────────────────────────────────────────────────

function checkEventCardOrder() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');
  const orderedEvents = sortEventsByStartDate(eventos);
  const positions = orderedEvents.map((evento) => ({
    nombre: evento.nombre,
    position: indexHtml.indexOf(evento.nombre),
  }));

  const missingEvents = positions.filter((event) => event.position === -1);
  assert(missingEvents.length === 0, `All ordered event names are present (missing: ${missingEvents.map(e => e.nombre).join(', ')})`);

  const isSorted = positions.every((event, index) => index === 0 || event.position > positions[index - 1].position);
  assert(isSorted, `Event cards are ordered by fechaInicio ascendente (${orderedEvents.map(e => e.nombre).join(' → ')})`);

  console.log('  ✓ Event card order verified');
}

// ── 3. Filter UI and client script hooks ──────────────────────────────────────

function checkFilters() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');
  assert(indexHtml.includes('search-input'), 'Search input present');
  assert(indexHtml.includes('category-pill'), 'Category filter pills present');
  assert(indexHtml.includes('status-pill'), 'Status filter pills present');
  // The filter script is bundled as a <script type="module"> (Astro/Vite minifies the code,
  // so function names like filterEvents become minified identifiers — check for the module
  // script tag and the key client-side hooks instead)
  assert(indexHtml.includes('type="module"') && indexHtml.includes('addEventListener'), 'Client-side filter script bundled (type="module" + event listeners present)');
  assert(indexHtml.includes('empty-state'), 'Empty state element present');
  console.log('  ✓ Filter UI and script hooks verified');
}

// ── 3b. Client-side status refresh hooks ──────────────────────────────────────

function checkClientSideStatusRefresh() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');

  assert(indexHtml.includes('data-event-status-scope'), 'Event cards expose status refresh scope');
  assert(indexHtml.includes('data-fecha-fin'), 'Event cards expose end date for client-side status refresh');
  assert(indexHtml.includes('data-event-status'), 'Event cards expose status badge hook');
  assert(indexHtml.includes('event-status:updated'), 'Client-side status refresh notifies filters after changes');

  console.log('  ✓ Client-side status refresh hooks verified');
}

// ── 4. Detail pages ───────────────────────────────────────────────────────────

function checkDetailPages() {
  const distEventsDir = resolve('dist/eventos');
  const entries = readdirSync(distEventsDir, { withFileTypes: true });
  const detailDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const eventIds = eventos.map(e => e.id);
  const missingPages = eventIds.filter(id => !detailDirs.includes(id));
  assert(missingPages.length === 0, `All ${eventIds.length} detail pages exist (missing: ${missingPages.join(', ')})`);
  console.log(`  ✓ ${detailDirs.length} detail pages verified`);
}

// ── 5. getEventoStatus — DevOpsDays past event ───────────────────────────────

function checkStatusHelper() {
  const syntheticPastEvent = {
    id: 'test-past-event',
    nombre: 'Test Past Event',
    fechaInicio: '2026-04-21',
    fechaFin: '2026-04-22',
    confirmado: true,
  };

  const status = getEventoStatus(syntheticPastEvent, FIXED_TODAY);
  assert(status === 'Pasado', `Past event returns 'Pasado' (got: '${status}')`);

  console.log('  ✓ getEventoStatus Pasado verified');
}

// ── 6. Tentative event — A confirmar + null calendar ─────────────────────────

function checkTentativeEvent() {
  // Create a synthetic tentative event
  const synthetic = {
    id: 'test-tentative',
    nombre: 'Test Tentative Event',
    resumen: 'Synthetic smoke test event',
    fechaInicio: undefined,
    fechaFin: undefined,
    fechaTexto: 'Por confirmar',
    lugar: 'Buenos Aires',
    modalidad: 'Presencial',
    categorias: ['Test'],
    precio: 'A confirmar',
    urlOficial: undefined,
    confirmado: false,
    estadoManual: 'a-confirmar',
  };

  const status = getEventoStatus(synthetic, FIXED_TODAY);
  assert(status === 'A confirmar', `Tentative event returns 'A confirmar' (got: '${status}')`);

  const calendarUrl = buildGoogleCalendarUrl(synthetic);
  assert(calendarUrl === null, 'Tentative event buildGoogleCalendarUrl returns null');

  console.log('  ✓ Tentative event A confirmar + null calendar verified');
}

// ── 7. Confirmed events produce Google Calendar URLs ─────────────────────────

function checkCalendarUrls() {
  const confirmedEvents = eventos.filter(e => e.confirmado !== false && e.fechaInicio && e.fechaFin);
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');

  const missingCalUrls = confirmedEvents.filter(e => {
    const url = buildGoogleCalendarUrl(e);
    return !url || !indexHtml.includes(url);
  });

  assert(missingCalUrls.length === 0, `All confirmed events have Google Calendar URLs in home (missing: ${missingCalUrls.map(e => e.nombre).join(', ')})`);
  assert(indexHtml.includes('calendar.google.com/calendar/render'), 'Google Calendar base URL present in home');

  console.log(`  ✓ ${confirmedEvents.length} confirmed events with calendar URLs verified`);
}

// ── 8. netlify.toml ───────────────────────────────────────────────────────────

function checkNetlifyConfig() {
  const netlifyToml = readFileSync(resolve('netlify.toml'), 'utf-8');
  assert(netlifyToml.includes('npm run build') || netlifyToml.includes('"npm run build"'), 'netlify.toml contains build command');
  assert(netlifyToml.includes('dist') || netlifyToml.includes('publish'), 'netlify.toml contains publish dir');
  console.log('  ✓ netlify.toml verified');
}

// ── 8b. Netlify daily rebuild function ────────────────────────────────────────

function checkNetlifyDailyRebuild() {
  const functionPath = resolve('netlify/functions/daily-rebuild.mjs');
  const envExample = readFileSync(resolve('.env.example'), 'utf-8');

  assert(existsSync(functionPath), 'Netlify daily rebuild scheduled function exists');

  const functionSource = readFileSync(functionPath, 'utf-8');
  assert(functionSource.includes('NETLIFY_BUILD_HOOK_URL'), 'Daily rebuild uses NETLIFY_BUILD_HOOK_URL env var');
  assert(functionSource.includes('schedule') && functionSource.includes('15 8 * * *'), 'Daily rebuild is scheduled every day');
  assert(envExample.includes('NETLIFY_BUILD_HOOK_URL='), '.env.example documents NETLIFY_BUILD_HOOK_URL');

  console.log('  ✓ Netlify daily rebuild function verified');
}

// ── 9. Responsive Tailwind classes in built output ────────────────────────────

function checkResponsiveClasses() {
  const indexHtml = readFileSync(resolve('dist/index.html'), 'utf-8');
  // Tailwind compiles to escaped class names, but the raw output may still contain the originals
  // or their escaped variants. Check for sm:grid-cols-2 / lg:grid-cols-3 or escaped equivalents.
  const hasResponsive = indexHtml.includes('sm:grid-cols-2') || indexHtml.includes('lg:grid-cols-3') ||
    indexHtml.includes('sm\\:grid-cols-2') || indexHtml.includes('lg\\:grid-cols-3') ||
    indexHtml.includes('grid-cols-1') || indexHtml.includes('grid-cols-2') || indexHtml.includes('grid-cols-3');
  assert(hasResponsive, 'Responsive grid classes (sm:grid-cols-2, lg:grid-cols-3 or equivalent) present in built output');
  console.log('  ✓ Responsive Tailwind classes verified in dist');
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('\n🚀 RadarTech BA Smoke Test\n' + '─'.repeat(40));

try {
  // Preconditions
  assert(existsSync(resolve('dist/index.html')), 'dist/index.html exists (run npm run build first)');

  checkBranding();
  checkSeoAndAccessibilityBasics();
  checkEventCards();
  checkEventCardOrder();
  checkFilters();
  checkClientSideStatusRefresh();
  checkDetailPages();
  checkStatusHelper();
  checkTentativeEvent();
  checkCalendarUrls();
  checkNetlifyConfig();
  checkNetlifyDailyRebuild();
  checkResponsiveClasses();

  console.log('\n' + '─'.repeat(40) + '\n✅ All smoke tests passed!\n');
  process.exit(0);
} catch (err) {
  console.error('\n' + err.message + '\n');
  process.exit(1);
}
