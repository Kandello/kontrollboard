/**
 * ansichten/boards.js — Kontrollboards.
 *
 * Ersetzt die statische Entwurfsseite (Abschnitt 14). Mehrere Boards je
 * Klasse, variable Spalten, vier Zellzustaende, haftende Kopf- und
 * Namensspalten, gebuendeltes verzoegertes Speichern, Archiv.
 *
 * DATENSCHUTZ: Klarnamen erscheinen ausschliesslich in dieser Darstellung.
 * Jeder Serveraufruf hier (boardWerte, boardSpalte*, board*) enthaelt
 * ausschliesslich Kuerzel, Bezeichnungen und Zustaende — niemals Namen.
 */

import { e, leere, karte, hinweis, ladeanzeige, setzeMeldung } from '../ui.js';
import { namensteile, sortiereNachListe } from '../zuordnung.js';
import { sende, holeDaten, leereDaten, ladeDaten } from '../server.js';
import { setzeVerlassenPruefung } from '../router.js';
import {
  naechsterZustand, zustandSymbol, zustandBeschriftung,
  boardsFuerKlasse, spaltenFuerBoard, wertFuer, alleLabels, labelListe, setzeWertLokal
} from '../board.js';

/** Welches Board je Klasse zuletzt offen war — ueberlebt ein neuZeichnen(). */
const boardUiState = {};

function zustandFuer(klasse) {
  if (!boardUiState[klasse]) {
    boardUiState[klasse] = { boardId: null, ansicht: 'aktiv', archivLabel: '', archivVon: '', archivBis: '', archivAnsicht: null };
  }
  return boardUiState[klasse];
}

