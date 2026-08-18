/**
 * noten.js — reine Rechenlogik des Notentrackers, ohne Darstellung.
 *
 * Nachgebaut aus der bisherigen Numbers-Tabelle („Tracker") und Zeile fuer
 * Zeile gegen deren Ergebnisse geprueft (test/noten.mjs, 22 Prueffaelle aus
 * echten Zahlen). Drei Eigenheiten der Vorlage sind hier bewusst exakt
 * uebernommen — sie sehen wie Kleinigkeiten aus, aendern aber Noten:
 *
 * 1. Gerundet wird kaufmaennisch AUFWAERTS (90,5 -> 91), nicht symmetrisch.
 *    Numbers' MROUND(x;1) macht das; Math.round() in JS zufaellig auch,
 *    aber nur fuer positive Zahlen — deshalb steht es hier ausgeschrieben.
 * 2. „Mitarbeit/Praesentation" ist der Mittelwert der BEIDEN MITTELWERTE,
 *    nicht der Mittelwert aller Einzelwerte. Bei ungleicher Anzahl von
 *    Eintraegen ergibt das unterschiedliche Ergebnisse.
 * 3. Fehlende Eintraege zaehlen nicht mit — gemittelt wird ueber das, was
 *    da ist, nicht ueber alle moeglichen Termine.
 *
 * DATENSCHUTZ: Hier laufen ausschliesslich Kuerzel und Zahlen durch.
 */

/**
 * Die Notenstufen. Ein Kind bekommt die erste Stufe, deren Mindestprozent
 * es erreicht — deshalb ist die Reihenfolge absteigend verbindlich.
 * Wird beim Laden aus dem Blatt „Notenschluessel" ueberschrieben; diese
 * Liste ist nur die Rueckfallebene.
 */
export const NOTENSCHLUESSEL = [
  { note: 1, min_prozent: 92 },
  { note: 2, min_prozent: 80 },
  { note: 3, min_prozent: 67 },
  { note: 4, min_prozent: 50 },
  { note: 5, min_prozent: 23 },
  { note: 6, min_prozent: 0 }
];

/** Die Kategorien, wie sie in der Vorlage heissen. */
export const GRUPPE_TEST = 'TEST';
export const GRUPPE_PP = 'PP';

/**
 * Kaufmaennisch aufwaerts runden — 90,5 wird 91, nicht 90.
 * Entspricht MROUND(x;1) der Vorlage.
 */
export function runde(zahl) {
  return Math.floor(zahl + 0.5);
}

/** Mittelwert; null, wenn nichts vorliegt (nicht 0 — das waere eine Aussage). */
export function mittel(werte) {
  const zahlen = werte.filter((w) => typeof w === 'number' && !Number.isNaN(w));
  if (!zahlen.length) return null;
  return zahlen.reduce((s, w) => s + w, 0) / zahlen.length;
}

/**
 * Mitarbeitsnote: Mittel der beiden Mittelwerte. Liegt nur eine der beiden
 * Saeulen vor, gilt diese allein — sonst wuerde ein fehlender
 * Praesentationstermin die Mitarbeit halbieren.
 */
export function mitarbeitMittel(participation, presentation) {
  const p = mittel(participation);
  const v = mittel(presentation);
  if (p === null && v === null) return null;
  if (p === null) return v;
  if (v === null) return p;
  return (p + v) / 2;
}

/**
 * Note zu einem Prozentwert. `schluessel` kommt aus dem Blatt und muss
 * absteigend nach min_prozent sortiert sein; das wird hier sichergestellt,
 * damit eine versehentlich umsortierte Tabelle keine falschen Noten ergibt.
 */
export function noteFuer(prozent, schluessel = NOTENSCHLUESSEL) {
  if (prozent === null || prozent === undefined || Number.isNaN(prozent)) return null;
  const sortiert = [...schluessel].sort((a, b) => b.min_prozent - a.min_prozent);
  const treffer = sortiert.find((s) => prozent >= s.min_prozent);
  return treffer ? treffer.note : null;
}

/**
 * Gesamtprozent aus den Saeulenmittelwerten und den Gewichten.
 * `gewichte` bildet Gruppe -> Anteil ab, z. B. { TEST: 0.8, PP: 0.2 }.
 * Fehlt eine Saeule vollstaendig, wird ihr Gewicht auf die vorhandenen
 * verteilt — sonst bekaeme ein Kind ohne Testnote automatisch eine 6.
 */
export function gesamtProzent(saeulen, gewichte) {
  const vorhanden = Object.keys(gewichte).filter((g) => typeof saeulen[g] === 'number');
  if (!vorhanden.length) return null;

  const summeGewichte = vorhanden.reduce((s, g) => s + gewichte[g], 0);
  if (summeGewichte <= 0) return null;

  const roh = vorhanden.reduce((s, g) => s + saeulen[g] * gewichte[g], 0) / summeGewichte;
  return runde(roh);
}

