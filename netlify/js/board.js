/**
 * board.js — reine Logik der Checklisten, ohne Darstellung.
 *
 * Getrennt von der Oberflaeche (ansichten/checklisten.js), damit die Reihenfolge
 * der Zellzustaende und andere Regeln an einer Stelle stehen (Abschnitt 9:
 * "Lege die Reihenfolge als eine benannte Konstante an").
 */

/** leer -> haken -> teilweise -> x -> leer. '' steht fuer leer. */
export const ZUSTAENDE = ['', 'haken', 'teilweise', 'x'];

export function naechsterZustand(zustand) {
  const i = ZUSTAENDE.indexOf(zustand || '');
  return ZUSTAENDE[(i + 1) % ZUSTAENDE.length];
}

/** Immer ein Symbol zusaetzlich zur Farbe — Farbe allein traegt nie die Bedeutung. */
export function zustandSymbol(zustand) {
  return { haken: '✓', teilweise: '◐', x: '✕' }[zustand] || '';
}

export function zustandBeschriftung(zustand) {
  return {
    '': 'noch nicht angesehen',
    haken: 'erledigt',
    teilweise: 'teilweise erledigt',
    x: 'ausdrücklich nicht vorhanden'
  }[zustand || ''];
}

/**
 * Checklisten sind geteilt — nicht je Klasse einzeln angelegt. Aktiv/
 * archiviert gilt aber sehr wohl je Klasse: Parallelklassen brauchen eine
 * geteilte Liste nicht zwangslaeufig gleich lang, deshalb steht der Status
 * in BoardKlassenStatus statt am Board selbst. Fehlt dort eine Zeile fuer
 * diese Kombination, gilt die Klasse als aktiv.
 */
export function statusFuerKlasse(daten, boardId, klasse) {
  const eintrag = daten.boardKlassenStatus.find((s) => s.board_id === boardId && s.klasse === klasse);
  return eintrag ? eintrag.status : 'aktiv';
}

/** Datum, an dem eine Checkliste fuer diese Klasse archiviert wurde ('' wenn aktiv). */
export function archiviertAmFuerKlasse(daten, boardId, klasse) {
  const eintrag = daten.boardKlassenStatus.find((s) => s.board_id === boardId && s.klasse === klasse);
  return eintrag ? eintrag.archiviert_am : '';
}

export function boardeFuerKlasse(daten, klasse, status = 'aktiv') {
  return daten.boards
    .filter((b) => statusFuerKlasse(daten, b.id, klasse) === status)
    .sort((a, b) => a.titel.localeCompare(b.titel, 'de'));
}

export function spaltenFuerBoard(daten, boardId) {
  return daten.boardSpalten
    .filter((s) => s.board_id === boardId)
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
}

export function wertFuer(daten, boardId, spalteId, kuerzel) {
  const treffer = daten.boardWerte.find(
    (w) => w.board_id === boardId && w.spalte_id === spalteId && w.kuerzel === kuerzel
  );
  return treffer ? treffer.zustand : '';
}

/** Alle bereits vergebenen Labels ueber alle Boards, fuer die Vorschlagsliste. */
export function alleLabels(daten) {
  const menge = new Set();
  daten.boards.forEach((b) => {
    String(b.labels || '').split(',').forEach((l) => {
      const t = l.trim();
      if (t) menge.add(t);
    });
  });
  return [...menge].sort((a, b) => a.localeCompare(b, 'de'));
}

export function labelListe(text) {
  return String(text || '').split(',').map((l) => l.trim()).filter(Boolean);
}

/**
 * Mutiert `daten.boardWerte` optimistisch (leer entfernt die Zeile, sonst
 * wird sie gesetzt oder ersetzt) — dieselbe Kopie, auf die auch alle
 * anderen Ansichten zugreifen, damit kein Neuladen noetig ist.
 */
export function setzeWertLokal(daten, boardId, spalteId, kuerzel, zustand) {
  const i = daten.boardWerte.findIndex(
    (w) => w.board_id === boardId && w.spalte_id === spalteId && w.kuerzel === kuerzel
  );
  if (zustand === '') {
    if (i !== -1) daten.boardWerte.splice(i, 1);
    return;
  }
  if (i !== -1) daten.boardWerte[i].zustand = zustand;
  else daten.boardWerte.push({ board_id: boardId, spalte_id: spalteId, kuerzel, zustand });
}

// --- Optimistische Strukturaenderungen --------------------------------------
//
// Board- und Spaltenaenderungen sollen sich genauso sofort anfuehlen wie ein
// Klick auf eine Zelle: erst lokal eintragen und zeichnen, dann im
// Hintergrund an den Server schicken. Jede Funktion hier hat eine passende
// Rueckgaengig-Funktion, falls der Serveraufruf scheitert.

