/**
 * ansichten/klasse.js — Ebene 2.
 *
 * Kopfzeile mit Klassenbezeichnung und Klassenlehrkraft, darunter die drei
 * Werkzeugeinstiege. Die gewaehlte Klasse ist oben umschaltbar, ohne den
 * Weg ueber die Startseite.
 *
 * Stand Schritt 2: Die Werkzeuge selbst sind Platzhalter (Schritte 4 bis 9).
 * Die Schuelerliste wird bereits echt gezeigt — damit ist die
 * Zuordnungslogik ueberpruefbar.
 */

import { e, karte } from '../ui.js';
import { name as anzeigeName, klassenlehrkraftEintrag, sortiereNachListe } from '../zuordnung.js';
import { lehrkraftVerweis } from './start.js';
import { gehe } from '../router.js';

const WERKZEUGE = [
  { id: 'noten',     titel: 'Notentracker',        beschreibung: 'Erhebungen erfassen, Notenübersicht, Auswertung' },
  { id: 'boards',    titel: 'Kontrollboards',      beschreibung: 'Mehrspaltige Checklisten je Kind' },
  { id: 'einheiten', titel: 'Unterrichtseinheiten', beschreibung: 'Fortschritt dieser Klasse' }
];

export function zeichneKlasse(ziel, { daten, verbergen, klasse, werkzeug }) {
  const eintrag = daten.klassen.find((k) => k.klasse === klasse);

  if (!eintrag) {
    ziel.appendChild(karte(null, [
      e('div', { klasse: 'leer' }, [
        e('div', { text: 'Die Klasse „' + klasse + '" ist im Blatt „Klassen" nicht als aktiv eingetragen.' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:16px' }, [
          e('button', { text: 'Zur Startseite', auf: { click: () => gehe('/') } })
        ])
      ])
    ]));
    return;
  }

  const lehrkraft = verbergen ? null : klassenlehrkraftEintrag(klasse);
  const kinder = sortiereNachListe(daten.schueler.filter((s) => s.klasse === klasse));
  const aktive = kinder.filter((s) => s.aktiv);

  // --- Kopfzeile mit Klassenumschalter ------------------------------------
  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', { klasse: farbklasseFuer(eintrag, daten),
               style: eintrag.farbe ? `--klassenfarbe:${eintrag.farbe}` : null }, [
      e('h1', {}, [
        e('span', { klasse: 'klassenfarbe-punkt', 'aria-hidden': 'true' }),
        eintrag.bezeichnung
      ]),
      e('div', { klasse: 'feldhilfe' }, [
        aktive.length + (aktive.length === 1 ? ' aktives Kind' : ' aktive Kinder'),
        lehrkraft ? ' · Klassenlehrkraft: ' : null,
        lehrkraft ? lehrkraftVerweis(lehrkraft) : null
      ])
    ]),
    e('div', { klasse: 'schub' }, [
      e('label', { for: 'klassenwechsel', text: 'Klasse wechseln' }),
      e('select', {
        id: 'klassenwechsel',
        auf: { change: (ev) => gehe('/klasse/' + encodeURIComponent(ev.target.value) + (werkzeug ? '/' + werkzeug : '')) }
      }, daten.klassen.map((k) => e('option', {
        value: k.klasse, text: k.bezeichnung, selected: k.klasse === klasse
      })))
    ])
  ]));

  // --- Werkzeugeinstiege --------------------------------------------------
  if (!werkzeug) {
    ziel.appendChild(e('div', { klasse: 'werkzeuge' }, WERKZEUGE.map((w) => e('a', {
      klasse: 'werkzeug',
      href: '#/klasse/' + encodeURIComponent(klasse) + '/' + w.id
    }, [
      e('span', { klasse: 'titel', text: w.titel }),
      e('span', { klasse: 'beschreibung', text: w.beschreibung })
    ]))));

    ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassenliste' }));
    ziel.appendChild(schuelerliste(kinder, verbergen));
    return;
  }

  // --- Einzelnes Werkzeug (noch Platzhalter) ------------------------------
  const w = WERKZEUGE.find((x) => x.id === werkzeug);
  if (!w) { gehe('/klasse/' + encodeURIComponent(klasse), { ersetzen: true }); return; }

  ziel.appendChild(karte(w.titel, [
    e('div', { klasse: 'leer', style: 'padding:32px 16px' }, [
      e('div', { text: 'Dieses Werkzeug wird in einem der nächsten Schritte gebaut.' }),
      e('div', { klasse: 'feldhilfe', style: 'margin-top:8px',
                 text: 'Das Gerüst und die Namensanzeige stehen bereits — die Liste unten kommt aus der Tabelle.' })
    ])
  ]));

  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassenliste' }));
  ziel.appendChild(schuelerliste(kinder, verbergen));
}

/**
 * Anzeigeliste, immer nach listennummer sortiert — niemals nach dem Kuerzel.
 * Die Kuerzelnummer ist absichtlich gemischt; eine Sortierung danach ergaebe
 * eine unbrauchbare Reihenfolge.
 */
function schuelerliste(kinder, verbergen) {
  if (!kinder.length) {
    return karte(null, [e('div', { klasse: 'leer',
      text: 'Für diese Klasse stehen noch keine Kürzel im Blatt „Schueler".' })]);
  }

  const koerper = e('tbody', {}, kinder.map((s) => {
    const angezeigt = anzeigeName(s.kuerzel, verbergen);
    const istKuerzel = angezeigt === s.kuerzel;
    return e('tr', { klasse: s.aktiv ? '' : 'inaktiv' }, [
      e('td', { klasse: 'nummer', text: s.listennummer || '–' }),
      e('td', {}, [e('span', { klasse: istKuerzel ? 'nurkuerzel' : '', text: angezeigt })]),
      e('td', { klasse: 'kuerzel', text: s.kuerzel }),
      e('td', { klasse: 'kuerzel', text: s.aktiv ? '' : 'abgemeldet' })
    ]);
  }));

  return e('div', { klasse: 'tabellenrahmen' }, [
    e('table', { klasse: 'liste' }, [
      e('thead', {}, [e('tr', {}, [
        e('th', { text: 'Nr.' }),
        e('th', { text: 'Name' }),
        e('th', { text: 'Kürzel' }),
        e('th', { text: '' })
      ])]),
      koerper
    ])
  ]);
}

/** Farbklasse der Klasse, passend zur Startseite. */
function farbklasseFuer(eintrag, daten) {
  if (eintrag.farbe) return '';
  const i = daten.klassen.findIndex((k) => k.klasse === eintrag.klasse);
  return 'k-farbe-' + (((eintrag.reihenfolge || i + 1) - 1) % 5 + 1);
}
