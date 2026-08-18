/**
 * ansichten/noten.js — Notentracker.
 *
 * Drei Ebenen, die zusammen den Weg der bisherigen Numbers-Tabelle abbilden:
 *
 *   Erfassung  — Testkacheln (grosse Nummer, klein und grau das Thema) und
 *                Monatskacheln fuer Mitarbeit/Praesentation. Ein Klick
 *                oeffnet die Eingabeliste der Klasse.
 *   Übersicht  — alle Kinder mit Saeulenmittelwerten, Gesamtprozent, Note.
 *   Auswertung — Notenverteilung der Klasse auf einen Blick.
 *
 * Gerechnet wird ausschliesslich in noten.js, das gegen die bisherige
 * Tabelle geprueft ist — hier steht keine einzige Notenformel.
 *
 * DATENSCHUTZ: Klarnamen erscheinen nur in dieser Darstellung. Jeder
 * Serveraufruf enthaelt ausschliesslich Kuerzel, Zahlen und Bezeichnungen.
 */

import { e, leere, karte, hinweis } from '../ui.js';
import { namensteile, sortiereNachListe } from '../zuordnung.js';
import { sende } from '../server.js';
import { setzeVerlassenPruefung, gehe } from '../router.js';
import {
  werteAus, erhebungenFuer, gewichteFuer, noteFuer, halbjahrVon, schuljahrVon,
  NOTENSCHLUESSEL
} from '../noten.js';

/** Wie viele Tests je Halbjahr vorgesehen sind (drei pro Halbjahr in Deutsch). */
const TESTS_JE_HALBJAHR = 3;

/** Monate eines Schuljahres, in der Reihenfolge, in der sie unterrichtet werden. */
const MONATE = [
  { nr: 8, name: 'August' },   { nr: 9,  name: 'September' }, { nr: 10, name: 'Oktober' },
  { nr: 11, name: 'November' }, { nr: 12, name: 'Dezember' },  { nr: 1,  name: 'Januar' },
  { nr: 2, name: 'Februar' },  { nr: 3,  name: 'März' },      { nr: 4,  name: 'April' },
  { nr: 5, name: 'Mai' },      { nr: 6,  name: 'Juni' },       { nr: 7,  name: 'Juli' }
];

/** Ansichtszustand, ueberlebt ein neuZeichnen(). */
const zustand = {
  halbjahr: null, schuljahr: null,
  ansicht: 'erfassung',   // erfassung | uebersicht | auswertung
  offen: null             // { art: 'test'|'monat', anlass, kategorie, datum, titel }
};