export function heutigesDatum() {
  return new Date().toISOString().slice(0, 10);
}

export function fuegeBoardLokalHinzu(daten, board) {
  daten.boards.push(board);
}

export function entferneBoardLokal(daten, id) {
  const i = daten.boards.findIndex((b) => b.id === id);
  if (i !== -1) daten.boards.splice(i, 1);
}

export function setzeBoardKlassenStatusLokal(daten, boardId, klasse, status, archiviertAm = '') {
  const eintrag = daten.boardKlassenStatus.find((s) => s.board_id === boardId && s.klasse === klasse);
  if (eintrag) { eintrag.status = status; eintrag.archiviert_am = archiviertAm; }
  else daten.boardKlassenStatus.push({ board_id: boardId, klasse, status, archiviert_am: archiviertAm });
}

/**
 * Entfernt eine Checkliste vollstaendig (Board, alle Spalten, alle Werte
 * aller Klassen, aller Klassenstatus); gibt alles fuer ein Rueckgaengig
 * zurueck. Anders als Zuruecksetzen/Archivieren betrifft das keine
 * einzelne Klasse, sondern die geteilte Checkliste als Ganzes.
 */
export function entferneBoardVollstaendigLokal(daten, id) {
  const bi = daten.boards.findIndex((b) => b.id === id);
  const board = bi !== -1 ? daten.boards.splice(bi, 1)[0] : null;

  const spalten = [];
  for (let i = daten.boardSpalten.length - 1; i >= 0; i--) {
    if (daten.boardSpalten[i].board_id === id) spalten.push(...daten.boardSpalten.splice(i, 1));
  }
  const werte = [];
  for (let i = daten.boardWerte.length - 1; i >= 0; i--) {
    if (daten.boardWerte[i].board_id === id) werte.push(...daten.boardWerte.splice(i, 1));
  }
  const klassenStatus = [];
  for (let i = daten.boardKlassenStatus.length - 1; i >= 0; i--) {
    if (daten.boardKlassenStatus[i].board_id === id) klassenStatus.push(...daten.boardKlassenStatus.splice(i, 1));
  }
  return { board, spalten, werte, klassenStatus };
}

/** Macht entferneBoardVollstaendigLokal() rueckgaengig — fuer den Fehlerfall. */
export function stelleBoardWiederHer(daten, entfernung) {
  if (entfernung.board) daten.boards.push(entfernung.board);
  entfernung.spalten.forEach((s) => daten.boardSpalten.push(s));
  entfernung.werte.forEach((w) => daten.boardWerte.push(w));
  entfernung.klassenStatus.forEach((s) => daten.boardKlassenStatus.push(s));
}

export function fuegeSpalteLokalHinzu(daten, spalte) {
  daten.boardSpalten.push(spalte);
}

/** Entfernt eine Spalte und alle ihre Werte; gibt die Werte fuer ein Rueckgaengig zurueck. */
export function entferneSpalteLokal(daten, id) {
  const si = daten.boardSpalten.findIndex((s) => s.id === id);
  const spalte = si !== -1 ? daten.boardSpalten.splice(si, 1)[0] : null;
  const entfernteWerte = [];
  for (let i = daten.boardWerte.length - 1; i >= 0; i--) {
    if (daten.boardWerte[i].spalte_id === id) entfernteWerte.push(...daten.boardWerte.splice(i, 1));
  }
  return { spalte, entfernteWerte };
}

export function benenneSpalteLokalUm(daten, id, bezeichnung) {
  const spalte = daten.boardSpalten.find((s) => s.id === id);
  if (spalte) spalte.bezeichnung = bezeichnung;
}

export function setzeSpaltenReihenfolgeLokal(daten, reihenfolge) {
  reihenfolge.forEach((id, i) => {
    const spalte = daten.boardSpalten.find((s) => s.id === id);
    if (spalte) spalte.reihenfolge = i + 1;
  });
}

/**
 * Leert die Zustaende eines Boards fuer eine einzelne Klasse; gibt die
 * entfernten Werte fuer ein Rueckgaengig zurueck. Werte anderer Klassen
 * bleiben unberuehrt — dieselbe Checkliste kann pro Klasse unabhaengig
 * aufgeraeumt werden.
 */
export function leereBoardWerteLokalFuerKlasse(daten, boardId, klasse) {
  const kuerzelDieserKlasse = new Set(
    daten.schueler.filter((s) => s.klasse === klasse).map((s) => s.kuerzel)
  );
  const entfernt = [];
  for (let i = daten.boardWerte.length - 1; i >= 0; i--) {
    const w = daten.boardWerte[i];
    if (w.board_id === boardId && kuerzelDieserKlasse.has(w.kuerzel)) entfernt.push(...daten.boardWerte.splice(i, 1));
  }
  return entfernt;
}
