/**
 * speicher.js — gekapselter Zugriff auf den lokalen Speicher.
 *
 * Safari wirft im privaten Modus schon beim Lesen. Deshalb laeuft jeder
 * Zugriff durch try/catch, und die App bleibt auch dann bedienbar, wenn
 * gar nichts gespeichert werden kann.
 */

const PRAEFIX = 'kz.';

let verfuegbar = true;
try {
  window.localStorage.setItem(PRAEFIX + 'probe', '1');
  window.localStorage.removeItem(PRAEFIX + 'probe');
} catch (e) {
  verfuegbar = false;
}

/** Ersatzablage, damit die Sitzung auch ohne dauerhaften Speicher funktioniert. */
const ersatz = new Map();

export function istVerfuegbar() {
  return verfuegbar;
}

export function lies(schluessel, vorgabe = null) {
  const s = PRAEFIX + schluessel;
  try {
    const roh = verfuegbar ? window.localStorage.getItem(s) : (ersatz.has(s) ? ersatz.get(s) : null);
    if (roh === null || roh === undefined) return vorgabe;
    return JSON.parse(roh);
  } catch (e) {
    return vorgabe;
  }
}

export function schreib(schluessel, wert) {
  const s = PRAEFIX + schluessel;
  const roh = JSON.stringify(wert);
  try {
    if (verfuegbar) window.localStorage.setItem(s, roh);
    else ersatz.set(s, roh);
    return true;
  } catch (e) {
    // Kontingent erschoepft oder Schreiben gesperrt: in die Sitzung ausweichen.
    ersatz.set(s, roh);
    return false;
  }
}

export function entferne(schluessel) {
  const s = PRAEFIX + schluessel;
  try { if (verfuegbar) window.localStorage.removeItem(s); } catch (e) { /* egal */ }
  ersatz.delete(s);
}
