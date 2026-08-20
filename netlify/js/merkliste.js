/**
 * merkliste.js — persoenliche Merklisten der Lehrkraft: To-Do, Deadlines,
 * Termine. Reine Logik, kein DOM (netlify/test/merkliste.mjs).
 *
 * Alle drei Arten teilen sich ein Datenmodell und dieselbe Sortierung —
 * sie unterscheiden sich nur darin, welche Felder die Oberflaeche anbietet
 * und ob ein Ausrufezeichen erscheint (siehe ansichten/start.js).
 *
 * SORTIERUNG: offene Eintraege zuerst, nach Datum/Uhrzeit aufsteigend;
 * abgehakte danach, in derselben Ordnung. Ein fehlendes Datum bzw. eine
 * fehlende Uhrzeit zaehlt als "unendlich spaet" und rutscht dadurch ans
 * Ende der jeweiligen Gruppe — ohne eigene Fallunterscheidung, weil die
 * Platzhalter mit denselben Vergleichsoperatoren mitsortieren.
 */

/** Sortiert nach Datum, danach Uhrzeit, danach Erstellzeitpunkt (stabil bei Gleichstand). */
const KEIN_DATUM = '9999-99-99';
const KEINE_UHRZEIT = '99:99';

function sortierSchluessel(eintrag) {
  return `${eintrag.datum || KEIN_DATUM}|${eintrag.uhrzeit || KEINE_UHRZEIT}|${eintrag.erstellt_am || ''}`;
}

function nachSchluessel(a, b) {
  const sa = sortierSchluessel(a), sb = sortierSchluessel(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Offene Eintraege (sortiert) vor abgehakten (ebenfalls sortiert). */
export function sortiereMerkliste(eintraege) {
  const offen = eintraege.filter((e) => !e.erledigt).sort(nachSchluessel);
  const erledigt = eintraege.filter((e) => e.erledigt).sort(nachSchluessel);
  return [...offen, ...erledigt];
}

export function eintraegeFuerTyp(daten, typ) {
  return sortiereMerkliste(daten.merkliste.filter((e) => e.typ === typ));
}

/**
 * Nur fuer Deadlines: heute faellig oder bereits ueberfaellig, noch nicht
 * abgehakt. Bleibt bewusst auch nach dem Fälligkeitstag bestehen, solange
 * niemand abgehakt hat — eine verstrichene Deadline ist noch dringlicher,
 * nicht weniger.
 */
export function istUeberfaellig(eintrag, heuteIso) {
  return eintrag.typ === 'DEADLINE' && !eintrag.erledigt &&
    Boolean(eintrag.datum) && eintrag.datum <= heuteIso;
}

// --- Optimistische lokale Aenderungen ---------------------------------------

export function fuegeLokalHinzu(daten, eintrag) {
  daten.merkliste.push(eintrag);
}

export function entferneLokal(daten, id) {
  const i = daten.merkliste.findIndex((e) => e.id === id);
  return i === -1 ? null : daten.merkliste.splice(i, 1)[0];
}

/** Setzt den erledigt-Status und liefert den vorherigen Wert, fuer ein Rueckgaengig. */
export function setzeErledigtLokal(daten, id, erledigt) {
  const eintrag = daten.merkliste.find((e) => e.id === id);
  if (!eintrag) return null;
  const vorher = eintrag.erledigt;
  eintrag.erledigt = erledigt;
  return vorher;
}
