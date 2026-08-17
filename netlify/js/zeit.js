/**
 * zeit.js — Datum, Uhrzeit und ISO-Kalenderwochen.
 *
 * Alles ausdruecklich in Europe/Berlin gerechnet, niemals in der Zeitzone
 * des Geraets. Sonst spraenge der Wochenwechsel auf den drei Geraeten zu
 * unterschiedlichen Zeitpunkten, und eine erledigte Aufgabe erschiene auf
 * dem einen Geraet als offen.
 *
 * ISO 8601: Die Woche beginnt am Montag, und Woche 1 ist die Woche mit dem
 * ersten Donnerstag des Jahres.
 */

const ZONE = 'Europe/Berlin';
const TAG_IN_MS = 86400000;

const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

/** Kalendertag in Berlin — unabhaengig davon, wo das Geraet steht. */
export function heute(jetzt = new Date()) {
  // en-CA liefert verlaesslich JJJJ-MM-TT.
  const [jahr, monat, tag] = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(jetzt).split('-').map(Number);
  return { jahr, monat, tag };
}

/** Uhrzeit in Berlin als { stunde, minute, sekunde, minuten }. */
export function uhrzeit(jetzt = new Date()) {
  const [stunde, minute, sekunde] = new Intl.DateTimeFormat('de-DE', {
    timeZone: ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(jetzt).split(':').map(Number);
  return { stunde, minute, sekunde, minuten: stunde * 60 + minute };
}

/** '2026-08-17' aus einem Tagesobjekt. */
export function alsIso({ jahr, monat, tag }) {
  return `${jahr}-${String(monat).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
}

/** 'TT.MM.JJJJ' fuer die Anzeige. */
export function alsDeutsch({ jahr, monat, tag }) {
  return `${String(tag).padStart(2, '0')}.${String(monat).padStart(2, '0')}.${jahr}`;
}

/**
 * Wochentag als Zahl: 1 = Montag … 7 = Sonntag.
 * Passt zur Spalte `wochentag` im Blatt Stundenplan.
 */
export function wochentag(tagesobjekt) {
  const d = alsUtc(tagesobjekt);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export function wochentagName(nummer) {
  return WOCHENTAGE[nummer - 1] || '';
}

export function istWochenende(tagesobjekt) {
  return wochentag(tagesobjekt) >= 6;
}

/**
 * Rechnet auf einem UTC-Datum, nicht auf einem lokalen. Ein lokales Datum
 * verschoebe sich bei der Sommerzeitumstellung um eine Stunde und koennte
 * dadurch auf den Vortag kippen.
 */
function alsUtc({ jahr, monat, tag }) {
  return new Date(Date.UTC(jahr, monat - 1, tag));
}

/**
 * ISO-Kalenderwoche als { jahr, woche }.
 *
 * Das ISO-Wochenjahr weicht am Jahreswechsel bewusst vom Kalenderjahr ab:
 * Der 1. Januar 2027 ist ein Freitag und gehoert damit noch zur Woche 53
 * des Jahres 2026.
 */
export function isoWoche(tagesobjekt) {
  const d = alsUtc(tagesobjekt);

  // Auf den Donnerstag dieser Woche springen — er bestimmt das Wochenjahr.
  const versatz = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - versatz + 3);
  const wochenjahr = d.getUTCFullYear();

  // Der 4. Januar liegt immer in Woche 1; von dort aus auf deren Donnerstag.
  const ersterDonnerstag = new Date(Date.UTC(wochenjahr, 0, 4));
  const versatz2 = (ersterDonnerstag.getUTCDay() + 6) % 7;
  ersterDonnerstag.setUTCDate(ersterDonnerstag.getUTCDate() - versatz2 + 3);

  const woche = 1 + Math.round((d.getTime() - ersterDonnerstag.getTime()) / (7 * TAG_IN_MS));
  return { jahr: wochenjahr, woche };
}

/** Kennung fuer das Blatt Wochenstatus, z. B. '2026-W34'. */
export function kwKennung(tagesobjekt) {
  const { jahr, woche } = isoWoche(tagesobjekt);
  return `${jahr}-W${String(woche).padStart(2, '0')}`;
}

/** 'HH:MM' in Minuten seit Mitternacht; null bei ungueltiger Eingabe. */
export function alsMinuten(uhrzeitText) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(uhrzeitText || '').trim());
  if (!m) return null;
  const stunde = Number(m[1]);
  const minute = Number(m[2]);
  if (stunde > 23 || minute > 59) return null;
  return stunde * 60 + minute;
}

/**
 * Liegt der Tag im ersten Halbjahr? `grenze` ist der letzte Tag des ersten
 * Halbjahres im Format 'MM-TT'.
 */
export function istErstesHalbjahr(tagesobjekt, grenze, schuljahresbeginn) {
  const g = /^(\d{2})-(\d{2})$/.exec(String(grenze || '').trim());
  if (!g) return true;
  const grenzMonat = Number(g[1]);
  const grenzTag = Number(g[2]);

  const beginnMonat = schuljahresbeginn
    ? Number(String(schuljahresbeginn).slice(5, 7))
    : 8;

  // Das Schuljahr laeuft ueber den Jahreswechsel. Alles vom Schuljahresbeginn
  // bis zur Grenze zaehlt zum ersten Halbjahr.
  const nachBeginn = tagesobjekt.monat >= beginnMonat;
  const vorGrenze = tagesobjekt.monat < grenzMonat ||
                    (tagesobjekt.monat === grenzMonat && tagesobjekt.tag <= grenzTag);

  return nachBeginn || vorGrenze;
}
