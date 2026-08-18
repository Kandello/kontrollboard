/**
 * ansichten/checklisten.js — Checklisten.
 *
 * Eigener Einstieg oben in der Kopfleiste, nicht unter einer Klasse
 * versteckt: Klick fuehrt auf die Klassenknoepfe (#/checklisten), Klick auf
 * einen davon auf die eigentliche Checkliste (#/checklisten/:klasse).
 *
 * Eine Checkliste ist fuer alle Klassen gemeinsam angelegt — Parallelklassen
 * bekommen ohnehin dieselben Listen zur selben Zeit. Getrennt bleiben nur
 * die Tabellen: jede Klasse sieht ausschliesslich ihre eigenen Kinder, und
 * die Haekchen haengen am Kuerzel, das die Klasse schon eindeutig traegt.
 *
 * Board/Spalten-Aenderungen werden lokal sofort eingetragen und gezeichnet,
 * genau wie ein Klick auf eine Zelle — der Serveraufruf laeuft im
 * Hintergrund. Schlaegt er fehl, macht eine Rueckgaengig-Funktion die
 * lokale Aenderung wieder rueckgaengig und meldet den Fehler.
 *
 * DATENSCHUTZ: Klarnamen erscheinen ausschliesslich in dieser Darstellung.
 * Jeder Serveraufruf hier (boardWerte, boardSpalte*, board*) enthaelt
 * ausschliesslich Kuerzel, Bezeichnungen und Zustaende — niemals Namen.
 */

import { e, leere, karte, hinweis } from '../ui.js';
import { namensteile, sortiereNachListe } from '../zuordnung.js';
import { sende, leereDaten, ladeDaten } from '../server.js';
import { setzeVerlassenPruefung, gehe } from '../router.js';
import {
  naechsterZustand, zustandSymbol, zustandBeschriftung,
  boardeNachStatus, spaltenFuerBoard, wertFuer, alleLabels, labelListe, setzeWertLokal,
  heutigesDatum, fuegeBoardLokalHinzu, entferneBoardLokal, setzeBoardStatusLokal,
  fuegeSpalteLokalHinzu, entferneSpalteLokal, benenneSpalteLokalUm,
  setzeSpaltenReihenfolgeLokal, leereBoardWerteLokal
} from '../board.js';

/**
 * Welche Checkliste zuletzt offen war — ueberlebt ein neuZeichnen() und gilt
 * klassenuebergreifend: Checklisten sind geteilt, ein Klassenwechsel ueber
 * den Umschalter soll deshalb dieselbe Checkliste weiterzeigen, nicht auf
 * die erste zurueckspringen.
 */
const zustand = { boardId: null, ansicht: 'aktiv', archivLabel: '', archivVon: '', archivBis: '', archivAnsicht: null };

// --- Landing: Klassenknoepfe -------------------------------------------------

export function zeichneChecklistenUebersicht(ziel, { daten }) {
  ziel.appendChild(e('h1', { text: 'Checklisten' }));
  ziel.appendChild(e('div', { klasse: 'feldhilfe', style: 'margin-bottom:16px',
    text: 'Eine Checkliste gilt für alle Klassen gleichzeitig. Klasse wählen, um sie anzusehen oder abzuhaken.' }));

  const raster = e('div', { klasse: 'klassenraster' });
  if (!daten.klassen.length) {
    raster.appendChild(e('div', { klasse: 'leer',
      text: 'Im Blatt „Klassen" ist noch keine aktive Klasse eingetragen.' }));
  } else {
    daten.klassen.forEach((k, i) => {
      const anzahl = daten.schueler.filter((s) => s.klasse === k.klasse && s.aktiv).length;
      raster.appendChild(e('a', {
        href: '#/checklisten/' + encodeURIComponent(k.klasse),
        klasse: 'klassenknopf ' + farbklasse(k, i, daten),
        style: (k.farbe ? `--klassenfarbe:${k.farbe};` : '') + 'text-decoration:none;color:inherit;display:block',
        'aria-label': 'Checklisten für ' + k.bezeichnung + ' öffnen'
      }, [
        e('span', { klasse: 'name', text: k.bezeichnung }),
        e('span', { klasse: 'zusatz', text: anzahl + (anzahl === 1 ? ' Kind' : ' Kinder') })
      ]));
    });
  }
  ziel.appendChild(raster);

  const aktive = boardeNachStatus(daten, 'aktiv');
  if (aktive.length) {
    ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Vorhandene Checklisten' }));
    ziel.appendChild(e('div', { klasse: 'werkzeuge' }, aktive.map((b) => e('span', { klasse: 'werkzeug', style: 'cursor:default' }, [
      e('span', { klasse: 'titel', text: b.titel }),
      b.untertitel ? e('span', { klasse: 'beschreibung', text: b.untertitel }) : null
    ]))));
  }
}

