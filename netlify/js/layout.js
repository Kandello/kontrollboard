/**
 * layout.js — Anordnung der Widgets auf einer Seite, reine Rechenlogik.
 *
 * Kein DOM, kein Serveraufruf: alles hier ist ohne Browser pruefbar
 * (netlify/test/layout.mjs).
 *
 * GRUNDGEDANKE: Jede Seite ist ein echtes zweidimensionales Raster, wie der
 * Startbildschirm eines Handy-Launchers — nicht nur eine Reihenfolge mit
 * einem Breiten-Schalter. Jedes Widget belegt ein Rechteck aus Spalte `x`,
 * Zeile `y`, Breite `w` und Hoehe `h`, alles in Rastereinheiten. Welche
 * Widgets es gibt, steht im Code (die Bausteine); wo genau sie liegen, steht
 * in der Tabelle. Dadurch laesst sich die Anordnung veraendern, ohne den
 * Code anzufassen — und sie folgt der Lehrkraft auf jedes Geraet, weil sie
 * in der Tabelle liegt und nicht im Browser.
 *
 * Das Raster hat GRID_SPALTEN Spalten und beliebig viele Zeilen; die Zeilen
 * wachsen nach unten mit. Zwei Rechtecke duerfen sich nie ueberschneiden —
 * das gilt als Regel dieser Datei, nicht nur als Wunsch der Oberflaeche.
 *
 * WEICHEN STATT BLOCKIEREN: Steht beim Ziehen oder Vergroessern ein anderes
 * sichtbares Widget im Weg, wird es nicht abgelehnt — das im Weg stehende
 * Widget weicht nach unten aus, kaskadierend, falls es dabei ein drittes
 * trifft, aber nur so weit wie fuer die Kollision noetig. Ein Ziehen oder
 * Vergroessern innerhalb des Rasters schlaegt dadurch praktisch nie fehl —
 * nur ein unbekanntes Widget liefert noch `null`.
 *
 * Bewusst NICHT automatisch aufgeraeumt: leerer Platz zwischen Widgets ist
 * kein Fehler, sondern gehoert der Lehrkraft — eine Anordnung mit
 * Zwischenraum ist genauso gueltig wie eine dichte. Ein automatisches
 * Zusammenruecken wuerde genau das wieder zunichtemachen, was das freie
 * Raster erst ermoeglicht.
 *
 * SPEICHERFORM: eine Zeile im Blatt Meta, etwa
 *   layout_start = uhr:0:0:4:8:1,tagesplan:4:0:8:14:1
 * Also `id:x:y:w:h:sichtbar`, durch Komma getrennt. Bewusst kein JSON: die
 * Zeile soll in der Tabellenzelle lesbar und notfalls von Hand korrigierbar
 * bleiben. Eine aeltere Zeile im Kurzformat `id:breite:sichtbar` (aus der
 * Fassung vor dem freien Raster) wird weiterhin gelesen — die Breite wird
 * uebernommen, die Position neu vergeben.
 *
 * VERTRAEGLICHKEIT: Ein Widget, das in der gespeicherten Zeile fehlt — etwa
 * weil es erst mit einer neueren Fassung dazugekommen ist —, wird automatisch
 * an eine freie Stelle gepackt und ist sichtbar. Dadurch verschwindet nichts
 * stillschweigend, nur weil eine alte Anordnung gespeichert war.
 */

/** Spaltenzahl des Rasters. Fein genug fuer praezises Platzieren, ohne dass
 *  eine einstellbare Dichte noetig waere. */
export const GRID_SPALTEN = 12;

/** Obergrenze, bis zu der die automatische Platzierung nach unten sucht. */
const MAX_SUCHZEILE = 400;

export function metaSchluessel(seite) {
  return 'layout_' + seite;
}