export function zeichneBoardsWerkzeug(ziel, kontext) {
  const { daten, verbergen, klasse, neuZeichnen } = kontext;
  const zustand = zustandFuer(klasse);

  let ausstehend = new Map();
  let zeitgeber = null;

  setzeVerlassenPruefung(() => ausstehend.size
    ? 'Es gibt noch ungespeicherte Änderungen an den Kontrollboards. Wirklich verlassen?'
    : null);

  const statusEl = e('span', { klasse: 'feldhilfe', text: '' });

  function zeigeStatus(text, art) {
    statusEl.textContent = text;
    statusEl.className = 'feldhilfe' + (art ? ' status-' + art : '');
  }

  function planeSpeichern() {
    zeigeStatus('nicht gespeichert', 'warn');
    if (zeitgeber) clearTimeout(zeitgeber);
    zeitgeber = setTimeout(sendeJetzt, 1000);
  }

  async function sendeJetzt() {
    zeitgeber = null;
    if (!ausstehend.size) return;
    const aenderungen = [...ausstehend.values()];
    ausstehend.clear();
    zeigeStatus('wird gespeichert …', '');
    try {
      await sende('boardWerte', { aenderungen });
      zeigeStatus('gespeichert', 'gut');
    } catch (fehler) {
      aenderungen.forEach((a) => ausstehend.set(a.spalte_id + ':' + a.kuerzel, a));
      zeigeStatus('nicht gespeichert — ' + fehler.message, 'schlecht');
    }
  }

  /** Fuer strukturelle Aenderungen (Board/Spalten): senden, neu laden, neu zeichnen. */
  async function strukturAendern(aktion, nutzlast, panel) {
    if (zeitgeber) { clearTimeout(zeitgeber); await sendeJetzt(); }
    try {
      await sende(aktion, nutzlast);
      leereDaten();
      await ladeDaten({ neu: true });
      neuZeichnen();
    } catch (fehler) {
      if (panel) panel.appendChild(hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
      else window.alert(fehler.message);
    }
  }

  // `ziel` wird von app.js einmal je Renderdurchlauf geleert und traegt
  // bereits die Kopfzeile mit dem Klassenumschalter, die zeichneKlasse
  // gerade angehaengt hat — hier nur noch ergaenzen, nicht erneut leeren.
  ziel.appendChild(e('h2', { text: 'Kontrollboards', style: 'margin-bottom:16px' }));

  const boards = boardsFuerKlasse(daten, klasse, 'aktiv');
  if (!zustand.boardId || !boards.some((b) => b.id === zustand.boardId)) {
    zustand.boardId = boards[0] ? boards[0].id : null;
  }

  // --- Auswahlleiste --------------------------------------------------------
  const auswahl = e('select', {
    'aria-label': 'Board auswählen',
    auf: { change: async (ev) => {
      if (zeitgeber) { clearTimeout(zeitgeber); await sendeJetzt(); }
      zustand.boardId = ev.target.value;
      neuZeichnen();
    } }
  }, boards.map((b) => e('option', { value: b.id, text: b.titel, selected: b.id === zustand.boardId })));

  const neuesBoardPanel = e('div', { klasse: 'karte', hidden: true });

  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    boards.length ? auswahl : e('span', { klasse: 'feldhilfe', text: 'Noch kein Board für diese Klasse.' }),
    e('button', { klasse: 'wichtig', text: 'Neues Board', auf: { click: () => { neuesBoardPanel.hidden = !neuesBoardPanel.hidden; } } }),
    e('button', {
      klasse: 'schub' + (zustand.ansicht === 'archiv' ? ' wichtig' : ''),
      text: zustand.ansicht === 'archiv' ? 'Zu den aktiven Boards' : 'Archiv ansehen',
      auf: { click: () => { zustand.ansicht = zustand.ansicht === 'archiv' ? 'aktiv' : 'archiv'; neuZeichnen(); } }
    })
  ]));

  zeichneNeuesBoardPanel(neuesBoardPanel, daten, klasse, strukturAendern);
  ziel.appendChild(neuesBoardPanel);

  if (zustand.ansicht === 'archiv') {
    ziel.appendChild(zeichneArchiv(daten, klasse, zustand, verbergen, neuZeichnen));
    return;
  }

  if (!boards.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Noch kein Board',
      text: 'Mit „Neues Board" die erste Checkliste dieser Klasse anlegen.'
    }));
    return;
  }

  const board = boards.find((b) => b.id === zustand.boardId);
  const spalten = spaltenFuerBoard(daten, board.id);
  const kinder = sortiereNachListe(daten.schueler.filter((s) => s.klasse === klasse && s.aktiv));

  // --- Kopf: Titel, Untertitel, Labels, Werkzeuge ---------------------------
  ziel.appendChild(e('div', { klasse: 'leiste', style: 'align-items:flex-start' }, [
    e('div', {}, [
      e('h3', { klasse: 'board-titel', text: board.titel }),
      board.untertitel ? e('div', { klasse: 'feldhilfe board-untertitel', text: board.untertitel }) : null,
      labelListe(board.labels).length
        ? e('div', { style: 'margin-top:6px' }, labelListe(board.labels).map((l) => e('span', { klasse: 'marke', style: 'margin-right:6px', text: l })))
        : null
    ]),
    e('div', { klasse: 'schub leiste', style: 'margin-bottom:0' }, [
      statusEl,
      e('button', {
        text: 'Zurücksetzen',
        auf: { click: () => {
          if (!window.confirm(`Alle Häkchen in „${board.titel}" werden gelöscht. Fortfahren?`)) return;
          strukturAendern('boardZuruecksetzen', { id: board.id });
        } }
      }),
      e('button', {
        klasse: 'gefahr',
        text: 'Archivieren',
        auf: { click: () => {
          if (!window.confirm(`„${board.titel}" wird archiviert und verschwindet aus der Auswahl. Über „Archiv ansehen" bleibt es einsehbar.`)) return;
          zustand.boardId = null;
          strukturAendern('boardStatus', { id: board.id, status: 'archiviert' });
        } }
      })
    ])
  ]));

  if (!kinder.length) {
    ziel.appendChild(e('div', { klasse: 'leer', text: 'Für diese Klasse stehen keine aktiven Kürzel bereit.' }));
    return;
  }

  ziel.appendChild(zeichneTabelle({
    daten, board, spalten, kinder, verbergen,
    schreibgeschuetzt: false,
    aufZellKlick: (button, spalteId, kuerzel, beschriftung) => {
      const aktuell = wertFuer(daten, board.id, spalteId, kuerzel);
      const neu = naechsterZustand(aktuell);
      setzeWertLokal(daten, board.id, spalteId, kuerzel, neu);
      aktualisiereZellButton(button, neu, beschriftung);
      ausstehend.set(spalteId + ':' + kuerzel, { board_id: board.id, spalte_id: spalteId, kuerzel, zustand: neu });
      planeSpeichern();
    },
    aufSpalteHinzufuegen: () => {
      const name = window.prompt('Name der neuen Spalte:');
      if (!name || !name.trim()) return;
      strukturAendern('boardSpalteHinzufuegen', { board_id: board.id, bezeichnung: name.trim() });
    },
    aufSpalteUmbenennen: (spalte) => {
      const name = window.prompt('Neue Bezeichnung:', spalte.bezeichnung);
      if (!name || !name.trim() || name.trim() === spalte.bezeichnung) return;
      strukturAendern('boardSpalteUmbenennen', { id: spalte.id, bezeichnung: name.trim() });
    },
    aufSpalteVerschieben: (spalte, richtung) => {
      const reihenfolge = spalten.map((s) => s.id);
      const i = reihenfolge.indexOf(spalte.id);
      const j = i + richtung;
      if (j < 0 || j >= reihenfolge.length) return;
      [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
      strukturAendern('boardSpaltenReihenfolge', { board_id: board.id, reihenfolge });
    },
    aufSpalteLoeschen: (spalte) => {
      if (!window.confirm(`Die Spalte „${spalte.bezeichnung}" und alle ihre Häkchen werden gelöscht. Fortfahren?`)) return;
      strukturAendern('boardSpalteLoeschen', { id: spalte.id });
    }
  }));
}

