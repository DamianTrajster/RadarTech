/**
 * RadarTech BA — Event catalog, status helpers, and Google Calendar integration.
 *
 * Data contract:
 *   id, nombre, resumen, descripcion,
 *   fechaInicio, fechaFin, fechaTexto,
 *   lugar, direccion, modalidad,
 *   categorias: string[], precio,
 *   urlOficial, urlMapa, imagen,
 *   estadoManual, calendarDescription,
 *   allDay: true
 */

/** @typedef {{ id: string, nombre: string, resumen: string, fechaTexto: string, lugar: string, modalidad: string, categorias: string[], precio: string|undefined, urlOficial: string|undefined, confirmado: boolean }} Evento */

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
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Evento} evento
 * @param {Date} today
 * @returns {'Próximo'|'Pasado'|'A confirmar'}
 */
export function getEventoStatus(evento, today = todayMidnight()) {
  if (evento.estadoManual === 'a-confirmar' || evento.confirmado === false) {
    return 'A confirmar';
  }
  const fin = parseLocalDate(evento.fechaFin);
  if (!fin) return 'A confirmar';
  if (fin < today) return 'Pasado';
  return 'Próximo';
}

/**
 * Sort events for the home agenda:
 * - upcoming events first, from nearest to farthest
 * - tentative events after confirmed upcoming events
 * - past events last, from most recent to oldest
 *
 * @param {Evento[]} eventList
 * @param {Date} today
 * @returns {Evento[]}
 */