function begrenzeInt(wert, min, max) {
  const n = Math.floor(Number(wert));
  if (!isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

/** Ueberschneiden sich zwei Rechtecke? */
function ueberschneidenSich(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Ist das Rechteck frei — innerhalb des Rasters und ohne Ueberschneidung mit
 * einem der `andere` (typischerweise: alle sichtbaren Widgets ausser dem
 * eigenen)? Reine Geometrie, unabhaengig davon, ob es um einen Zug oder eine
 * Groessenaenderung geht.
 */
export function celleFrei(rechteck, andere) {
  if (rechteck.x < 0 || rechteck.y < 0) return false;
  if (rechteck.x + rechteck.w > GRID_SPALTEN) return false;
  if (rechteck.w < 1 || rechteck.h < 1) return false;
  return !andere.some((a) => ueberschneidenSich(rechteck, a));
}

/**
 * Sucht die erste freie Stelle fuer ein Rechteck der Groesse `w`×`h`,
 * zeilenweise von oben, spaltenweise von links — wie Text, der sich in
 * einen Absatz einfuegt. `platzierte` sind die Rechtecke, die schon liegen.
 */
export function findePlatz(platzierte, w, h) {
  const breite = Math.min(w, GRID_SPALTEN);
  for (let y = 0; y <= MAX_SUCHZEILE; y++) {
    for (let x = 0; x <= GRID_SPALTEN - breite; x++) {
      const kandidat = { x, y, w: breite, h };
      if (celleFrei(kandidat, platzierte)) return kandidat;
    }
  }
  // Praktisch unerreichbar bei so wenigen Widgets — ganz unten anhaengen
  // statt eine Ausnahme zu werfen.
  const unten = platzierte.reduce((m, r) => Math.max(m, r.y + r.h), 0);
  return { x: 0, y: unten, w: breite, h };
}

/**
 * Liest die gespeicherte Zeile und platziert alle bekannten Bausteine, die
 * darin fehlen, automatisch. `bausteine` ist die Liste aus dem Code:
 * [{ id, titel, breiteVorgabe, hoeheVorgabe, minBreite, minHoehe,
 * standardSichtbar }]. `standardSichtbar: false` laesst einen brandneuen
 * Baustein ohne gespeicherte Zeile in der Ablage starten statt im Raster.
 */
export function leseLayout(zeile, bausteine) {
  const gespeichert = new Map();
  String(zeile || '').split(',').forEach((teil) => {
    const felder = teil.split(':').map((x) => String(x || '').trim());
    if (!felder[0]) return;
    const [id, a, b, c, d, e] = felder;

    if (felder.length >= 6) {
      // Neues Format: id:x:y:w:h:sichtbar
      gespeichert.set(id, {
        x: begrenzeInt(a, 0, GRID_SPALTEN - 1), y: begrenzeInt(b, 0, MAX_SUCHZEILE),
        w: begrenzeInt(c, 1, GRID_SPALTEN), h: begrenzeInt(d, 1, MAX_SUCHZEILE),
        sichtbar: e === undefined || e === '' ? true : e === '1',
        vollstaendig: true
      });
    } else {
      // Altes Kurzformat aus der Fassung ohne freies Raster: id:breite:sichtbar.
      // Die Breite wird uebernommen, Position und Hoehe werden neu vergeben.
      gespeichert.set(id, {
        w: a === undefined || a === '' ? null : begrenzeInt(a, 1, GRID_SPALTEN),
        sichtbar: b === undefined || b === '' ? true : b === '1',
        vollstaendig: false
      });
    }
  });

  const bekannt = new Set(bausteine.map((b) => b.id));
  const reihenfolge = [...gespeichert.keys()].filter((id) => bekannt.has(id));
  bausteine.forEach((b) => { if (!reihenfolge.includes(b.id)) reihenfolge.push(b.id); });

  const ergebnis = [];
  reihenfolge.forEach((id) => {
    const baustein = bausteine.find((b) => b.id === id);
    const eintrag = gespeichert.get(id);
    // Ein Baustein ganz ohne gespeicherte Zeile ist normalerweise sofort
    // sichtbar. Ein neuer Baustein kann das per standardSichtbar: false
    // abwaehlen — er taucht dann zunaechst in der Ablage auf, statt sich
    // ungefragt ins Raster zu draengen.
    const sichtbar = eintrag ? eintrag.sichtbar : baustein.standardSichtbar !== false;

    if (eintrag && eintrag.vollstaendig) {
      ergebnis.push({ id, titel: baustein.titel, x: eintrag.x, y: eintrag.y,
        w: eintrag.w, h: eintrag.h, sichtbar });
      return;
    }

    // Unvollstaendig oder ganz neu: Groesse aus der Vorgabe (bzw. der alten
    // Kurzform), Position an die naechste freie Stelle unter den bereits
    // platzierten SICHTBAREN Widgets — ausgeblendete brauchen keinen Platz.
    const w = Math.min((eintrag && eintrag.w) || baustein.breiteVorgabe || 4, GRID_SPALTEN);
    const h = baustein.hoeheVorgabe || 8;
    if (!sichtbar) {
      ergebnis.push({ id, titel: baustein.titel, x: 0, y: 0, w, h, sichtbar: false });
      return;
    }
    const platz = findePlatz(
      ergebnis.filter((r) => r.sichtbar).map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })),
      w, h
    );
    ergebnis.push({ id, titel: baustein.titel, x: platz.x, y: platz.y, w: platz.w, h, sichtbar: true });
  });

  return ergebnis;
}

