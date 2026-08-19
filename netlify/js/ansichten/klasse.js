/**
 * ansichten/klasse.js — Ebene 2.
 *
 * Kopfzeile mit Klassenbezeichnung und Klassenlehrkraft, darunter die
 * Werkzeugeinstiege. Die gewaehlte Klasse ist oben umschaltbar, ohne den
 * Weg ueber die Startseite. Checklisten sind kein Werkzeug dieser Seite
 * mehr — sie sind klassenuebergreifend und haben einen eigenen Einstieg
 * in der Kopfleiste (ansichten/checklisten.js).
 *
 * Unter „Unterrichtseinheiten" steht hier der Fortschritt DIESER Klasse:
 * derselbe Jahresplan wie unter #/einheiten, aber mit abhakbaren
 * Teilthemen. Parallelklassen bearbeiten dieselben Einheiten; faellt in
 * einer Klasse eine Stunde aus, hakt eben nur sie das Teilthema spaeter ab.
 */

import { e, karte, hinweis } from '../ui.js';
import { name as anzeigeName, klassenlehrkraftEintrag, sortiereNachListe } from '../zuordnung.js';
import { lehrkraftVerweis } from './start.js';
import { gehe } from '../router.js';
import { sende } from '../server.js';
import { alsIso } from '../zeit.js';
import { heute } from '../zeit.js';
import {
  jahresplan, teilthemenFuer, istErledigt, erledigtAm, setzeFortschrittLokal,
  fortschrittEinheit, fortschrittKlasse, spurTitel
} from '../einheiten.js';

const WERKZEUGE = [
  { id: 'einheiten', titel: 'Unterrichtseinheiten', beschreibung: 'Fortschritt dieser Klasse' }
];

export function zeichneKlasse(ziel, kontext) {
  const { daten, verbergen, klasse, werkzeug } = kontext;
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
    const gesamt = fortschrittKlasse(daten, klasse);
    ziel.appendChild(e('div', { klasse: 'werkzeuge' }, WERKZEUGE.map((w) => e('a', {
      klasse: 'werkzeug',
      href: '#/klasse/' + encodeURIComponent(klasse) + '/' + w.id
    }, [
      e('span', { klasse: 'titel', text: w.titel }),
      e('span', { klasse: 'beschreibung', text: w.id === 'einheiten' && gesamt.prozent !== null
        ? `${gesamt.erledigt} von ${gesamt.gesamt} Teilthemen erledigt · ${gesamt.prozent} %`
        : w.beschreibung })
    ]))));

    ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassenliste' }));
    ziel.appendChild(schuelerliste(kinder, verbergen));
    return;
  }

  // --- Einzelnes Werkzeug --------------------------------------------------
  const w = WERKZEUGE.find((x) => x.id === werkzeug);
  if (!w) { gehe('/klasse/' + encodeURIComponent(klasse), { ersetzen: true }); return; }

  if (werkzeug === 'einheiten') {
    zeichneEinheitenFortschritt(ziel, daten, klasse, kontext.neuZeichnen);
    return;
  }

  ziel.appendChild(karte(w.titel, [
    e('div', { klasse: 'leer', style: 'padding:32px 16px' }, [
      e('div', { text: 'Dieses Werkzeug wird in einem der nächsten Schritte gebaut.' })
    ])
  ]));

  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassenliste' }));
  ziel.appendChild(schuelerliste(kinder, verbergen));
}

// --- Unterrichtseinheiten: Fortschritt dieser Klasse -------------------------

/**
 * Der Jahresplan mit abhakbaren Teilthemen. Die Haekchen werden lokal sofort
 * gesetzt und gebuendelt nachgeschickt — genau wie bei den Checklisten, damit
 * das Abhaken im Unterricht nicht auf die Tabelle wartet.
 */