export function zeichneNoten(ziel, kontext) {
  const { daten, verbergen, klasse, neuZeichnen } = kontext;
  const eintrag = daten.klassen.find((k) => k.klasse === klasse);

  if (!eintrag) {
    ziel.appendChild(karte(null, [
      e('div', { klasse: 'leer' }, [
        e('div', { text: 'Die Klasse „' + klasse + '" ist im Blatt „Klassen" nicht als aktiv eingetragen.' }),
        e('div', { klasse: 'leiste', style: 'justify-content:center;margin-top:16px' }, [
          e('button', { text: 'Zum Notentracker', auf: { click: () => gehe('/noten') } })
        ])
      ])
    ]));
    return;
  }

  const grenze = daten.meta.halbjahresgrenze || '01-31';
  const heute = new Date().toISOString().slice(0, 10);
  if (zustand.schuljahr === null) zustand.schuljahr = schuljahrVon(heute);
  if (zustand.halbjahr === null) zustand.halbjahr = halbjahrVon(heute, grenze);

  const kinder = sortiereNachListe(daten.schueler.filter((s) => s.klasse === klasse && s.aktiv));
  const kategorien = daten.kategorien;
  const gewichte = gewichteFuer(daten, daten.fach || 'DE');
  const schluessel = daten.notenschluessel && daten.notenschluessel.length
    ? daten.notenschluessel : NOTENSCHLUESSEL;

  // --- Kopfzeile mit Klassenknoepfen ----------------------------------------
  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', {}, [
      e('h1', {}, [
        e('span', { klasse: 'klassenfarbe-punkt', 'aria-hidden': 'true' }),
        'Notentracker'
      ])
    ]),
    e('div', { klasse: 'schub', style: 'display:flex;gap:6px;flex-wrap:wrap',
               role: 'group', 'aria-label': 'Klasse wechseln' },
      daten.klassen.map((k) => e('button', {
        klasse: 'klein' + (k.klasse === klasse ? ' wichtig' : ''),
        text: k.bezeichnung,
        'aria-current': k.klasse === klasse ? 'true' : null,
        auf: { click: () => { if (k.klasse !== klasse) gehe('/noten/' + encodeURIComponent(k.klasse)); } }
      })))
  ]));

  // --- Halbjahr und Ansicht --------------------------------------------------
  ziel.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', { style: 'display:flex;gap:6px', role: 'group', 'aria-label': 'Halbjahr wählen' }, [
      halbjahrKnopf(1, 'Erstes Halbjahr', neuZeichnen),
      halbjahrKnopf(2, 'Zweites Halbjahr', neuZeichnen)
    ]),
    e('span', { klasse: 'feldhilfe',
      text: `Schuljahr ${zustand.schuljahr}/${String(zustand.schuljahr + 1).slice(2)}` }),
    e('div', { klasse: 'schub', style: 'display:flex;gap:6px', role: 'group', 'aria-label': 'Ansicht wählen' }, [
      ansichtKnopf('erfassung', 'Erfassung', neuZeichnen),
      ansichtKnopf('uebersicht', 'Übersicht', neuZeichnen),
      ansichtKnopf('auswertung', 'Auswertung', neuZeichnen)
    ])
  ]));

  const rahmen = { daten, klasse, kinder, verbergen, kategorien, gewichte, schluessel, grenze, neuZeichnen };

  if (zustand.ansicht === 'uebersicht') { ziel.appendChild(zeichneUebersicht(rahmen)); return; }
  if (zustand.ansicht === 'auswertung') { ziel.appendChild(zeichneAuswertung(rahmen)); return; }
  zeichneErfassung(ziel, rahmen);
}

function halbjahrKnopf(nr, beschriftung, neuZeichnen) {
  return e('button', {
    klasse: 'klein' + (zustand.halbjahr === nr ? ' wichtig' : ''),
    text: beschriftung,
    'aria-current': zustand.halbjahr === nr ? 'true' : null,
    auf: { click: () => { zustand.halbjahr = nr; zustand.offen = null; neuZeichnen(); } }
  });
}

function ansichtKnopf(id, beschriftung, neuZeichnen) {
  return e('button', {
    klasse: 'klein' + (zustand.ansicht === id ? ' wichtig' : ''),
    text: beschriftung,
    'aria-current': zustand.ansicht === id ? 'true' : null,
    auf: { click: () => { zustand.ansicht = id; neuZeichnen(); } }
  });
}

// --- Erfassung ---------------------------------------------------------------

/** Anlassbezeichnung eines Tests — stabil, damit sie als Schluessel taugt. */
function testAnlass(schuljahr, halbjahr, nummer) {
  return `${schuljahr}-H${halbjahr}-T${nummer}`;
}

function monatAnlass(schuljahr, monatNr) {
  const jahr = monatNr >= 8 ? schuljahr : schuljahr + 1;
  return `${jahr}-${String(monatNr).padStart(2, '0')}`;
}

/** Monate, die im gewaehlten Halbjahr liegen. */
function monateDesHalbjahres(halbjahr, grenze) {
  return MONATE.filter((m) => {
    const jahr = m.nr >= 8 ? 2000 : 2001;   // Platzhalterjahre, nur fuer die Zuordnung
    const datum = `${jahr}-${String(m.nr).padStart(2, '0')}-15`;
    return halbjahrVon(datum, grenze) === halbjahr;
  });
}

