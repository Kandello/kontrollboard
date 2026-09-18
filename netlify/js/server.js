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

/**
 * Nach dieser Zeit gilt ein Aufruf als gescheitert.
 *
 * Ohne Grenze wartet fetch beliebig lange. Setzt Apps Script aus, haengt
 * die Anfrage dann minutenlang, ohne dass irgendetwas passiert — und weil
 * erst danach der zweite Anlauf beginnt, verdoppelt sich die Wartezeit
 * auch noch. Apps Script selbst bricht nach 30 Sekunden ab; wer bis dahin
 * nicht geantwortet hat, antwortet nicht mehr sinnvoll.
 */
const ZEITGRENZE_MS = 25000;

/**
 * Ob in dieser Sitzung schon einmal ein Aufruf durchgekommen ist.
 *
 * Das entscheidet ueber die Deutung einer Fehlerseite: Dieselbe Seite
 * („unable to open the file") schickt Apps Script sowohl bei fehlendem
 * Zugriff als auch bei einem voruebergehenden Aussetzer. Hat in dieser
 * Sitzung schon etwas geklappt, sind Adresse, Schluessel und Freigabe
 * nachweislich in Ordnung — dann auf die Freigabe zu verweisen, schickt
 * Menschen in die Irre.
 */
let hatSchonGeklappt = false;

async function hole(adresse, optionen) {
  const abbruch = new AbortController();
  const uhr = setTimeout(() => abbruch.abort(), ZEITGRENZE_MS);
  try {
    return await fetch(adresse, { ...optionen, signal: abbruch.signal });
  } finally {
    clearTimeout(uhr);
  }
}

function netzFehler(e) {
  if (e && e.name === 'AbortError') {
    return new ServerFehler(
      `Die Tabelle hat innerhalb von ${Math.round(ZEITGRENZE_MS / 1000)} Sekunden nicht ` +
      'geantwortet. Das ist fast immer vorübergehend.');
  }
  return new ServerFehler('Die Tabelle ist nicht erreichbar. Besteht eine Internetverbindung?');
}

function pruefeEinrichtung() {
  if (!istEingerichtet()) {
    throw new ServerFehler('Die Verbindung zur Tabelle ist noch nicht eingerichtet.');
  }
}

/**
 * Apps Script liefert bei einem Fehler in der Bereitstellung eine
 * HTML-Seite statt JSON. Das faengt diese Auswertung ab und macht daraus
 * eine verstaendliche Meldung.
 *
 * Die Unterscheidung lohnt sich, weil dieselbe unlesbare Antwort drei sehr
 * verschiedene Ursachen haben kann — und die Loesung jedesmal eine andere
 * ist. Besonders heimtueckisch ist der Zugriffsfall: im eigenen Browsertab
 * laesst sich dieselbe Adresse einwandfrei oeffnen, weil man dort bei Google
 * angemeldet ist. Die Anfrage aus der Seite heraus traegt diese Anmeldung
 * nicht mit und bekommt eine Fehlerseite — was leicht als „falsche Adresse"
 * missdeutet wird.
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
    if (/unable to open|nicht geöffnet|nicht ge.ffnet|check the address/i.test(text)) {
      // Dieselbe Seite, zwei sehr verschiedene Ursachen. Unterscheiden
      // laesst sich das an der eigenen Vorgeschichte: Hat in dieser Sitzung
      // schon ein Aufruf geklappt, dann stimmen Adresse, Schluessel und
      // Freigabe — es kann nur ein Aussetzer sein. Frueher stand hier
      // ungeprueft die Freigabe-Erklaerung, was bei korrekt eingestellter
      // Freigabe in die voellig falsche Richtung schickte.
      if (hatSchonGeklappt) {
        throw new ServerFehler(
          'Die Tabelle konnte gerade nicht geöffnet werden. An den Einstellungen liegt es ' +
          'nicht — in dieser Sitzung hat der Zugriff schon funktioniert. Google setzt ' +
          'zeitweise aus; in ein paar Minuten noch einmal versuchen.');
      }
      throw new ServerFehler(
        'Die Tabelle hat die Anfrage abgewiesen. Fast immer steht die Bereitstellung nicht auf ' +
        '„Jeder": im Apps-Script-Editor unter „Bereitstellen → Bereitstellungen verwalten" beim ' +
        'Stift-Symbol „Wer hat Zugriff" auf „Jeder" stellen. Dass sich dieselbe Adresse im ' +
        'Browser öffnen lässt, spricht nicht dagegen — dort sind Sie bei Google angemeldet, ' +
        'diese Seite ist es nicht.');
    }
    // Bleibt unklar, was da kam, hilft die Meldung allein nicht weiter — man
    // stochert dann in Adresse und Schluessel herum, obwohl beide stimmen.
    // Darum steht hier, was tatsaechlich ankam: das grenzt die Ursache in
    // einem Schritt ein, statt in mehreren Anlaeufen.
    const kurz = text.trim().replace(/\s+/g, ' ').slice(0, 160);
    throw new ServerFehler(
      'Die Antwort der Tabelle war unlesbar. Meist stimmt die Adresse nicht oder die ' +
      'Bereitstellung ist veraltet.\n\n' +
      `Angekommen ist (HTTP ${antwort.status}, ${text.length} Zeichen): ` +
      (kurz || '— eine leere Antwort —'));
  }
  if (!daten.ok) {
    throw new ServerFehler(daten.fehler || 'Die Tabelle hat einen Fehler gemeldet.');
  }
  // Ab hier steht fest: Adresse, Schluessel und Freigabe stimmen.
  hatSchonGeklappt = true;
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
    antwort = await hole(adresse.toString(), { method: 'GET', redirect: 'follow' });
  } catch (e) {
    throw netzFehler(e);
  }
  return werteAus(antwort);
}

/** Schreibender Aufruf. */
export async function sende(aktion, nutzlast = {}) {
  pruefeEinrichtung();
  let antwort;
  try {
    antwort = await hole(verbindung.url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...nutzlast, aktion, token: verbindung.token })
    });
  } catch (e) {
    throw netzFehler(e);
  }
  return werteAus(antwort);
}