/** Macht aus einer Anordnung wieder die Zeile fuer das Blatt Meta. */
export function schreibeLayout(layout) {
  return layout
    .map((w) => `${w.id}:${w.x}:${w.y}:${w.w}:${w.h}:${w.sichtbar ? 1 : 0}`)
    .join(',');
}

/** Nur die sichtbaren Widgets. */
export function sichtbare(layout) {
  return layout.filter((w) => w.sichtbar);
}

/** Nur die ausgeblendeten — sie liegen in der Ablage unter dem Raster. */
export function ausgeblendete(layout) {
  return layout.filter((w) => !w.sichtbar);
}

/** Die Rechtecke der uebrigen sichtbaren Widgets — Grundlage jeder Kollisionspruefung. */
function andereRechtecke(layout, id) {
  return layout
    .filter((w) => w.id !== id && w.sichtbar)
    .map((w) => ({ x: w.x, y: w.y, w: w.w, h: w.h }));
}

/**
 * Draengt jedes Widget aus `rechtecke` (Map id -> Rechteck), das `ziel`
 * ueberschneidet, nach unten ab — direkt unter das am weitesten unten
 * liegende Hindernis, das es noch trifft. Trifft ein verdraengtes Widget
 * dabei ein drittes, weicht das ebenfalls aus (Kaskade). Aendert `rechtecke`
 * nicht, liefert eine neue Map mit denselben Schluesseln.
 */
function verdraenge(rechtecke, ziel) {
  const arbeitskopie = new Map(rechtecke);
  const fixiert = [ziel];
  const erledigt = new Set();

  function weiche(id) {
    if (erledigt.has(id)) return;
    erledigt.add(id);
    const r = arbeitskopie.get(id);
    let neuY = r.y;
    let bewegt = true;
    while (bewegt) {
      bewegt = false;
      for (const hindernis of fixiert) {
        if (ueberschneidenSich({ x: r.x, y: neuY, w: r.w, h: r.h }, hindernis)) {
          neuY = hindernis.y + hindernis.h;
          bewegt = true;
        }
      }
    }
    const neu = { x: r.x, y: neuY, w: r.w, h: r.h };
    arbeitskopie.set(id, neu);
    fixiert.push(neu);
    arbeitskopie.forEach((andereR, andereId) => {
      if (!erledigt.has(andereId) && ueberschneidenSich(andereR, neu)) weiche(andereId);
    });
  }

  arbeitskopie.forEach((r, id) => { if (ueberschneidenSich(r, ziel)) weiche(id); });
  return arbeitskopie;
}

/**
 * Setzt das Widget `id` auf `ziel` (muss bereits innerhalb des Rasters
 * liegen — das prueft der Aufrufer) und verdraengt dabei im Weg stehende
 * Widgets nur so weit wie fuer die Kollision noetig — kein Zusammenruecken
 * der uebrigen, unbeteiligten Widgets. Liefert immer ein Ergebnis, nie
 * `null` — nur ein unbekanntes Widget wird von den Aufrufern selbst
 * abgefangen.
 */
