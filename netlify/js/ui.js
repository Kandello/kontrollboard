/**
 * ui.js — kleine Bausteine fuer die Oberflaeche.
 *
 * Bewusst kein Framework: Die App soll ohne Abhaengigkeiten laufen und
 * auch in fuenf Jahren noch bereitstellbar sein.
 */

/**
 * Kurzmeldung, die ein Neuzeichnen ueberdauert. Ohne sie wuerde eine
 * Erfolgsmeldung sofort wieder verschwinden, weil das Neuzeichnen den
 * Behaelter neu aufbaut.
 */
let meldung = null;

export function setzeMeldung(inhalt) {
  meldung = inhalt;
}

export function holeMeldung() {
  const m = meldung;
  meldung = null;
  return m;
}

/** Erzeugt ein Element. `eigenschaften.text` setzt Text, niemals HTML. */
export function e(tag, eigenschaften = {}, kinder = []) {
  const el = document.createElement(tag);
  Object.keys(eigenschaften).forEach((k) => {
    const wert = eigenschaften[k];
    if (wert === null || wert === undefined || wert === false) return;
    if (k === 'text') el.textContent = wert;
    else if (k === 'klasse') el.className = wert;
    else if (k === 'auf') Object.keys(wert).forEach((ev) => el.addEventListener(ev, wert[ev]));
    else if (k === 'daten') Object.keys(wert).forEach((d) => { el.dataset[d] = wert[d]; });
    else if (k in el && k !== 'list' && typeof wert !== 'object') el[k] = wert;
    else el.setAttribute(k, wert);
  });
  (Array.isArray(kinder) ? kinder : [kinder]).forEach((kind) => {
    if (kind === null || kind === undefined || kind === false) return;
    el.appendChild(typeof kind === 'string' ? document.createTextNode(kind) : kind);
  });
  return el;
}

export function leere(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function ladeanzeige(text = 'Daten werden geladen …') {
  return e('div', { klasse: 'laedt' }, [e('span', { klasse: 'punkt' }), e('span', { text })]);
}

export function hinweis({ art = '', zeichen = '', titel = '', text = '', knoepfe = [] }) {
  return e('div', { klasse: 'hinweis ' + art, role: 'status' }, [
    zeichen ? e('span', { klasse: 'zeichen', 'aria-hidden': 'true', text: zeichen }) : null,
    e('div', { klasse: 'text' }, [
      titel ? e('h3', { text: titel }) : null,
      text ? e('div', { text }) : null,
      knoepfe.length ? e('div', { klasse: 'leiste', style: 'margin-top:12px;margin-bottom:0' }, knoepfe) : null
    ])
  ]);
}

export function karte(titel, kinder) {
  return e('div', { klasse: 'karte' }, [
    titel ? e('h2', { text: titel, style: 'margin-bottom:12px' }) : null,
    ...(Array.isArray(kinder) ? kinder : [kinder])
  ]);
}

export function feld({ id, beschriftung, wert = '', typ = 'text', hilfe = '', platzhalter = '' }) {
  return e('div', { klasse: 'feld' }, [
    e('label', { for: id, text: beschriftung }),
    e('input', { id, type: typ, value: wert, placeholder: platzhalter, autocomplete: 'off',
                 autocapitalize: 'off', spellcheck: false }),
    hilfe ? e('div', { klasse: 'feldhilfe', text: hilfe }) : null
  ]);
}

/** Datum als TT.MM.JJJJ. Erwartet 'JJJJ-MM-TT'. */
export function datumDeutsch(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso || '');
}

/** Zeitstempel als TT.MM.JJJJ, HH:MM. */
export function zeitpunktDeutsch(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso || '');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Zahl mit Dezimalkomma. */
export function zahlDeutsch(wert, stellen = 1) {
  if (wert === null || wert === undefined || isNaN(wert)) return '–';
  return Number(wert).toFixed(stellen).replace('.', ',');
}

/**
 * Bietet eine Datei zum Sichern an. Blob mit download-Attribut — in der
 * Vorabpruefung auf allen drei Geraeten bestaetigt.
 */
export function biete(dateiname, inhalt, typ = 'text/csv;charset=utf-8') {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = e('a', { href: url, download: dateiname });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Oeffnet einen Dateidialog und liefert den Text der gewaehlten Datei. */
export function waehleDatei(endungen = '.csv,text/csv') {
  return new Promise((erfuelle) => {
    const eingabe = e('input', { type: 'file', accept: endungen, style: 'position:fixed;left:-9999px' });
    document.body.appendChild(eingabe);
    eingabe.addEventListener('change', () => {
      const datei = eingabe.files && eingabe.files[0];
      document.body.removeChild(eingabe);
      if (!datei) { erfuelle(null); return; }
      const leser = new FileReader();
      leser.onload = () => erfuelle({ name: datei.name, text: String(leser.result || '') });
      leser.onerror = () => erfuelle(null);
      leser.readAsText(datei, 'UTF-8');
    });
    eingabe.click();
  });
}
