/**
 * board.js — reine Logik der Kontrollboards, ohne Darstellung.
 *
 * Getrennt von der Oberflaeche (ansichten/boards.js), damit die Reihenfolge
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

export function boardsFuerKlasse(daten, klasse, status = 'aktiv') {
  return daten.boards
    .filter((b) => b.klasse === klasse && b.status === status)
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
