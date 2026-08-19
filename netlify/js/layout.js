/**
 * layout.js — Anordnung der Widgets auf einer Seite, reine Rechenlogik.
 *
 * Kein DOM, kein Serveraufruf: alles hier ist ohne Browser pruefbar
 * (netlify/test/layout.mjs).
 *
 * GRUNDGEDANKE: Jede Seite ist ein Raster aus Widgets. Welche Widgets es
 * gibt, steht im Code (die Bausteine); in welcher Reihenfolge, wie breit und
 * ob ueberhaupt sichtbar, steht in der Tabelle. Dadurch laesst sich die
 * Anordnung veraendern, ohne den Code anzufassen — und sie folgt der Lehrkraft
 * auf jedes Geraet, weil sie in der Tabelle liegt und nicht im Browser.
 *
 * SPEICHERFORM: eine einzige Zeile im Blatt Meta, etwa
 *   layout_start = uhr:1:1,tagesplan:2:1,klassen:2:1
 * Also `id:breite:sichtbar`, durch Komma getrennt. Bewusst kein JSON: die
 * Zeile soll in der Tabellenzelle lesbar und notfalls von Hand korrigierbar
 * bleiben.
 *
 * VERTRAEGLICHKEIT: Ein Widget, das in der gespeicherten Zeile fehlt — etwa
 * weil es erst mit einer neueren Fassung dazugekommen ist —, wird hinten
 * angehaengt und ist sichtbar. Dadurch verschwindet nichts stillschweigend,
 * nur weil eine alte Anordnung gespeichert war.
 */

/** Die groesste sinnvolle Breite. Das Raster hat zwei Spalten. */
export const MAX_BREITE = 2;

export function metaSchluessel(seite) {
  return 'layout_' + seite;
}

/**
 * Liest die gespeicherte Zeile und fuellt sie mit den bekannten Bausteinen
 * auf. `bausteine` ist die Liste aus dem Code: [{ id, titel, breite }].
 */
export function leseLayout(zeile, bausteine) {
  const gespeichert = new Map();
  String(zeile || '').split(',').forEach((teil) => {
    const [id, breite, sichtbar] = teil.split(':').map((x) => String(x || '').trim());
    if (!id) return;
    gespeichert.set(id, {
      // Fehlt die Breite ganz, bleibt sie offen und wird unten aus dem
      // Baustein ergaenzt — sonst wuerde eine alte, kurze Zeile alle Widgets
      // auf eine Spalte zusammenschrumpfen.
      breite: breite === undefined || breite === '' ? null : begrenzeBreite(Number(breite)),
      // Fehlt die Angabe, gilt sichtbar — eine alte, kuerzere Zeile soll
      // nichts ausblenden.
      sichtbar: sichtbar === undefined || sichtbar === '' ? true : sichtbar === '1'
    });
  });

  const bekannt = new Set(bausteine.map((b) => b.id));
  const reihenfolge = [...gespeichert.keys()].filter((id) => bekannt.has(id));
  bausteine.forEach((b) => { if (!reihenfolge.includes(b.id)) reihenfolge.push(b.id); });

  return reihenfolge.map((id) => {
    const baustein = bausteine.find((b) => b.id === id);
    const eintrag = gespeichert.get(id);
    return {
      id,
      titel: baustein.titel,
      breite: eintrag && eintrag.breite !== null
        ? eintrag.breite
        : begrenzeBreite(baustein.breite),
      sichtbar: eintrag ? eintrag.sichtbar : true
    };
  });
}

/** Macht aus einer Anordnung wieder die Zeile fuer das Blatt Meta. */
export function schreibeLayout(layout) {
  return layout
    .map((w) => `${w.id}:${w.breite}:${w.sichtbar ? 1 : 0}`)
    .join(',');
}

function begrenzeBreite(breite) {
  const n = Number(breite);
  if (!isFinite(n) || n < 1) return 1;
  return Math.min(MAX_BREITE, Math.floor(n));
}

/** Nur die sichtbaren Widgets, in ihrer Reihenfolge. */
export function sichtbare(layout) {
  return layout.filter((w) => w.sichtbar);
}

/** Nur die ausgeblendeten — sie liegen in der Ablage unter dem Raster. */
export function ausgeblendete(layout) {
  return layout.filter((w) => !w.sichtbar);
}

/**
 * Verschiebt ein Widget vor ein anderes und liefert die neue Anordnung.
 * `vorId === null` heisst: ans Ende der sichtbaren Widgets.
 *
 * Die ausgeblendeten Widgets bleiben dabei hinten stehen; sie haben keine
 * Position im Raster, die sich verschieben liesse.
 */
export function verschiebe(layout, id, vorId) {
  const bewegt = layout.find((w) => w.id === id);
  if (!bewegt || id === vorId) return null;

  const rest = layout.filter((w) => w.id !== id);
  const neu = { ...bewegt, sichtbar: true };

  let stelle = vorId === null ? -1 : rest.findIndex((w) => w.id === vorId);
  if (stelle === -1) {
    // Ans Ende der sichtbaren Reihe, also vor das erste ausgeblendete.
    const erstesVersteckte = rest.findIndex((w) => !w.sichtbar);
    stelle = erstesVersteckte === -1 ? rest.length : erstesVersteckte;
  }

  rest.splice(stelle, 0, neu);
  return rest;
}

/** Blendet ein Widget aus; es wandert an das Ende der Anordnung. */
export function blendeAus(layout, id) {
  const treffer = layout.find((w) => w.id === id);
  if (!treffer || !treffer.sichtbar) return null;
  return [...layout.filter((w) => w.id !== id), { ...treffer, sichtbar: false }];
}

/** Holt ein ausgeblendetes Widget zurueck — an das Ende der sichtbaren Reihe. */
export function blendeEin(layout, id) {
  const treffer = layout.find((w) => w.id === id);
  if (!treffer || treffer.sichtbar) return null;
  return verschiebe(layout.map((w) => w.id === id ? { ...w, sichtbar: true } : w), id, null);
}

/** Schaltet zwischen schmal (eine Spalte) und breit (beide Spalten) um. */
export function wechsleBreite(layout, id) {
  const treffer = layout.find((w) => w.id === id);
  if (!treffer) return null;
  return layout.map((w) => w.id === id
    ? { ...w, breite: w.breite >= MAX_BREITE ? 1 : MAX_BREITE }
    : w);
}