/**
 * Vollstaendige Auswertung eines Kindes.
 *
 * `erhebungen` sind die bereits auf Kind, Fach und Halbjahr gefilterten
 * Zeilen; `kategorien` ordnet kategorie_id einer Gruppe zu.
 */
export function werteAus(erhebungen, { kategorien, gewichte, schluessel = NOTENSCHLUESSEL }) {
  const gruppeVon = {};
  kategorien.forEach((k) => { gruppeVon[k.id] = k.gruppe; });

  const nachKategorie = {};
  erhebungen.forEach((e) => {
    const wert = typeof e.wert === 'number' ? e.wert : Number(e.wert);
    if (Number.isNaN(wert)) return;
    (nachKategorie[e.kategorie_id] = nachKategorie[e.kategorie_id] || []).push(wert);
  });

  // Mittel je Kategorie, dann je Gruppe das Mittel der Kategorienmittel —
  // genau die Rechenweise der Vorlage (siehe Kopfkommentar, Punkt 2).
  const kategorieMittel = {};
  Object.keys(nachKategorie).forEach((id) => { kategorieMittel[id] = mittel(nachKategorie[id]); });

  const saeulen = {};
  Object.keys(gewichte).forEach((gruppe) => {
    const mittelDerGruppe = kategorien
      .filter((k) => k.gruppe === gruppe)
      .map((k) => kategorieMittel[k.id])
      .filter((m) => typeof m === 'number');
    const m = mittel(mittelDerGruppe);
    if (m !== null) saeulen[gruppe] = m;
  });

  const prozent = gesamtProzent(saeulen, gewichte);
  return {
    kategorieMittel,
    saeulen,
    prozent,
    note: noteFuer(prozent, schluessel),
    anzahl: erhebungen.length
  };
}

// --- Halbjahre ---------------------------------------------------------------

/** In welchem Monat das Schuljahr beginnt. August, sofern nichts anderes gilt. */
export const SCHULJAHR_BEGINN_MONAT = 8;

/**
 * Zu welchem Halbjahr gehoert ein Datum? `grenze` ist der letzte Tag des
 * ersten Halbjahres als 'MM-TT' (Vorbelegung '01-31').
 *
 * Ein Schuljahr laeuft ueber den Jahreswechsel: August bis Januar ist das
 * erste, Februar bis Juli das zweite Halbjahr. Die Monate ab dem
 * Schuljahresbeginn liegen deshalb immer im ersten Halbjahr, die Monate
 * davor entscheiden sich an der Grenze.
 */
export function halbjahrVon(datum, grenze = '01-31', beginnMonat = SCHULJAHR_BEGINN_MONAT) {
  const [jahr, monat, tag] = String(datum).slice(0, 10).split('-').map(Number);
  if (!jahr || !monat || !tag) return null;
  const [gMonat, gTag] = String(grenze).split('-').map(Number);

  if (monat >= beginnMonat) return 1;                       // August bis Dezember
  if (monat < gMonat) return 1;                             // vor dem Grenzmonat
  if (monat === gMonat && tag <= gTag) return 1;            // bis einschliesslich Grenztag
  return 2;
}

/**
 * Schuljahr eines Datums als Startjahr, z. B. 2026 fuer 2026/27. Alles vor
 * dem Schuljahresbeginn gehoert noch zum Schuljahr des Vorjahres.
 */
export function schuljahrVon(datum, beginnMonat = SCHULJAHR_BEGINN_MONAT) {
  const [jahr, monat] = String(datum).slice(0, 10).split('-').map(Number);
  if (!jahr || !monat) return null;
  return monat >= beginnMonat ? jahr : jahr - 1;
}

/** Filtert Erhebungen auf Fach, Kind und Halbjahr eines Schuljahres. */
export function erhebungenFuer(daten, { kuerzel, halbjahr, schuljahr, grenze = '01-31' }) {
  return daten.erhebungen.filter((e) => {
    if (e.kuerzel !== kuerzel) return false;
    if (halbjahr && halbjahrVon(e.datum, grenze) !== halbjahr) return false;
    if (schuljahr && schuljahrVon(e.datum) !== schuljahr) return false;
    return true;
  });
}

/**
 * Gewichte je Gruppe aus dem Blatt „Gruppengewichte" fuer ein Fach.
 * Tests werden in der Vorlage doppelt gefuehrt (Assessment UND Quiz mit
 * identischem Wert); deren Gewichte werden hier zusammengezogen, weil die
 * App den Testwert nur einmal erfassen laesst.
 */
export function gewichteFuer(daten, fach) {
  const gewichte = {};
  daten.gruppengewichte
    .filter((g) => !g.fach || g.fach === fach)
    .forEach((g) => { gewichte[g.gruppe] = (gewichte[g.gruppe] || 0) + g.gewicht; });
  return gewichte;
}