// --- Tabelle -----------------------------------------------------------------

function zeichneTabelle({ daten, board, spalten, kinder, verbergen, schreibgeschuetzt,
                          aufZellKlick, aufSpalteHinzufuegen, aufSpalteUmbenennen, aufSpalteVerschieben, aufSpalteLoeschen }) {
  const kopfZeile = [
    e('th', { klasse: 'sticky-nr', text: 'Nr.' }),
    e('th', { klasse: 'sticky-nach', text: 'Nachname' }),
    e('th', { klasse: 'sticky-vor', text: 'Vorname' }),
    ...spalten.map((s, i) => spaltenKopf(s, i, spalten.length, schreibgeschuetzt, aufSpalteUmbenennen, aufSpalteVerschieben, aufSpalteLoeschen))
  ];
  if (!schreibgeschuetzt) {
    kopfZeile.push(e('th', { klasse: 'board-plus' }, [
      e('button', { klasse: 'klein', 'aria-label': 'Spalte hinzufügen', text: '+', auf: { click: aufSpalteHinzufuegen } })
    ]));
  }

  const koerper = e('tbody', {}, kinder.map((kind) => {
    const teile = namensteile(kind.kuerzel, verbergen);
    const zellen = spalten.map((spalte) => {
      const zustand = wertFuer(daten, board.id, spalte.id, kind.kuerzel);
      const beschriftung = `${teile.istKuerzel ? kind.kuerzel : teile.vorname + ' ' + teile.nachname}, ${spalte.bezeichnung}`;
      if (schreibgeschuetzt) {
        return e('td', { klasse: 'board-zelle' }, [
          e('span', {
            klasse: 'zellzustand nurlesen' + (zustand ? ' zustand-' + zustand : ''),
            'aria-label': `${beschriftung}: ${zustandBeschriftung(zustand)}`,
            text: zustandSymbol(zustand)
          })
        ]);
      }
      const knopf = e('button', {
        klasse: 'zellzustand' + (zustand ? ' zustand-' + zustand : ''),
        'aria-pressed': zustand !== '' ? 'true' : 'false',
        'aria-label': `${beschriftung}: ${zustandBeschriftung(zustand)}`,
        text: zustandSymbol(zustand)
      });
      knopf.addEventListener('click', () => aufZellKlick(knopf, spalte.id, kind.kuerzel, beschriftung));
      return e('td', { klasse: 'board-zelle' }, [knopf]);
    });

    return e('tr', {}, [
      e('td', { klasse: 'sticky-nr nummer', text: String(kind.listennummer) }),
      e('td', { klasse: 'sticky-nach' + (teile.istKuerzel ? ' nurkuerzel' : ''), text: teile.nachname }),
      e('td', { klasse: 'sticky-vor', text: teile.vorname }),
      ...zellen
    ]);
  }));

  return e('div', { klasse: 'tabellenrahmen board-rahmen' }, [
    e('table', { klasse: 'liste board-tabelle' }, [
      e('thead', {}, [e('tr', {}, kopfZeile)]),
      koerper
    ])
  ]);
}

