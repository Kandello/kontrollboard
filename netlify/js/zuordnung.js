/**
 * zuordnung.js — Uebersetzung Kuerzel -> Name.
 *
 * DATENSCHUTZ: Dieses Modul ist die einzige Stelle, an der Klarnamen
 * vorkommen. Nichts davon wird jemals an den Server uebergeben. Wer hier
 * etwas ergaenzt, pruefe zuerst, ob die Angabe den Browser verlassen kann.
 *
 * Massgeblich ist der lokale Speicher des Geraets. Die CSV-Datei dient nur
 * der Uebertragung auf ein anderes Geraet und der Sicherung.
 */

import { lies, schreib, entferne } from './speicher.js';

const SCHLUESSEL = 'zuordnung';
const KUERZEL_MUSTER = /^[0-9][A-Za-z]{1,3}-[0-9]{2}$/;
const KLASSEN_PRAEFIX = 'KLASSE-';

/** { eintraege: { schluessel: {nachname, vorname, geschlecht, email} }, version: ISO } */
let zustand = lies(SCHLUESSEL, { eintraege: {}, version: '' });

export function istGeladen() {
  return Object.keys(zustand.eintraege).length > 0;
}

export function version() {
  return zustand.version || '';
}

export function anzahl() {
  return Object.keys(zustand.eintraege).length;
}

export function eintrag(schluessel) {
  return zustand.eintraege[schluessel] || null;
}

export function alleEintraege() {
  return { ...zustand.eintraege };
}

/** Klassenlehrkraft einer Klasse, z. B. klassenlehrkraft('3L'). */
export function klassenlehrkraft(klasse) {
  const e = zustand.eintraege[KLASSEN_PRAEFIX + klasse];
  if (!e) return null;
  return vollerName(e);
}

/**
 * Name und E-Mail der Klassenlehrkraft, fuer einen anklickbaren Verweis.
 *
 * Die Adresse steht wie der Name ausschliesslich in der lokalen
 * Zuordnungsdatei — sie ist ein personenbezogenes Datum und gehoert
 * ebenso wenig in die Tabelle oder in den Programmcode.
 */
export function klassenlehrkraftEintrag(klasse) {
  const e = zustand.eintraege[KLASSEN_PRAEFIX + klasse];
  if (!e) return null;
  const n = vollerName(e);
  if (!n) return null;
  return { name: n, email: (e.email || '').trim() };
}

function vollerName(e) {
  return [e.vorname, e.nachname].filter(Boolean).join(' ').trim();
}

/**
 * Anzeigename eines Kuerzels: 'Vorname Nachname', sonst das Kuerzel.
 * Ist `verbergen` gesetzt (Beamer-Modus), immer das Kuerzel.
 */
export function name(kuerzel, verbergen = false) {
  if (verbergen) return kuerzel;
  const e = zustand.eintraege[kuerzel];
  if (!e) return kuerzel;
  const n = vollerName(e);
  return n || kuerzel;
}

/** Getrennte Felder fuer die Kontrollboards (zwei Spalten). */
export function namensteile(kuerzel, verbergen = false) {
  if (verbergen) return { nachname: kuerzel, vorname: '', istKuerzel: true };
  const e = zustand.eintraege[kuerzel];
  if (!e || (!e.nachname && !e.vorname)) return { nachname: kuerzel, vorname: '', istKuerzel: true };
  return { nachname: e.nachname || '', vorname: e.vorname || '', istKuerzel: false };
}

/** Sortierschluessel: immer nach listennummer, nie nach dem Kuerzel. */
export function sortiereNachListe(schueler) {
  return [...schueler].sort((a, b) => (a.listennummer || 0) - (b.listennummer || 0));
}

// --- Einlesen --------------------------------------------------------------

/**
 * Liest eine Zuordnungs-CSV. Tolerant gegenueber Trennzeichen, BOM,
 * Zeilenenden, Leerzeilen und Leerraum. Ungueltige Zeilen werden benannt,
 * nicht die ganze Datei verworfen.
 */