function zeichneEinheitenFortschritt(ziel, daten, klasse, neuZeichnen) {
  const plan = jahresplan(daten.einheiten || []);
  const gesamt = fortschrittKlasse(daten, klasse);

  const statusEl = e('span', { klasse: 'feldhilfe' });
  let ausstehend = new Map();
  let zeitgeber = null;

  function zeigeStatus(text, art) {
    statusEl.textContent = text;
    statusEl.className = 'feldhilfe' + (art ? ' status-' + art : '');
  }

  async function sendeJetzt() {
    zeitgeber = null;
    if (!ausstehend.size) return;
    const aenderungen = [...ausstehend.values()];
    ausstehend.clear();
    zeigeStatus('wird gespeichert …', '');
    try {
      await sende('fortschritt', { aenderungen });
      zeigeStatus('gespeichert', 'gut');
    } catch (fehler) {
      aenderungen.forEach((a) => ausstehend.set(a.teilthema_id, a));
      zeigeStatus('nicht gespeichert — ' + fehler.message, 'schlecht');
    }
  }

  function planeSpeichern(aenderung) {
    ausstehend.set(aenderung.teilthema_id, aenderung);
    zeigeStatus('nicht gespeichert', 'warn');
    if (zeitgeber) clearTimeout(zeitgeber);
    zeitgeber = setTimeout(sendeJetzt, 1000);
  }

  ziel.appendChild(karte(null, [
    e('div', { klasse: 'leiste', style: 'margin:0' }, [
      e('div', {}, [
        e('h2', { text: 'Unterrichtseinheiten' }),
        e('div', { klasse: 'feldhilfe', text: gesamt.prozent === null
          ? 'Noch keine Teilthemen eingeplant.'
          : `${gesamt.erledigt} von ${gesamt.gesamt} Teilthemen erledigt · ${gesamt.prozent} %` })
      ]),
      e('div', { klasse: 'schub' }, [
        statusEl,
        e('a', { klasse: 'knopf klein', href: '#/einheiten', text: 'Jahresplan bearbeiten' })
      ])
    ]),
    gesamt.gesamt
      ? e('div', { klasse: 'balken gross', role: 'presentation' },
          [e('i', { style: `width:${gesamt.prozent}%` })])
      : null
  ]));

  if (!plan.geplant.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Noch kein Jahresplan',
      text: 'Es ist noch keine Unterrichtseinheit eingeplant.'
    }));
    return;
  }

  plan.geplant.forEach((einheit) => {
    const themen = teilthemenFuer(daten, einheit.id);
    const f = fortschrittEinheit(daten, einheit.id, klasse);

    const liste = themen.length
      ? e('ul', { klasse: 'teilthemen-abhaken' }, themen.map((t) => {
          const an = istErledigt(daten, t.id, klasse);
          const datumEl = e('span', { klasse: 'feldhilfe',
                                      text: an && erledigtAm(daten, t.id, klasse)
                                        ? 'am ' + erledigtAm(daten, t.id, klasse) : '' });
          const kasten = e('input', {
            type: 'checkbox', checked: an,
            'aria-label': t.titel,
            auf: { change: (ev) => {
              const jetztAn = ev.target.checked;
              const datum = alsIso(heute());
              setzeFortschrittLokal(daten, t.id, klasse, jetztAn, datum);
              datumEl.textContent = jetztAn ? 'am ' + datum : '';
              zeile.className = jetztAn ? 'ist-erledigt' : '';
              aktualisiereZaehler();
              planeSpeichern({ teilthema_id: t.id, klasse, erledigt: jetztAn, datum });
            } }
          });
          const zeile = e('li', { klasse: an ? 'ist-erledigt' : '' }, [
            e('label', {}, [kasten, e('span', { text: t.titel })]),
            datumEl
          ]);
          return zeile;
        }))
      : e('div', { klasse: 'feldhilfe', text: 'Für diese Einheit sind noch keine Teilthemen angelegt.' });

    const zaehler = e('span', { klasse: 'feldhilfe',
                                text: `${f.erledigt} von ${f.gesamt}` });

    function aktualisiereZaehler() {
      const neu = fortschrittEinheit(daten, einheit.id, klasse);
      zaehler.textContent = `${neu.erledigt} von ${neu.gesamt}`;
    }

    ziel.appendChild(karte(null, [
      e('div', { klasse: 'leiste', style: 'margin:0 0 8px' }, [
        e('div', {}, [
          e('h3', { text: einheit.titel }),
          e('div', { klasse: 'feldhilfe', text:
            `${spurTitel(einheit.spur)} · Woche ${einheit.von}` +
            (einheit.dauer_wochen > 1 ? '–' + einheit.bis : '') })
        ]),
        e('div', { klasse: 'schub' }, [zaehler])
      ]),
      liste
    ]));
  });
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
