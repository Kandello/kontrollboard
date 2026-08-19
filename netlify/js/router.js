/**
 * router.js — Navigation ueber die Fragmentkennung.
 *
 * Die aktuelle Ansicht steht in der Adresse (#/klasse/3M/noten), damit
 * Zurueck-Knopf und Neuladen funktionieren. Der Wechsel loest niemals
 * einen Serveraufruf aus — die Rohdaten liegen bereits im Browser.
 */

const routen = [];
let beimVerlassen = null;
let aktuell = { pfad: '', teile: [] };

/** Muster wie '/klasse/:klasse/:werkzeug'. */
export function registriere(muster, zeichne, pfadName) {
  routen.push({ teile: muster.split('/').filter(Boolean), zeichne, pfadName });
}

/**
 * Wird vor jedem Wechsel gefragt. Gibt die Funktion einen Text zurueck,
 * wird er als Rueckfrage gezeigt (ungespeicherte Aenderungen).
 */
export function setzeVerlassenPruefung(pruefung) {
  beimVerlassen = pruefung;
}

export function gehe(pfad, { ersetzen = false } = {}) {
  const ziel = '#' + (pfad.startsWith('/') ? pfad : '/' + pfad);
  if (ersetzen) window.location.replace(ziel);
  else window.location.hash = ziel.slice(1);
}

export function aktuellerPfad() {
  return aktuell.pfad;
}

function lesePfad() {
  const roh = window.location.hash.replace(/^#/, '');
  return roh || '/';
}

function passt(route, teile) {
  if (route.teile.length !== teile.length) return null;
  const werte = {};
  for (let i = 0; i < teile.length; i++) {
    const m = route.teile[i];
    if (m.startsWith(':')) werte[m.slice(1)] = decodeURIComponent(teile[i]);
    else if (m !== teile[i]) return null;
  }
  return werte;
}

let letzterPfad = null;

async function zeichne() {
  const pfad = lesePfad();

  if (beimVerlassen && letzterPfad !== null && pfad !== letzterPfad) {
    const grund = beimVerlassen();
    if (grund && !window.confirm(grund)) {
      // Zurueck auf den alten Pfad, ohne die Pruefung erneut auszuloesen.
      const alt = letzterPfad;
      beimVerlassen = null;
      window.location.hash = alt;
      return;
    }
    beimVerlassen = null;
  }

  const teile = pfad.split('/').filter(Boolean);
  aktuell = { pfad, teile };
  letzterPfad = pfad;

  for (const route of routen) {
    const werte = passt(route, teile);
    if (werte) {
      await route.zeichne(werte);
      return;
    }
  }

  // Unbekannter Pfad: zurueck zur Startseite.
  gehe('/', { ersetzen: true });
}

export function starte() {
  window.addEventListener('hashchange', zeichne);
  if (!window.location.hash) window.location.replace('#/');
  return zeichne();
}

/** Erzeugt die Brotkrumen fuer die Kopfleiste. */
export function pfadEintraege(daten) {
  const t = aktuell.teile;
  const eintraege = [{ text: 'Start', ziel: '/' }];

  if (t[0] === 'klasse' && t[1]) {
    const klasse = daten && daten.klassen
      ? (daten.klassen.find((k) => k.klasse === t[1]) || null)
      : null;
    eintraege.push({ text: klasse ? klasse.bezeichnung : t[1], ziel: '/klasse/' + t[1] });
    const werkzeuge = { einheiten: 'Unterrichtseinheiten' };
    if (t[2] && werkzeuge[t[2]]) {
      eintraege.push({ text: werkzeuge[t[2]], ziel: null });
    }
  } else if (t[0] === 'noten') {
    eintraege.push({ text: 'Notentracker', ziel: '/noten' });
    if (t[1]) {
      const klasse = daten && daten.klassen
        ? (daten.klassen.find((k) => k.klasse === t[1]) || null)
        : null;
      eintraege.push({ text: klasse ? klasse.bezeichnung : t[1], ziel: null });
    }
  } else if (t[0] === 'checklisten') {
    eintraege.push({ text: 'Checklisten', ziel: '/checklisten' });
    if (t[1]) {
      const klasse = daten && daten.klassen
        ? (daten.klassen.find((k) => k.klasse === t[1]) || null)
        : null;
      eintraege.push({ text: klasse ? klasse.bezeichnung : t[1], ziel: null });
    }
  } else if (t[0] === 'einheiten') {
    eintraege.push({ text: 'Unterrichtseinheiten', ziel: null });
  } else if (t[0] === 'einstellungen') {
    eintraege.push({ text: 'Einstellungen', ziel: null });
  } else if (t[0] === 'zuordnung') {
    eintraege.push({ text: 'Zuordnungsliste', ziel: null });
  }

  return eintraege;
}