export function getEventosOrdenadosPorFecha(eventList = eventos, today = todayMidnight()) {
  const statusOrder = {
    'Próximo': 0,
    'A confirmar': 1,
    'Pasado': 2,
  };

  return [...eventList].sort((a, b) => {
    const statusA = getEventoStatus(a, today);
    const statusB = getEventoStatus(b, today);

    if (statusA !== statusB) {
      return statusOrder[statusA] - statusOrder[statusB];
    }

    const startA = parseLocalDate(a.fechaInicio)?.getTime() ?? Number.POSITIVE_INFINITY;
    const startB = parseLocalDate(b.fechaInicio)?.getTime() ?? Number.POSITIVE_INFINITY;
    const endA = parseLocalDate(a.fechaFin)?.getTime() ?? startA;
    const endB = parseLocalDate(b.fechaFin)?.getTime() ?? startB;

    if (statusA === 'Pasado') {
      return endB - endA;
    }

    if (startA !== startB) {
      return startA - startB;
    }

    return a.nombre.localeCompare(b.nombre, 'es-AR');
  });
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
 * Returns null for tentative/unusable dates.
 *
 * @param {Evento} evento
 * @returns {string|null}
 */
export function buildGoogleCalendarUrl(evento) {
  const allDay = evento.allDay !== false; // default true
  const startStr = evento.fechaInicio;
  const endStr = evento.fechaFin;

  // Tentative or missing dates → no calendar link
  if (!startStr || !endStr) return null;
  if (evento.confirmado === false || evento.estadoManual === 'a-confirmar') return null;

  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE';

  const text = encodeURIComponent(evento.nombre);

  let dates;
  if (allDay) {
    // Google Calendar all-day uses exclusive end date
    const start = parseLocalDate(startStr);
    const end = parseLocalDate(endStr);
    if (!start || !end) return null;
    const endExclusive = nextDay(end);
    dates = `${toYYYYMMDD(start)}/${toYYYYMMDD(endExclusive)}`;
  } else {
    // Timed event — use as-provided strings (assumed UTC ISO)
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
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}  e.g. "17 Mayo 2026"
 */
export function formatDateLong(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * @param {string} dateStr  YYYY-MM-DD
 * @returns {string}  e.g. "Mayo 2026"
 */
export function formatMonthYear(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

/**
 * All known events. Fields:
 *   id, nombre, resumen, descripcion,
 *   fechaInicio, fechaFin, fechaTexto,
 *   lugar, modalidad, categorias, precio,
 *   urlOficial, confirmado, allDay, calendarDescription
 *
 * Mark tentative items with confirmado: false so status renders "A confirmar".
 *
 * @type {Evento[]}
 */
export const eventos = [
  {
    id: 'nerdearla-argentina-2026',
    nombre: 'Nerdearla Argentina 2026',
    resumen: 'La conferencia de tecnología más esperada del año. Dos días de charlas, workshops y networking.',
    descripcion:
      'Nerdearla es una conferencia anual de tecnología que reúne a profesionales, estudiantes y entusiastas del desarrollo de software, la inteligencia artificial, la ciberseguridad y más. Edición 2026 en Buenos Aires.',
    fechaInicio: '2026-09-22',
    fechaFin: '2026-09-26',
    fechaTexto: '22 al 26 de Septiembre, 2026',
    lugar: 'Buenos Aires, Argentina, ',
    direccion: 'Ciudad Cultural Konex - Sarmiento 3131',
    modalidad: 'Presencial y Online',
    categorias: ['Conferencia', 'Desarrollo', 'IA', 'Seguridad'],
    precio: 'Gratis',
    urlOficial: 'https://nerdearla.com',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Conferencia de tecnología en Buenos Aires. Más info: https://nerdearla.com',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'testear-la-2026',
    nombre: 'Testear.la 2026',
    resumen: 'Meetup de testing y calidad de software en Buenos Aires.',
    descripcion:
      'Testear.la es un evento comunitario enfocado en testing, QA, automatización y calidad de software. Charlas prácticas, demo sessions y networking para testers y desarrolladores.',
    fechaInicio: '2026-09-09',
    fechaFin: '2026-09-11',
    fechaTexto: '09 al 11 de Septiembre , 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: 'A confirmar',
    modalidad: 'Presencial',
    categorias: ['Testing', 'QA', 'Automatización'],
    precio: 'Gratis',
    urlOficial: 'https://testear.la',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Meetup de testing y calidad de software.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'tech4impact-2026',
    nombre: 'Tech4Impact 2026 by Naranja X',
    resumen: 'Evento sobre tecnología, innovación social y cambio positivo.',
    descripcion:
      'Tech4Impact es un evento que explora cómo la tecnología puede generar impacto social positivo. Organizado por Naranja X, reúne a startups, emprendedores sociales y empresas con propósito.',
    fechaInicio: '2026-05-27',
    fechaFin: '2026-05-27',
    fechaTexto: '27 de Mayo, 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: 'Complejo C Art Media - Av. Corrientes 6271', 
    modalidad: 'Presencial',
    categorias: ['Innovación', 'Social', 'Startups'],
    precio: 'Gratis',
    urlOficial: 'https://tech4impact.naranjax.com/',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Evento de tecnología con impacto social. Organizado por Naranja X.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'devopsdays-caba-2026',
    nombre: 'DevOpsDays Ciudad Autónoma de Buenos Aires 2026',
    resumen: 'Conferencia DevOps en Buenos Aires. Automatización, cultura y entregas.',
    descripcion:
      'DevOpsDays CABA es la edición local de la conferencia global DevOps. Dos días de charlas sobre automatización, CI/CD, cultura DevOps, infraestructura como código y entrega continua.',
    fechaInicio: '2026-04-21',
    fechaFin: '2026-04-22',
    fechaTexto: '21 y 22 de Abril, 2026',
    lugar: 'Ciudad Autónoma de Buenos Aires',
    direccion: 'Centro Galicia',
    modalidad: 'Presencial',
    categorias: ['DevOps', 'Automatización', 'Infraestructura'],
    precio: 'A confirmar',
    urlOficial: 'https://devopsdays.org',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Conferencia DevOps en Buenos Aires. Más info: https://devopsdays.org',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'aws-ug-buenos-aires',
    nombre: 'AWS User Group Buenos Aires',
    resumen: 'Meetup mensual de la comunidad AWS en Buenos Aires.',
    descripcion:
      'AWS User Group Buenos Aires es una comunidad de desarrolladores y profesionales de cloud que se reúnen mensualmente para compartir conocimiento, casos de uso y mejores prácticas con AWS.',
    fechaInicio: '2026-08-12',
    fechaFin: '2026-08-12',
    fechaTexto: '12 de Agosto, 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: 'Pedidos Ya HQ',
    modalidad: 'Presencial',
    categorias: ['Cloud', 'AWS', 'Meetup'],
    precio: 'Gratis',
    urlOficial: 'https://aws.amazon.com/es/community/usergroups/',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Meetup de la comunidad AWS en Buenos Aires.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'htb-meetup-argentina',
    nombre: 'Hack The Box Meetup Argentina',
    resumen: 'Encuentro de seguridad ofensiva y CTFs en Argentina.',
    descripcion:
      'Hack The Box Meetup Argentina reune a entusiastas de la ciberseguridad, ethical hackers y jugadores de CTF para practicar, compartir técnicas y aprender juntos en un ambiente colaborativo.',
    fechaInicio: '2026-05-30',
    fechaFin: '2026-05-30',
    fechaTexto: '30 de Mayo, 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: 'Universidad Tecnológica Nacional',
    modalidad: 'Presencial',
    categorias: ['Ciberseguridad', 'CTF', 'Hacking'],
    precio: 'Gratis',
    urlOficial: 'https://hackthebox.com',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Meetup de Hack The Box y ciberseguridad en Argentina.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'rubysur-ba',
    nombre: 'RubySur Buenos Aires',
    resumen: 'Meetup de la comunidad Ruby de Buenos Aires.',
    descripcion:
      'RubySur es la comunidad de Ruby y Ruby on Rails en Buenos Aires. Meetups mensuales con charlas técnicas, code reviews y networking para desarrolladores.',
    fechaInicio: '2026-06-25',
    fechaFin: '2026-06-25',
    fechaTexto: '25 de Junio, 2026',
    lugar: 'Ciudad Autónoma de Buenos Aires',
    direccion: 'Mercado Libre HQ',
    modalidad: 'Presencial',
    categorias: ['Ruby', 'Rails', 'Desarrollo'],
    precio: 'Gratis',
    urlOficial: 'https://rubysur.org',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Meetup de la comunidad Ruby en Buenos Aires.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'ekoparty-2026',
    nombre: 'EkoParty 2026',
    resumen: 'Conferencia de seguridad informática, hacking y investigación.',
    descripcion:
      'EkoParty es una de las conferencias de seguridad más importantes de América Latina. Charlas de investigación en seguridad, workshops de hacking, CTFs y mucho networking.',
    fechaInicio: '2026-10-07',
    fechaFin: '2026-10-09',
    fechaTexto: '7 al 9 de Octubre, 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: ' CEC – Buenos Aires - Av. Pres. Figueroa Alcorta 2099 ',
    modalidad: 'Presencial',
    categorias: ['Seguridad', 'Hacking', 'Conferencia'],
    precio: 'A confirmar',
    urlOficial: 'https://ekoparty.org',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'Conferencia de seguridad informática en Buenos Aires. Más info: https://ekoparty.org',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'aws-community-day-argentina-2026',
    nombre: 'AWS Community Day Argentina 2026',
    resumen: 'Día de la comunidad AWS en Argentina. Charlas, demos y networking.',
    descripcion:
      'AWS Community Day Argentina es un evento gratuito organizado por la comunidad AWS local para compartir conocimientos sobre cloud computing, arquitectura, serverless y más.',
    fechaInicio: '2026-09-13',
    fechaFin: '2026-09-13',
    fechaTexto: '13 de Septiembre, 2026',
    lugar: 'Buenos Aires, Argentina',
    direccion: 'A confirmar',
    modalidad: 'Presencial',
    categorias: ['Cloud', 'AWS', 'Comunidad'],
    precio: 'Gratis',
    urlOficial: 'https://www.awsarg.org/',
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'AWS Community Day en Argentina. Día de la comunidad AWS.',
    confirmado: true,
    allDay: true,
  },
  {
    id: 'caper-show',
    nombre: 'CAPER SHOW',
    resumen: 'Show de tecnología, desarrollo de software y tendencias.',
    descripcion:
      'En CAPER SHOW se exhiben equipos y soluciones para la creación, edición, comercialización, almacenamiento y distribución de Contenidos Audiovisuales. Productos ...',
    fechaInicio: '2026-10-07',
    fechaFin: '2026-10-09',
    fechaTexto: '07 al 09 de Octubre, 2026',
    lugar: 'Ciudad Autónoma de Buenos Aires',
    direccion: 'BA FERIAL (ex Centro Costa Salguero), Pabellón 5',
    modalidad: 'Presencial',
    categorias: ['Desarrollo', 'Conferencia', 'Tendencias'],
    precio: 'A confirmar',
    urlOficial: undefined,
    imagen: undefined,
    estadoManual: undefined,
    calendarDescription: 'CAPER SHOW - Evento de tecnología y desarrollo en Buenos Aires.',
    confirmado: true,
    allDay: true,
  },
];

/**
 * Lookup a single event by id.
 * @param {string} id
 * @returns {Evento|undefined}
 */
export function getEventoById(id) {
  return eventos.find((e) => e.id === id);
}
