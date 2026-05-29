import { eventos as eventosLocales } from '../data/eventos.js';

const A_CONFIRMAR = 'A confirmar';

let eventosCachePromise;

/**
 * Returns today's date at midnight (local time) for stable comparison.
 * @returns {Date}
 */
function todayMidnight() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Parse a YYYY-MM-DD string to a Date at midnight local time.
 * @param {string|undefined} dateStr
 * @returns {Date|null}
 */
function parseLocalDate(dateStr) {
  const normalizedDate = normalizeDateString(dateStr);
  if (!normalizedDate) return null;

  const [year, month, day] = normalizedDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * @param {string|undefined} dateStr
 * @returns {boolean}
 */
function isValidDateString(dateStr) {
  return Boolean(normalizeDateString(dateStr));
}

/**
 * Acepta YYYY-MM-DD y también DD/MM/YYYY porque Google Forms puede exportar así.
 * @param {string|undefined} dateStr
 * @returns {string|undefined}
 */
function normalizeDateString(dateStr) {
  const value = cleanText(dateStr);
  let year;
  let month;
  let day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    [year, month, day] = value.split('-').map(Number);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
    [day, month, year] = value.split('/').map(Number);
  } else {
    return undefined;
  }

  const d = new Date(year, month - 1, day);

  const isValid =
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day;

  if (!isValid) return undefined;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value ?? '').trim();
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanTextOrFallback(value) {
  return cleanText(value) || A_CONFIRMAR;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeForCompare(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Genera un id simple para usar en la URL si la planilla no trae uno.
 * @param {string} value
 * @returns {string}
 */
export function generateEventId(value) {
  const id = cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return id || 'evento-sin-nombre';
}

/**
 * @param {string} id
 * @param {Set<string>} usedIds
 * @returns {string}
 */
function makeUniqueId(id, usedIds) {
  let finalId = id;
  let counter = 2;

  while (usedIds.has(finalId)) {
    finalId = `${id}-${counter}`;
    counter += 1;
  }

  usedIds.add(finalId);
  return finalId;
}

/**
 * Calculamos el estado según la fecha.
 * @param {{ fechaInicio?: string, fechaFin?: string, estadoManual?: string, confirmado?: boolean }} evento
 * @param {Date} today
 * @returns {'Próximo'|'Pasado'|'A confirmar'}
 */
export function calculateEventStatus(evento, today = todayMidnight()) {
  if (evento.estadoManual === 'a-confirmar' || evento.confirmado === false) {
    return A_CONFIRMAR;
  }

  const inicio = parseLocalDate(evento.fechaInicio);
  const fin = parseLocalDate(evento.fechaFin);

  if (!inicio || !fin) return A_CONFIRMAR;
  return fin < today ? 'Pasado' : 'Próximo';
}

/**
 * @param {{ fechaInicio?: string, fechaFin?: string, estadoManual?: string, confirmado?: boolean }} evento
 * @param {Date} today
 * @returns {'Próximo'|'Pasado'|'A confirmar'}
 */
export function getEventoStatus(evento, today = todayMidnight()) {
  return calculateEventStatus(evento, today);
}

/**
 * Leemos los eventos desde Google Sheets.
 * @param {string} csvUrl
 * @returns {Promise<string>}
 */
export async function readCsvFromGoogleSheets(csvUrl) {
  const response = await fetch(csvUrl);

  if (!response.ok) {
    throw new Error(`Google Sheets respondió con estado ${response.status}`);
  }

  return response.text();
}

/**
 * Convierte el CSV en filas, soportando comas entre comillas y campos vacíos.
 * @param {string} csv
 * @returns {string[][]}
 */
export function parseCsvRows(csv) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1;
      row.push(value);

      if (row.some((cell) => cleanText(cell) !== '')) rows.push(row);

      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  if (row.some((cell) => cleanText(cell) !== '')) rows.push(row);

  return rows;
}

/**
 * Convertimos el CSV en objetos JavaScript.
 * @param {string} csv
 * @returns {Record<string, string>[]}
 */
export function csvToObjects(csv) {
  const rows = parseCsvRows(csv);

  if (rows.length === 0) {
    throw new Error('El CSV no tiene encabezados.');
  }

  const headers = rows[0].map((header) => cleanText(header));

  return rows.slice(1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = cleanText(row[index]);
    });

    return item;
  });
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isApproved(value) {
  return normalizeForCompare(cleanText(value)) === 'si';
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function cleanCategories(value) {
  const categories = cleanText(value)
    .split(',')
    .map((category) => cleanText(category))
    .filter(Boolean);

  return categories.length > 0 ? categories : [A_CONFIRMAR];
}

/**
 * @param {unknown} value
 * @returns {string|undefined}
 */
function cleanOptionalUrl(value) {
  return cleanText(value) || undefined;
}

/**
 * @param {string|undefined} fechaInicio
 * @param {string|undefined} fechaFin
 * @returns {string}
 */
function buildDateText(fechaInicio, fechaFin) {
  if (!parseLocalDate(fechaInicio) || !parseLocalDate(fechaFin)) return A_CONFIRMAR;
  if (fechaInicio === fechaFin) return formatDateLong(fechaInicio);
  return `${formatDateLong(fechaInicio)} al ${formatDateLong(fechaFin)}`;
}

/**
 * Limpiamos los datos para mantener el formato que usa el proyecto.
 * @param {Record<string, string>} row
 * @param {number} index
 * @param {Set<string>} usedIds
 */
export function cleanEvent(row, index, usedIds = new Set()) {
  const rawName = cleanText(row.nombre);
  const fechaInicio = normalizeDateString(row.fechaInicio);
  const fechaFin = normalizeDateString(row.fechaFin);
  const estado = calculateEventStatus({ fechaInicio, fechaFin });
  const idSource = cleanText(row.id) || rawName || `evento-${index + 1}`;
  const descripcion = cleanTextOrFallback(row.descripcion);

  return {
    id: makeUniqueId(generateEventId(idSource), usedIds),
    nombre: rawName || A_CONFIRMAR,
    resumen: descripcion,
    descripcion,
    fechaInicio,
    fechaFin,
    fechaTexto: buildDateText(fechaInicio, fechaFin),
    lugar: cleanTextOrFallback(row.lugar),
    direccion: undefined,
    modalidad: cleanTextOrFallback(row.modalidad),
    categorias: cleanCategories(row.categoria),
    precio: cleanTextOrFallback(row.precio),
    urlOficial: cleanOptionalUrl(row.linkOficial),
    imagen: undefined,
    estado,
    estadoManual: estado === A_CONFIRMAR ? 'a-confirmar' : undefined,
    calendarDescription: descripcion,
    confirmado: estado !== A_CONFIRMAR,
    allDay: true,
  };
}

/**
 * Filtramos solo los eventos aprobados y los limpiamos.
 * @param {Record<string, string>[]} rows
 */
export function cleanEvents(rows) {
  const usedIds = new Set();

  return rows
    .filter((row) => isApproved(row.aprobado))
    .map((row, index) => cleanEvent(row, index, usedIds));
}

/**
 * Ordenamos por fechaInicio ascendente. Los eventos sin fecha válida quedan al final.
 * Si dos eventos empiezan el mismo día, conservamos el orden original de la fuente.
 * @param {Array<{ fechaInicio?: string, nombre: string }>} eventList
 */
export function sortEventsByStartDate(eventList) {
  return [...eventList].sort((a, b) => {
    const startA = parseLocalDate(a.fechaInicio)?.getTime() ?? Number.POSITIVE_INFINITY;
    const startB = parseLocalDate(b.fechaInicio)?.getTime() ?? Number.POSITIVE_INFINITY;

    return startA - startB;
  });
}

/**
 * Si falla Google Sheets, usamos los eventos locales.
 * @param {string} reason
 * @param {unknown} error
 */
function useLocalFallback(reason, error) {
  console.warn(`[eventos] ${reason} Usando fallback local.`, error ?? '');
  return sortEventsByStartDate(eventosLocales);
}

async function loadEventos() {
  const csvUrl = cleanText(
    import.meta.env?.PUBLIC_GOOGLE_SHEETS_CSV_URL ??
      (typeof process !== 'undefined' ? process.env.PUBLIC_GOOGLE_SHEETS_CSV_URL : undefined)
  );

  if (!csvUrl) {
    return useLocalFallback('PUBLIC_GOOGLE_SHEETS_CSV_URL no está configurada.');
  }

  try {
    // Leemos los eventos desde Google Sheets
    const csv = await readCsvFromGoogleSheets(csvUrl);
    // Convertimos el CSV en objetos JavaScript
    const rows = csvToObjects(csv);
    // Filtramos solo los eventos aprobados
    const cleanRows = cleanEvents(rows);

    return sortEventsByStartDate(cleanRows);
  } catch (error) {
    return useLocalFallback('No se pudo leer Google Sheets.', error);
  }
}

/**
 * @returns {Promise<import('../data/eventos.js').Evento[]>}
 */
export function getEventos() {
  if (!eventosCachePromise) eventosCachePromise = loadEventos();
  return eventosCachePromise;
}

/**
 * @param {string} id
 */
export async function getEventoById(id) {
  const eventList = await getEventos();
  return eventList.find((evento) => evento.id === id);
}

/**
 * Format a Date as YYYYMMDD for Google Calendar all-day events.
 * @param {Date} d
 * @returns {string}
 */
function toYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Add one calendar day to a Date.
 * @param {Date} d
 * @returns {Date}
 */
function nextDay(d) {
  const result = new Date(d);
  result.setDate(result.getDate() + 1);
  return result;
}

/**
 * Build a Google Calendar "add" URL for an event.
 * @param {{ nombre: string, fechaInicio?: string, fechaFin?: string, confirmado?: boolean, estadoManual?: string, calendarDescription?: string, resumen?: string, lugar?: string, allDay?: boolean }} evento
 * @returns {string|null}
 */
export function buildGoogleCalendarUrl(evento) {
  const allDay = evento.allDay !== false;
  const startStr = evento.fechaInicio;
  const endStr = evento.fechaFin;

  if (!startStr || !endStr) return null;
  if (evento.confirmado === false || evento.estadoManual === 'a-confirmar') return null;

  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
  const text = encodeURIComponent(evento.nombre);

  let dates;
  if (allDay) {
    const start = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);
    if (!start || !end) return null;
    const endExclusive = nextDay(end);
    dates = `${toYYYYMMDD(start)}/${toYYYYMMDD(endExclusive)}`;
  } else {
    dates = `${startStr}/${endStr}`;
  }

  const details = encodeURIComponent(
    evento.calendarDescription ||
      evento.resumen ||
      `Evento de tecnología en ${evento.lugar}`
  );
  const location = encodeURIComponent(evento.lugar || '');

  return `${base}&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

/**
 * @param {string|undefined} dateStr  YYYY-MM-DD
 * @returns {string}
 */
export function formatDateLong(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return A_CONFIRMAR;
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * @param {string|undefined} dateStr  YYYY-MM-DD
 * @returns {string}
 */
export function formatMonthYear(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return A_CONFIRMAR;
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}