export function leseCsv(text) {
  const roh = String(text || '').replace(/^﻿/, '');
  const zeilen = roh.split(/\r\n|\r|\n/);
  const eintraege = {};
  const fehler = [];
  let kopf = null;
  let version = '';
  let gelesen = 0;

  zeilen.forEach((zeile, i) => {
    if (!zeile.trim()) return;

    const trenner = zaehle(zeile, ';') >= zaehle(zeile, ',') ? ';' : ',';
    const felder = zeile.split(trenner).map((f) => f.trim().replace(/^"|"$/g, ''));

    if (!kopf) {
      if (felder[0].toLowerCase() === 'schluessel') { kopf = felder.map((f) => f.toLowerCase()); return; }
      // Fehlende Kopfzeile: Standardreihenfolge annehmen.
      kopf = ['schluessel', 'nachname', 'vorname', 'geschlecht', 'version'];
    }

    const satz = {};
    kopf.forEach((spalte, s) => { satz[spalte] = felder[s] !== undefined ? felder[s] : ''; });

    const schluessel = satz.schluessel;
    if (!schluessel) return;

    const istKlasse = schluessel.startsWith(KLASSEN_PRAEFIX);
    if (!istKlasse && !KUERZEL_MUSTER.test(schluessel)) {
      fehler.push(`Zeile ${i + 1}: "${schluessel}" ist weder ein gültiges Kürzel noch eine Klassenzeile.`);
      return;
    }

    eintraege[schluessel] = {
      nachname: satz.nachname || '',
      vorname: satz.vorname || '',
      geschlecht: satz.geschlecht || '',
      email: satz.email || ''
    };
    if (satz.version && satz.version > version) version = satz.version;
    gelesen++;
  });

  return { eintraege, version, gelesen, fehler };
}

function zaehle(text, zeichen) {
  let n = 0;
  for (const z of text) if (z === zeichen) n++;
  return n;
}

/** Uebernimmt ein Leseergebnis als neue Arbeitskopie. */
export function uebernimm(eintraege, version) {
  zustand = {
    eintraege: { ...eintraege },
    version: version || neuerZeitstempel()
  };
  schreib(SCHLUESSEL, zustand);
  return zustand.version;
}

/** Einzelnen Eintrag aendern; wirkt sofort, ohne Dateizugriff. */
export function setzeEintrag(schluessel, felder) {
  const vorhanden = zustand.eintraege[schluessel] || { nachname: '', vorname: '', geschlecht: '', email: '' };
  zustand.eintraege[schluessel] = { ...vorhanden, ...felder };
}

export function entferneEintrag(schluessel) {
  delete zustand.eintraege[schluessel];
}

/** Schreibt die Arbeitskopie fest und vergibt einen neuen Zeitstempel. */
export function sichere() {
  zustand.version = neuerZeitstempel();
  schreib(SCHLUESSEL, zustand);
  return zustand.version;
}

export function verwirf() {
  zustand = { eintraege: {}, version: '' };
  entferne(SCHLUESSEL);
}

function neuerZeitstempel() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// --- Ausgeben --------------------------------------------------------------

/** Erzeugt die CSV zur Sicherung: UTF-8 mit BOM, semikolongetrennt, CRLF. */
export function schreibeCsv() {
  const zeilen = ['schluessel;nachname;vorname;geschlecht;email;version'];
  const v = zustand.version || neuerZeitstempel();

  const schluessel = Object.keys(zustand.eintraege).sort((a, b) => {
    const ak = a.startsWith(KLASSEN_PRAEFIX), bk = b.startsWith(KLASSEN_PRAEFIX);
    if (ak !== bk) return ak ? -1 : 1;
    return a.localeCompare(b, 'de');
  });

  schluessel.forEach((s) => {
    const e = zustand.eintraege[s];
    zeilen.push([s, e.nachname, e.vorname, e.geschlecht, e.email || '', v].map(feld).join(';'));
  });

  return '﻿' + zeilen.join('\r\n') + '\r\n';
}

function feld(wert) {
  const t = String(wert || '');
  return /[;,"\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

// --- Abgleich --------------------------------------------------------------

/**
 * Vergleicht die Kuerzel aus dem Blatt Schueler mit der lokalen Zuordnung.
 * Laeuft ausschliesslich ueber Kuerzel, nie ueber Namen.
 */
export function gleicheAb(schueler, metaVersion) {
  const ausTabelle = new Set(schueler.map((s) => s.kuerzel));
  const lokal = new Set(Object.keys(zustand.eintraege).filter((k) => !k.startsWith(KLASSEN_PRAEFIX)));

  const fehlend = [...ausTabelle].filter((k) => !lokal.has(k));
  const ueberzaehlig = [...lokal].filter((k) => !ausTabelle.has(k));

  const lokaleVersion = zustand.version || '';
  const veraltet = Boolean(metaVersion && lokaleVersion && metaVersion > lokaleVersion);

  return {
    fehlend,
    ueberzaehlig,
    veraltet,
    lokaleVersion,
    serverVersion: metaVersion || '',
    inOrdnung: fehlend.length === 0 && ueberzaehlig.length === 0 && !veraltet
  };
}
