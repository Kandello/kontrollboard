/**
 * server.js — Verbindung zur Apps-Script-Datenschnittstelle.
 *
 * Die Oberflaeche liegt auf einem eigenen Host, die Daten in einer
 * Google-Tabelle. Zwei Eigenheiten von Apps Script bestimmen den Aufbau:
 *
 * 1. Apps Script beantwortet keine Vorabanfrage (OPTIONS). Deshalb werden
 *    ausschliesslich einfache Anfragen gestellt: GET ohne Zusatzkoepfe und
 *    POST mit dem Inhaltstyp text/plain. Der Zugangsschluessel reist
 *    deshalb im Rumpf bzw. in der Adresse, nicht in einem Kopffeld.
 * 2. Ein POST auf /exec antwortet mit einer Weiterleitung. fetch folgt ihr
 *    selbsttaetig; doPost ist zu diesem Zeitpunkt bereits gelaufen.
 *
 * DATENSCHUTZ: Alles, was hier hinausgeht, enthaelt nur Kuerzel. Namen
 * bleiben in zuordnung.js und damit im Browser.
 */

import { lies, schreib } from './speicher.js';

const SCHLUESSEL = 'verbindung';

let verbindung = lies(SCHLUESSEL, { url: '', token: '' });

export function istEingerichtet() {
  return Boolean(verbindung.url && verbindung.token);
}

export function holeVerbindung() {
  return { ...verbindung };
}

export function setzeVerbindung(url, token) {
  verbindung = { url: String(url || '').trim(), token: String(token || '').trim() };
  schreib(SCHLUESSEL, verbindung);
}

class ServerFehler extends Error {}

function pruefeEinrichtung() {
  if (!istEingerichtet()) {
    throw new ServerFehler('Die Verbindung zur Tabelle ist noch nicht eingerichtet.');
  }
}

/**
 * Apps Script liefert bei einem Fehler in der Bereitstellung eine
 * HTML-Seite statt JSON. Das faengt diese Auswertung ab und macht daraus
 * eine verstaendliche Meldung.
 */
async function werteAus(antwort) {
  const text = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(text);
  } catch (e) {
    if (/anmeld|sign in|login|accounts\.google/i.test(text)) {
      throw new ServerFehler(
        'Die Tabelle verlangt eine Anmeldung. Bitte die Web-App auf „Jeder, der über den Link ' +
        'verfügt" bereitstellen und die Adresse der neuen Version eintragen.');
    }
    throw new ServerFehler(
      'Die Antwort der Tabelle war unlesbar. Meist stimmt die Adresse nicht oder die ' +
      'Bereitstellung ist veraltet.');
  }
  if (!daten.ok) {
    throw new ServerFehler(daten.fehler || 'Die Tabelle hat einen Fehler gemeldet.');
  }
  return daten;
}

/** Lesender Aufruf. */
export async function frage(aktion, parameter = {}) {
  pruefeEinrichtung();
  const adresse = new URL(verbindung.url);
  adresse.searchParams.set('aktion', aktion);
  adresse.searchParams.set('token', verbindung.token);
  Object.keys(parameter).forEach((k) => adresse.searchParams.set(k, parameter[k]));

  let antwort;
  try {
    antwort = await fetch(adresse.toString(), { method: 'GET', redirect: 'follow' });
  } catch (e) {
    throw new ServerFehler('Die Tabelle ist nicht erreichbar. Besteht eine Internetverbindung?');
  }
  return werteAus(antwort);
}

/** Schreibender Aufruf. */
export async function sende(aktion, nutzlast = {}) {
  pruefeEinrichtung();
  let antwort;
  try {
    antwort = await fetch(verbindung.url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...nutzlast, aktion, token: verbindung.token })
    });
  } catch (e) {
    throw new ServerFehler('Die Tabelle ist nicht erreichbar. Besteht eine Internetverbindung?');
  }
  return werteAus(antwort);
}

// --- Rohdaten der Sitzung --------------------------------------------------

let daten = null;
let ladeVersprechen = null;

/**
 * Ein Ladeaufruf je Sitzung. Der Wechsel zwischen den Werkzeugen darf
 * keinen weiteren Serveraufruf ausloesen.
 */
export function ladeDaten({ neu = false } = {}) {
  if (daten && !neu) return Promise.resolve(daten);
  if (ladeVersprechen && !neu) return ladeVersprechen;

  ladeVersprechen = frage('laden')
    .then((antwort) => {
      daten = antwort.daten;
      ladeVersprechen = null;
      return daten;
    })
    .catch((fehler) => {
      ladeVersprechen = null;
      throw fehler;
    });

  return ladeVersprechen;
}

export function holeDaten() {
  return daten;
}

export function leereDaten() {
  daten = null;
}

export { ServerFehler };