// --- Rohdaten der Sitzung --------------------------------------------------

/**
 * Geladen wird in zwei Haelften (siehe apps-script/Daten.gs):
 *
 *   'kern' — alles, was die Startseite braucht. Lauter kleine Blaetter.
 *   'rest' — die mit dem Schuljahr wachsenden Tabellen: Erhebungen,
 *            Beteiligungspunkte, Boards und deren Werte.
 *
 * Die Startseite wartet nur auf den Kern; der Rest laeuft danach im
 * Hintergrund nach und wird in dasselbe Objekt gemischt. Das ist wichtig:
 * die Ansichten halten `daten` fest und aendern darin (start.js schreibt
 * etwa in `daten.wochenstatus`), ein Austausch des Objekts wuerde diese
 * Aenderungen verwerfen.
 *
 * Wer Daten aus dem Rest braucht — Noten und Checklisten —, wartet mit
 * `ladeRest()`, statt sich auf die Hintergrundrunde zu verlassen.
 */
let daten = null;
let ladeVersprechen = null;
let restVersprechen = null;

/**
 * Ein Ladeaufruf je Sitzung. Der Wechsel zwischen den Werkzeugen darf
 * keinen weiteren Serveraufruf ausloesen.
 */
export function ladeDaten({ neu = false } = {}) {
  if (daten && !neu) return Promise.resolve(daten);
  if (ladeVersprechen && !neu) return ladeVersprechen;

  restVersprechen = null;
  ladeVersprechen = frage('laden', { teil: 'kern' })
    .then((antwort) => {
      daten = antwort.daten;
      ladeVersprechen = null;
      // Ohne Abwarten: die Startseite soll jetzt gezeichnet werden. Der
      // Fehlerfang verhindert nur eine unbehandelte Ablehnung — gemeldet
      // wird ein Fehler erst dort, wo die Daten wirklich gebraucht werden.
      holeRest().catch(() => {});
      return daten;
    })
    .catch((fehler) => {
      ladeVersprechen = null;
      throw fehler;
    });

  return ladeVersprechen;
}

/** Wartet, bis auch die grossen Tabellen da sind. */
export function ladeRest() {
  if (!daten) return ladeDaten().then(() => ladeRest());
  if (daten.vollstaendig) return Promise.resolve(daten);
  return holeRest();
}

function holeRest() {
  if (restVersprechen) return restVersprechen;

  // Auf welchen Stand diese Runde gehoert. Wird zwischenzeitlich neu
  // geladen, gehoert die Antwort zu einem abgeloesten Objekt und darf
  // den frischen Stand nicht ueberschreiben.
  const fuer = daten;

  restVersprechen = frage('laden', { teil: 'rest' })
    .then((antwort) => {
      restVersprechen = null;
      if (daten !== fuer) return daten;
      Object.keys(antwort.daten).forEach((schluessel) => {
        // `stand` und `teil` beschreiben die Runde, nicht die Daten.
        if (schluessel === 'stand' || schluessel === 'teil') return;
        daten[schluessel] = antwort.daten[schluessel];
      });
      daten.vollstaendig = true;
      return daten;
    })
    .catch((fehler) => {
      restVersprechen = null;
      throw fehler;
    });

  return restVersprechen;
}

export function holeDaten() {
  return daten;
}

/** Ob auch die grossen Tabellen schon im Browser liegen. */
export function istVollstaendig() {
  return Boolean(daten && daten.vollstaendig);
}

export function leereDaten() {
  daten = null;
  restVersprechen = null;
}

export { ServerFehler };