function spaltenKopf(spalte, index, anzahl, schreibgeschuetzt, aufUmbenennen, aufVerschieben, aufLoeschen) {
  if (schreibgeschuetzt) {
    return e('th', { klasse: 'board-kopf', text: spalte.bezeichnung });
  }
  return e('th', { klasse: 'board-kopf' }, [
    e('div', { klasse: 'board-kopf-name', text: spalte.bezeichnung }),
    e('div', { klasse: 'board-kopf-werkzeuge' }, [
      e('button', { klasse: 'klein', 'aria-label': 'Nach links verschieben', text: '◀',
        disabled: index === 0, auf: { click: () => aufVerschieben(spalte, -1) } }),
      e('button', { klasse: 'klein', 'aria-label': 'Nach rechts verschieben', text: '▶',
        disabled: index === anzahl - 1, auf: { click: () => aufVerschieben(spalte, 1) } }),
      e('button', { klasse: 'klein', 'aria-label': 'Umbenennen', text: '✎', auf: { click: () => aufUmbenennen(spalte) } }),
      e('button', { klasse: 'klein gefahr', 'aria-label': 'Löschen', text: '×', auf: { click: () => aufLoeschen(spalte) } })
    ])
  ]);
}

function aktualisiereZellButton(button, zustand, beschriftung) {
  button.className = 'zellzustand' + (zustand ? ' zustand-' + zustand : '');
  button.textContent = zustandSymbol(zustand);
  button.setAttribute('aria-pressed', zustand !== '' ? 'true' : 'false');
  button.setAttribute('aria-label', `${beschriftung}: ${zustandBeschriftung(zustand)}`);
}

// --- Neues Board ---------------------------------------------------------

function zeichneNeuesBoardPanel(panel, daten, klasse, strukturAendern) {
  leere(panel);

  const titelFeld = e('input', { type: 'text', placeholder: 'z. B. Materialien September', 'aria-label': 'Titel' });
  const untertitelFeld = e('input', { type: 'text', placeholder: 'Untertitel (optional)', 'aria-label': 'Untertitel' });
  const labelsFeld = e('input', { type: 'text', placeholder: 'Labels, kommagetrennt (optional)', 'aria-label': 'Labels', list: 'board-labels' });
  const labelsDatalist = e('datalist', { id: 'board-labels' }, alleLabels(daten).map((l) => e('option', { value: l })));

  const vorlagen = daten.boards.filter((b) => b.status === 'aktiv');
  const vorlageFeld = e('select', { 'aria-label': 'Spalten übernehmen von' }, [
    e('option', { value: '', text: 'Keine — leer beginnen' }),
    ...vorlagen.map((b) => e('option', { value: b.id, text: `${b.titel} (${b.klasse})` }))
  ]);

  const meldung = e('div', {});

  panel.appendChild(e('h3', { text: 'Neues Board', style: 'margin-bottom:12px' }));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Titel' }), titelFeld]));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Untertitel' }), untertitelFeld]));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Labels' }), labelsFeld, labelsDatalist]));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Spalten übernehmen von' }), vorlageFeld]));
  panel.appendChild(e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
    e('button', {
      klasse: 'wichtig', text: 'Anlegen',
      auf: { click: async () => {
        const titel = titelFeld.value.trim();
        if (!titel) { leere(meldung); meldung.appendChild(hinweis({ art: 'warn', zeichen: '!', text: 'Bitte einen Titel eingeben.' })); return; }
        const quelle = vorlageFeld.value ? daten.boardSpalten
          .filter((s) => s.board_id === vorlageFeld.value)
          .sort((a, b) => a.reihenfolge - b.reihenfolge)
          .map((s) => s.bezeichnung) : [];
        await strukturAendern('boardErstellen', {
          klasse, titel, untertitel: untertitelFeld.value.trim(),
          labels: labelsFeld.value.trim(), spalten: quelle
        }, meldung);
        panel.hidden = true;
      } }
    }),
    e('button', { klasse: 'leise', text: 'Abbrechen', auf: { click: () => { panel.hidden = true; } } })
  ]));
  panel.appendChild(meldung);
}