function farbklasse(k, i, daten) {
  if (k.farbe) return '';
  const idx = daten.klassen.findIndex((x) => x.klasse === k.klasse);
  return 'k-farbe-' + (((k.reihenfolge || idx + 1) - 1) % 5 + 1);
}

// --- Werkzeug je Klasse -------------------------------------------------------

export function zeichneChecklisten(ziel, kontext) {
  const { daten, verbergen, klasse, neuZeichnen } = kontext;
  const eintrag = daten.klassen.find((k) => k.klasse === klasse);

  if (!eintrag) {
    ziel.appendChild(karte(null, [
      e('div', { klasse: 'leer' }, [
        e('div', { text: 'Die Klasse „' + klasse + '" ist im Blatt „Klassen" nicht als aktiv eingetragen.' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:16px' }, [
          e('button', { text: 'Zu den Checklisten', auf: { click: () => gehe('/checklisten') } })
        ])
      ])
    ]));
    return;
  }

  // --- Kopfzeile mit Klassenumschalter --------------------------------------
  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', {}, [
      e('h1', {}, [
        e('span', { klasse: 'klassenfarbe-punkt', 'aria-hidden': 'true' }),
        'Checklisten — ' + eintrag.bezeichnung
      ])
    ]),
    e('div', { klasse: 'schub' }, [
      e('label', { for: 'klassenwechsel', text: 'Klasse wechseln' }),
      e('select', {
        id: 'klassenwechsel',
        auf: { change: (ev) => gehe('/checklisten/' + encodeURIComponent(ev.target.value)) }
      }, daten.klassen.map((k) => e('option', {
        value: k.klasse, text: k.bezeichnung, selected: k.klasse === klasse
      })))
    ])
  ]));

  let ausstehend = new Map();
  let zeitgeber = null;

  setzeVerlassenPruefung(() => ausstehend.size
    ? 'Es gibt noch ungespeicherte Änderungen an den Checklisten. Wirklich verlassen?'
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

  /** Aktion im Hintergrund senden; bei Fehler die lokale Aenderung rueckgaengig machen. */
  function hintergrundSenden(aktion, nutzlast, rueckgaengig, fehlermeldung) {
    sende(aktion, nutzlast).catch((fehler) => {
      rueckgaengig();
      window.alert(fehlermeldung + ': ' + fehler.message);
      neuZeichnen();
    });
  }

  const boards = boardeNachStatus(daten, 'aktiv');
  if (!zustand.boardId || !boards.some((b) => b.id === zustand.boardId)) {
    zustand.boardId = boards[0] ? boards[0].id : null;
  }

  // --- Auswahlleiste ----------------------------------------------------------
  const auswahl = e('select', {
    'aria-label': 'Checkliste auswählen',
    auf: { change: (ev) => { zustand.boardId = ev.target.value; neuZeichnen(); } }
  }, boards.map((b) => e('option', { value: b.id, text: b.titel, selected: b.id === zustand.boardId })));

  const neuePanel = e('div', { klasse: 'karte', hidden: true });

  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    boards.length ? auswahl : e('span', { klasse: 'feldhilfe', text: 'Noch keine Checkliste vorhanden.' }),
    e('button', { klasse: 'wichtig', text: 'Neue Checkliste', auf: { click: () => { neuePanel.hidden = !neuePanel.hidden; } } }),
    e('button', {
      klasse: 'schub' + (zustand.ansicht === 'archiv' ? ' wichtig' : ''),
      text: zustand.ansicht === 'archiv' ? 'Zu den aktiven Checklisten' : 'Archiv ansehen',
      auf: { click: () => { zustand.ansicht = zustand.ansicht === 'archiv' ? 'aktiv' : 'archiv'; neuZeichnen(); } }
    })
  ]));

  zeichneNeuePanel(neuePanel, daten, neuZeichnen, zustand);
  ziel.appendChild(neuePanel);

  if (zustand.ansicht === 'archiv') {
    ziel.appendChild(zeichneArchiv(daten, klasse, zustand, verbergen, neuZeichnen));
    return;
  }

  if (!boards.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Noch keine Checkliste',
      text: 'Mit „Neue Checkliste" die erste anlegen.'
    }));
    return;
  }

  const board = boards.find((b) => b.id === zustand.boardId);
  const spalten = spaltenFuerBoard(daten, board.id);
  const kinder = sortiereNachListe(daten.schueler.filter((s) => s.klasse === klasse && s.aktiv));

  // --- Kopf: Titel, Untertitel, Labels, Werkzeuge -----------------------------
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
          const entfernt = leereBoardWerteLokal(daten, board.id);
          neuZeichnen();
          hintergrundSenden('boardZuruecksetzen', { id: board.id },
            () => entfernt.forEach((w) => daten.boardWerte.push(w)),
            'Zurücksetzen fehlgeschlagen');
        } }
      }),
      e('button', {
        klasse: 'gefahr',
        text: 'Archivieren',
        auf: { click: () => {
          if (!window.confirm(`„${board.titel}" wird archiviert und verschwindet aus der Auswahl. Über „Archiv ansehen" bleibt es einsehbar.`)) return;
          setzeBoardStatusLokal(daten, board.id, 'archiviert', heutigesDatum());
          zustand.boardId = null;
          neuZeichnen();
          hintergrundSenden('boardStatus', { id: board.id, status: 'archiviert' },
            () => setzeBoardStatusLokal(daten, board.id, 'aktiv', ''),
            'Archivieren fehlgeschlagen');
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
      const bezeichnung = name.trim();
      const id = crypto.randomUUID();
      const reihenfolge = spalten.length + 1;
      fuegeSpalteLokalHinzu(daten, { id, board_id: board.id, bezeichnung, reihenfolge });
      neuZeichnen();
      hintergrundSenden('boardSpalteHinzufuegen', { id, board_id: board.id, bezeichnung },
        () => entferneSpalteLokal(daten, id),
        'Spalte konnte nicht angelegt werden');
    },
    aufSpalteUmbenennen: (spalte) => {
      const name = window.prompt('Neue Bezeichnung:', spalte.bezeichnung);
      if (!name || !name.trim() || name.trim() === spalte.bezeichnung) return;
      const bezeichnung = name.trim();
      const vorher = spalte.bezeichnung;
      benenneSpalteLokalUm(daten, spalte.id, bezeichnung);
      neuZeichnen();
      hintergrundSenden('boardSpalteUmbenennen', { id: spalte.id, bezeichnung },
        () => benenneSpalteLokalUm(daten, spalte.id, vorher),
        'Umbenennen fehlgeschlagen');
    },
    aufSpalteVerschieben: (spalte, richtung) => {
      const reihenfolge = spalten.map((s) => s.id);
      const i = reihenfolge.indexOf(spalte.id);
      const j = i + richtung;
      if (j < 0 || j >= reihenfolge.length) return;
      const vorher = spalten.map((s) => ({ id: s.id, reihenfolge: s.reihenfolge }));
      [reihenfolge[i], reihenfolge[j]] = [reihenfolge[j], reihenfolge[i]];
      setzeSpaltenReihenfolgeLokal(daten, reihenfolge);
      neuZeichnen();
      hintergrundSenden('boardSpaltenReihenfolge', { board_id: board.id, reihenfolge },
        () => vorher.forEach(({ id, reihenfolge: r }) => { const s = daten.boardSpalten.find((x) => x.id === id); if (s) s.reihenfolge = r; }),
        'Reihenfolge konnte nicht gespeichert werden');
    },
    aufSpalteLoeschen: (spalte) => {
      if (!window.confirm(`Die Spalte „${spalte.bezeichnung}" und alle ihre Häkchen werden gelöscht. Fortfahren?`)) return;
      const { spalte: entfernteSpalte, entfernteWerte } = entferneSpalteLokal(daten, spalte.id);
      neuZeichnen();
      hintergrundSenden('boardSpalteLoeschen', { id: spalte.id }, () => {
        if (entfernteSpalte) fuegeSpalteLokalHinzu(daten, entfernteSpalte);
        entfernteWerte.forEach((w) => daten.boardWerte.push(w));
      }, 'Löschen fehlgeschlagen');
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

// --- Neue Checkliste ---------------------------------------------------------

function zeichneNeuePanel(panel, daten, neuZeichnen, zustand) {
  leere(panel);

  const titelFeld = e('input', { type: 'text', placeholder: 'z. B. Materialien September', 'aria-label': 'Titel' });
  const untertitelFeld = e('input', { type: 'text', placeholder: 'Untertitel (optional)', 'aria-label': 'Untertitel' });
  const labelsFeld = e('input', { type: 'text', placeholder: 'Labels, kommagetrennt (optional)', 'aria-label': 'Labels', list: 'board-labels' });
  const labelsDatalist = e('datalist', { id: 'board-labels' }, alleLabels(daten).map((l) => e('option', { value: l })));

  const meldung = e('div', {});

  panel.appendChild(e('h3', { text: 'Neue Checkliste', style: 'margin-bottom:12px' }));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Titel' }), titelFeld]));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Untertitel' }), untertitelFeld]));
  panel.appendChild(e('div', { klasse: 'feld' }, [e('label', { text: 'Labels' }), labelsFeld, labelsDatalist]));
  panel.appendChild(e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
    e('button', {
      klasse: 'wichtig', text: 'Anlegen',
      auf: { click: () => {
        const titel = titelFeld.value.trim();
        if (!titel) { leere(meldung); meldung.appendChild(hinweis({ art: 'warn', zeichen: '!', text: 'Bitte einen Titel eingeben.' })); return; }
        const untertitel = untertitelFeld.value.trim();
        const labels = labelsFeld.value.trim();
        const id = crypto.randomUUID();
        const board = { id, titel, untertitel, labels, status: 'aktiv', erstellt_am: heutigesDatum(), archiviert_am: '' };
        fuegeBoardLokalHinzu(daten, board);
        zustand.boardId = id;
        panel.hidden = true;
        neuZeichnen();
        sende('boardErstellen', { id, titel, untertitel, labels }).catch((fehler) => {
          entferneBoardLokal(daten, id);
          zustand.boardId = null;
          window.alert('Checkliste konnte nicht angelegt werden: ' + fehler.message);
          neuZeichnen();
        });
      } }
    }),
    e('button', { klasse: 'leise', text: 'Abbrechen', auf: { click: () => { panel.hidden = true; } } })
  ]));
  panel.appendChild(meldung);
}

// --- Archiv ----------------------------------------------------------------

function zeichneArchiv(daten, klasse, zustand, verbergen, neuZeichnen) {
  const container = e('div', {});
  const archivierte = boardeNachStatus(daten, 'archiviert');

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
    container.appendChild(e('div', { klasse: 'leer', text: 'Keine archivierten Checklisten für diese Auswahl.' }));
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