function zeichneErfassung(ziel, rahmen) {
  const { daten, klasse, kinder, verbergen, neuZeichnen, grenze } = rahmen;

  // Offene Eingabeliste hat Vorrang vor der Kachelauswahl.
  if (zustand.offen) {
    ziel.appendChild(zeichneEingabe(rahmen));
    return;
  }

  if (!kinder.length) {
    ziel.appendChild(e('div', { klasse: 'leer', text: 'Für diese Klasse stehen keine aktiven Kürzel bereit.' }));
    return;
  }

  // --- Testkacheln ----------------------------------------------------------
  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Tests' }));

  const testKacheln = [];
  for (let nr = 1; nr <= TESTS_JE_HALBJAHR; nr++) {
    const anlass = testAnlass(zustand.schuljahr, zustand.halbjahr, nr);
    const thema = themaFuer(daten, zustand.schuljahr, zustand.halbjahr, nr);
    const erfasst = kinder.filter((k) => wertVon(daten, k.kuerzel, 'TEST', anlass) !== null).length;

    testKacheln.push(e('button', {
      klasse: 'werkzeug kachel-eingabe',
      style: 'text-align:left',
      auf: { click: () => {
        zustand.offen = {
          art: 'test', anlass, kategorien: ['TEST'],
          titel: 'Test ' + nr, nummer: nr,
          datum: datumVon(daten, anlass, 'TEST') || heuteAlsText()
        };
        neuZeichnen();
      } }
    }, [
      e('span', { klasse: 'titel', text: 'Test ' + nr }),
      e('span', { klasse: 'beschreibung', text: thema || 'Thema noch nicht eingetragen' }),
      e('span', { klasse: 'beschreibung', style: 'margin-top:6px',
                  text: erfasst ? `${erfasst} von ${kinder.length} erfasst` : 'noch nichts erfasst' })
    ]));
  }
  ziel.appendChild(e('div', { klasse: 'werkzeuge' }, testKacheln));

  // --- Monatskacheln --------------------------------------------------------
  ziel.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Mitarbeit und Präsentation' }));

  const monate = monateDesHalbjahres(zustand.halbjahr, grenze);
  ziel.appendChild(e('div', { klasse: 'werkzeuge' }, monate.map((m) => {
    const anlass = monatAnlass(zustand.schuljahr, m.nr);
    const erfasst = kinder.filter((k) =>
      wertVon(daten, k.kuerzel, 'PART', anlass) !== null ||
      wertVon(daten, k.kuerzel, 'PRES', anlass) !== null).length;

    return e('button', {
      klasse: 'werkzeug kachel-eingabe',
      style: 'text-align:left',
      auf: { click: () => {
        zustand.offen = {
          art: 'monat', anlass, kategorien: ['PART', 'PRES'],
          titel: m.name, datum: letzterTagVon(anlass)
        };
        neuZeichnen();
      } }
    }, [
      e('span', { klasse: 'titel', text: m.name }),
      e('span', { klasse: 'beschreibung',
                  text: erfasst ? `${erfasst} von ${kinder.length} erfasst` : 'noch nichts erfasst' })
    ]);
  })));
}

function heuteAlsText() { return new Date().toISOString().slice(0, 10); }

/** Letzter Tag eines Monats 'JJJJ-MM' — als Stichtag fuer Monatswerte. */
function letzterTagVon(anlass) {
  const [jahr, monat] = anlass.split('-').map(Number);
  return `${jahr}-${String(monat).padStart(2, '0')}-${new Date(jahr, monat, 0).getDate()}`;
}

function themaFuer(daten, schuljahr, halbjahr, nummer) {
  const t = daten.tests.find((x) =>
    x.schuljahr === schuljahr && x.halbjahr === halbjahr && x.nummer === nummer);
  return t ? t.thema : '';
}

function wertVon(daten, kuerzel, kategorie_id, anlass) {
  const t = daten.erhebungen.find((x) =>
    x.kuerzel === kuerzel && x.kategorie_id === kategorie_id && x.anlass === anlass);
  return t ? t.wert : null;
}

function datumVon(daten, anlass, kategorie_id) {
  const t = daten.erhebungen.find((x) => x.anlass === anlass && x.kategorie_id === kategorie_id);
  return t ? t.datum : null;
}

// --- Eingabeliste ------------------------------------------------------------