function platziereMitVerdraengung(layout, id, ziel) {
  const rechtecke = new Map(
    layout.filter((w) => w.id !== id && w.sichtbar).map((w) => [w.id, { x: w.x, y: w.y, w: w.w, h: w.h }])
  );
  const verdraengt = verdraenge(rechtecke, ziel);

  return layout.map((eintrag) => {
    if (eintrag.id === id) return { ...eintrag, x: ziel.x, y: ziel.y, w: ziel.w, h: ziel.h, sichtbar: true };
    if (!eintrag.sichtbar) return eintrag;
    const r = verdraengt.get(eintrag.id);
    return { ...eintrag, x: r.x, y: r.y };
  });
}

/**
 * Verschiebt ein Widget an eine neue Stelle (linke obere Ecke `x`,`y`),
 * Groesse bleibt gleich. Im Weg stehende Widgets weichen aus, siehe
 * `platziereMitVerdraengung`. Liefert nur bei unbekanntem Widget `null`.
 */
export function versetze(layout, id, x, y) {
  const eigenes = layout.find((w) => w.id === id);
  if (!eigenes) return null;

  // Auf den gueltigen Bereich begrenzt, nicht nur auf x >= 0 — sonst liesse
  // sich ein Widget an den rechten Rand ziehen und die Bewegung wuerde dort
  // abgelehnt statt an der Kante anzuhalten.
  const ziel = { x: begrenzeInt(x, 0, GRID_SPALTEN - eigenes.w), y: Math.max(0, Math.round(y)),
    w: eigenes.w, h: eigenes.h };
  return platziereMitVerdraengung(layout, id, ziel);
}

/**
 * Aendert Breite und Hoehe eines Widgets, die linke obere Ecke bleibt stehen
 * (Anfassen unten rechts waechst nach rechts und unten). `bausteine` liefert
 * die Mindestgroesse, damit ein Widget nicht auf unbrauchbare Ausmasse
 * schrumpft. Im Weg stehende Widgets weichen aus, siehe `platziereMitVerdraengung`.
 * Liefert nur bei unbekanntem Widget `null`.
 */
export function groesseAendern(layout, id, w, h, bausteine) {
  const eigenes = layout.find((x) => x.id === id);
  if (!eigenes) return null;
  const baustein = bausteine.find((b) => b.id === id) || {};
  const minBreite = baustein.minBreite || 1;
  const minHoehe = baustein.minHoehe || 1;

  const ziel = {
    x: eigenes.x, y: eigenes.y,
    w: begrenzeInt(w, minBreite, GRID_SPALTEN - eigenes.x),
    h: begrenzeInt(h, minHoehe, MAX_SUCHZEILE)
  };
  return platziereMitVerdraengung(layout, id, ziel);
}

/** Blendet ein Widget aus. Seine Flaeche wird sofort fuer andere frei. */
export function blendeAus(layout, id) {
  const treffer = layout.find((w) => w.id === id);
  if (!treffer || !treffer.sichtbar) return null;
  return layout.map((w) => w.id === id ? { ...w, sichtbar: false } : w);
}

/**
 * Holt ein ausgeblendetes Widget zurueck — an seine zuletzt bekannte Stelle,
 * falls die noch frei ist, sonst an die naechste freie Stelle.
 */
export function blendeEin(layout, id) {
  const treffer = layout.find((w) => w.id === id);
  if (!treffer || treffer.sichtbar) return null;

  const andere = andereRechtecke(layout, id);
  const altesRechteck = { x: treffer.x, y: treffer.y, w: treffer.w, h: treffer.h };
  const rechteck = celleFrei(altesRechteck, andere)
    ? altesRechteck
    : findePlatz(andere, treffer.w, treffer.h);

  return layout.map((w) => w.id === id
    ? { ...w, x: rechteck.x, y: rechteck.y, w: rechteck.w, sichtbar: true }
    : w);
}