// --- Archiv ----------------------------------------------------------------

function zeichneArchiv(daten, klasse, zustand, verbergen, neuZeichnen) {
  const container = e('div', {});
  const archivierte = boardsFuerKlasse(daten, klasse, 'archiviert');

  const labelFeld = e('select', { 'aria-label': 'Nach Label filtern' }, [
    e('option', { value: '', text: 'Alle Labels' }),
    ...alleLabels(daten).map((l) => e('option', { value: l, text: l, selected: l === zustand.archivLabel }))
  ]);
  const vonFeld = e('input', { type: 'date', 'aria-label': 'Von', value: zustand.archivVon });
  const bisFeld = e('input', { type: 'date', 'aria-label': 'Bis', value: zustand.archivBis });

  function passt(board) {
    if (zustand.archivLabel && !labelListe(board.labels).includes(zustand.archivLabel)) return false;
    if (zustand.archivVon && board.archiviert_am < zustand.archivVon) return false;
    if (zustand.archivBis && board.archiviert_am > zustand.archivBis) return false;
    return true;
  }

  [labelFeld, vonFeld, bisFeld].forEach((feld) => feld.addEventListener('change', () => {
    zustand.archivLabel = labelFeld.value;
    zustand.archivVon = vonFeld.value;
    zustand.archivBis = bisFeld.value;
    neuZeichnen();
  }));

  container.appendChild(e('div', { klasse: 'leiste' }, [labelFeld, vonFeld, bisFeld]));

  const gefiltert = archivierte.filter(passt);
  if (!gefiltert.length) {
    container.appendChild(e('div', { klasse: 'leer', text: 'Keine archivierten Boards für diese Auswahl.' }));
    return container;
  }

  container.appendChild(e('div', { klasse: 'werkzeuge' }, gefiltert.map((b) => e('button', {
    klasse: 'werkzeug',
    style: 'text-align:left' + (b.id === zustand.archivAnsicht ? ';border-color:var(--akzent)' : ''),
    auf: { click: () => { zustand.archivAnsicht = zustand.archivAnsicht === b.id ? null : b.id; neuZeichnen(); } }
  }, [
    e('span', { klasse: 'titel', text: b.titel }),
    e('span', { klasse: 'beschreibung', text: 'archiviert am ' + b.archiviert_am + (b.labels ? ' · ' + b.labels : '') })
  ]))));

  if (zustand.archivAnsicht) {
    const board = archivierte.find((b) => b.id === zustand.archivAnsicht);
    if (board) {
      const spalten = spaltenFuerBoard(daten, board.id);
      const kinder = sortiereNachListe(daten.schueler.filter((s) => s.klasse === klasse && s.aktiv));
      container.appendChild(e('div', { klasse: 'abschnitt-titel', text: board.titel + ' — schreibgeschützt' }));
      container.appendChild(zeichneTabelle({ daten, board, spalten, kinder, verbergen, schreibgeschuetzt: true }));
    }
  }

  return container;
}