function zeichneEingabe(rahmen) {
  const { daten, klasse, kinder, verbergen, neuZeichnen } = rahmen;
  const offen = zustand.offen;
  const behaelter = e('div', {});

  let ausstehend = new Map();
  let zeitgeber = null;
  const statusEl = e('span', { klasse: 'feldhilfe', text: '' });

  setzeVerlassenPruefung(() => ausstehend.size
    ? 'Es gibt noch ungespeicherte Noten. Wirklich verlassen?'
    : null);

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
      await sende('erhebungen', { aenderungen });
      zeigeStatus('gespeichert', 'gut');
    } catch (fehler) {
      aenderungen.forEach((a) => ausstehend.set(a.kategorie_id + ':' + a.kuerzel, a));
      zeigeStatus('nicht gespeichert — ' + fehler.message, 'schlecht');
    }
  }

  function planeSpeichern() {
    zeigeStatus('nicht gespeichert', 'warn');
    if (zeitgeber) clearTimeout(zeitgeber);
    zeitgeber = setTimeout(sendeJetzt, 1000);
  }

  // --- Kopf: zurueck, Titel, Thema, Datum -----------------------------------
  const kopfKinder = [
    e('button', { klasse: 'klein', text: '← Zurück', auf: { click: async () => {
      if (zeitgeber) { clearTimeout(zeitgeber); await sendeJetzt(); }
      zustand.offen = null;
      neuZeichnen();
    } } }),
    e('h3', { klasse: 'noten-titel', text: offen.titel, style: 'margin:0 0 0 4px' })
  ];

  behaelter.appendChild(e('div', { klasse: 'leiste' }, [
    e('div', { klasse: 'leiste', style: 'margin-bottom:0;align-items:center' }, kopfKinder),
    e('span', { klasse: 'schub' }, [statusEl])
  ]));

  // Thema nur bei Tests — es gilt klassenuebergreifend.
  if (offen.art === 'test') {
    const themaFeld = e('input', {
      type: 'text', 'aria-label': 'Thema des Tests',
      placeholder: 'z. B. Wortarten',
      value: themaFuer(daten, zustand.schuljahr, zustand.halbjahr, offen.nummer)
    });
    themaFeld.addEventListener('change', async () => {
      const thema = themaFeld.value.trim();
      // Lokal sofort eintragen, damit die Kachel es beim Zurueckgehen zeigt.
      setzeThemaLokal(daten, zustand.schuljahr, zustand.halbjahr, offen.nummer, thema);
      try {
        await sende('testThema', {
          schuljahr: zustand.schuljahr, halbjahr: zustand.halbjahr,
          nummer: offen.nummer, thema
        });
        zeigeStatus('Thema gespeichert', 'gut');
      } catch (fehler) {
        zeigeStatus('Thema nicht gespeichert — ' + fehler.message, 'schlecht');
      }
    });
    behaelter.appendChild(e('div', { klasse: 'feld' }, [
      e('label', { text: 'Thema' }), themaFeld,
      e('div', { klasse: 'feldhilfe', text: 'Gilt für alle drei Klassen — sie schreiben denselben Test.' })
    ]));
  }

  const datumFeld = e('input', { type: 'date', 'aria-label': 'Datum', value: offen.datum });
  datumFeld.addEventListener('change', () => { offen.datum = datumFeld.value; });
  behaelter.appendChild(e('div', { klasse: 'feld' }, [
    e('label', { text: 'Datum' }), datumFeld,
    e('div', { klasse: 'feldhilfe', text: 'Bestimmt, in welches Halbjahr die Werte zählen.' })
  ]));

  // --- Eingabetabelle -------------------------------------------------------
  const spalten = offen.kategorien.map((id) => {
    const k = daten.kategorien.find((x) => x.id === id);
    return { id, bezeichnung: k ? k.bezeichnung : id };
  });

  const koerper = e('tbody', {}, kinder.map((kind) => {
    const teile = namensteile(kind.kuerzel, verbergen);
    const felder = spalten.map((sp) => {
      const wert = wertVon(daten, kind.kuerzel, sp.id, offen.anlass);
      const feld = e('input', {
        type: 'number', min: '0', max: '100', inputmode: 'numeric',
        klasse: 'notenfeld',
        'aria-label': `${teile.istKuerzel ? kind.kuerzel : teile.vorname + ' ' + teile.nachname}, ${sp.bezeichnung}`,
        value: wert === null ? '' : String(wert)
      });
      feld.addEventListener('input', () => {
        const roh = feld.value.trim();
        const zahl = roh === '' ? '' : Number(roh);
        feld.classList.toggle('fehlerhaft', roh !== '' && (Number.isNaN(zahl) || zahl < 0 || zahl > 100));
        setzeWertLokal(daten, kind.kuerzel, sp.id, offen.anlass, roh === '' ? null : zahl, offen.datum);
        ausstehend.set(sp.id + ':' + kind.kuerzel, {
          kuerzel: kind.kuerzel, kategorie_id: sp.id, anlass: offen.anlass,
          datum: offen.datum, wert: roh
        });
        planeSpeichern();
      });
      return e('td', {}, [feld]);
    });

    return e('tr', {}, [
      e('td', { klasse: 'nummer', text: String(kind.listennummer) }),
      e('td', { klasse: teile.istKuerzel ? 'nurkuerzel' : '', text: teile.nachname }),
      e('td', { text: teile.vorname }),
      ...felder
    ]);
  }));

  behaelter.appendChild(e('div', { klasse: 'tabellenrahmen' }, [
    e('table', { klasse: 'liste' }, [
      e('thead', {}, [e('tr', {}, [
        e('th', { text: 'Nr.' }), e('th', { text: 'Nachname' }), e('th', { text: 'Vorname' }),
        ...spalten.map((sp) => e('th', { text: sp.bezeichnung + ' (%)' }))
      ])]),
      koerper
    ])
  ]));

  behaelter.appendChild(e('div', { klasse: 'feldhilfe', style: 'margin-top:8px',
    text: 'Leer lassen heißt „kein Wert" — das Kind wird bei diesem Termin nicht mitgerechnet, ' +
          'nicht etwa mit null Prozent.' }));

  return behaelter;
}

function setzeThemaLokal(daten, schuljahr, halbjahr, nummer, thema) {
  const i = daten.tests.findIndex((x) =>
    x.schuljahr === schuljahr && x.halbjahr === halbjahr && x.nummer === nummer);
  if (!thema) { if (i !== -1) daten.tests.splice(i, 1); return; }
  if (i !== -1) daten.tests[i].thema = thema;
  else daten.tests.push({ schuljahr, halbjahr, nummer, thema });
}

function setzeWertLokal(daten, kuerzel, kategorie_id, anlass, wert, datum) {
  const i = daten.erhebungen.findIndex((x) =>
    x.kuerzel === kuerzel && x.kategorie_id === kategorie_id && x.anlass === anlass);
  if (wert === null || wert === '' || Number.isNaN(wert)) {
    if (i !== -1) daten.erhebungen.splice(i, 1);
    return;
  }
  if (i !== -1) { daten.erhebungen[i].wert = wert; daten.erhebungen[i].datum = datum; }
  else daten.erhebungen.push({ id: '', datum, kuerzel, kategorie_id, anlass, wert, notiz: '' });
}

// --- Übersicht ---------------------------------------------------------------

/** Auswertung aller Kinder der Klasse fuer das gewaehlte Halbjahr. */
function auswertungen(rahmen) {
  const { daten, kinder, kategorien, gewichte, schluessel, grenze } = rahmen;
  return kinder.map((kind) => {
    const erhebungen = erhebungenFuer(daten, {
      kuerzel: kind.kuerzel, halbjahr: zustand.halbjahr,
      schuljahr: zustand.schuljahr, grenze
    });
    return { kind, ergebnis: werteAus(erhebungen, { kategorien, gewichte, schluessel }) };
  });
}

function zeichneUebersicht(rahmen) {
  const { verbergen, kategorien, gewichte } = rahmen;
  const behaelter = e('div', {});
  const zeilen = auswertungen(rahmen);

  if (!zeilen.length) {
    behaelter.appendChild(e('div', { klasse: 'leer', text: 'Für diese Klasse stehen keine aktiven Kürzel bereit.' }));
    return behaelter;
  }

  const gruppen = Object.keys(gewichte);
  const gruppenName = (g) => {
    const k = kategorien.filter((x) => x.gruppe === g);
    if (g === 'PP') return 'Mitarbeit/Präs.';
    return k.length ? k[0].bezeichnung : g;
  };

  const koerper = e('tbody', {}, zeilen.map(({ kind, ergebnis }) => {
    const teile = namensteile(kind.kuerzel, verbergen);
    return e('tr', {}, [
      e('td', { klasse: 'nummer', text: String(kind.listennummer) }),
      e('td', { klasse: teile.istKuerzel ? 'nurkuerzel' : '', text: teile.nachname }),
      e('td', { text: teile.vorname }),
      ...gruppen.map((g) => e('td', { klasse: 'zahl',
        text: typeof ergebnis.saeulen[g] === 'number' ? ergebnis.saeulen[g].toFixed(1) : '–' })),
      e('td', { klasse: 'zahl', text: ergebnis.prozent === null ? '–' : String(ergebnis.prozent) }),
      e('td', {}, [notenMarke(ergebnis.note)])
    ]);
  }));

  behaelter.appendChild(e('div', { klasse: 'tabellenrahmen' }, [
    e('table', { klasse: 'liste' }, [
      e('thead', {}, [e('tr', {}, [
        e('th', { text: 'Nr.' }), e('th', { text: 'Nachname' }), e('th', { text: 'Vorname' }),
        ...gruppen.map((g) => e('th', { text: `${gruppenName(g)} (${Math.round(gewichte[g] * 100)} %)` })),
        e('th', { text: 'Gesamt' }), e('th', { text: 'Note' })
      ])]),
      koerper
    ])
  ]));

  const ohne = zeilen.filter((z) => z.ergebnis.note === null).length;
  if (ohne) {
    behaelter.appendChild(e('div', { klasse: 'feldhilfe', style: 'margin-top:8px',
      text: `${ohne} ${ohne === 1 ? 'Kind hat' : 'Kinder haben'} in diesem Halbjahr noch keine Werte ` +
            'und bekommen deshalb keine Note — keine Sechs.' }));
  }
  return behaelter;
}

function notenMarke(note) {
  if (note === null || note === undefined) return e('span', { klasse: 'feldhilfe', text: '–' });
  return e('span', { klasse: 'marke note-' + note, text: String(note) });
}

// --- Auswertung --------------------------------------------------------------

function zeichneAuswertung(rahmen) {
  const behaelter = e('div', {});
  const zeilen = auswertungen(rahmen);
  const mitNote = zeilen.filter((z) => z.ergebnis.note !== null);

  if (!mitNote.length) {
    behaelter.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Noch keine Noten',
      text: 'In diesem Halbjahr ist für diese Klasse noch nichts erfasst.'
    }));
    return behaelter;
  }

  const verteilung = [1, 2, 3, 4, 5, 6].map((note) => ({
    note, anzahl: mitNote.filter((z) => z.ergebnis.note === note).length
  }));
  const hoechste = Math.max(...verteilung.map((v) => v.anzahl), 1);

  const schnitt = mitNote.reduce((s, z) => s + z.ergebnis.note, 0) / mitNote.length;
  const schnittProzent = mitNote.reduce((s, z) => s + z.ergebnis.prozent, 0) / mitNote.length;

  behaelter.appendChild(karte('Notenverteilung', [
    e('div', { klasse: 'verteilung' }, verteilung.map((v) => e('div', { klasse: 'verteilung-saeule' }, [
      e('div', { klasse: 'verteilung-zahl', text: v.anzahl ? String(v.anzahl) : '' }),
      e('div', {
        klasse: 'verteilung-balken note-' + v.note,
        style: `height:${Math.round((v.anzahl / hoechste) * 100)}%`,
        role: 'presentation'
      }),
      e('div', { klasse: 'verteilung-note', text: String(v.note) })
    ]))),
    e('div', { klasse: 'feldhilfe', style: 'margin-top:12px',
      text: `${mitNote.length} von ${zeilen.length} Kindern bewertet · ` +
            `Notenschnitt ${schnitt.toFixed(2)} · Punkteschnitt ${schnittProzent.toFixed(1)} %` })
  ]));

  // Kinder ohne Note ausdruecklich benennen — sonst fallen sie stillschweigend raus.
  const ohne = zeilen.filter((z) => z.ergebnis.note === null);
  if (ohne.length) {
    behaelter.appendChild(karte('Noch ohne Werte', [
      e('div', { klasse: 'feldhilfe',
        text: ohne.map((z) => {
          const t = namensteile(z.kind.kuerzel, rahmen.verbergen);
          return t.istKuerzel ? z.kind.kuerzel : `${t.vorname} ${t.nachname}`;
        }).join(', ') })
    ]));
  }

  return behaelter;
}
