/**
 * ansichten/zuordnungAnsicht.js — Zuordnungs-Editor.
 *
 * DATENSCHUTZ: Hier stehen Klarnamen im Klartext auf dem Bildschirm. Sie
 * verlassen den Browser nie. Zum Server geht ausschliesslich der
 * Zeitstempel (Meta.zuordnung_version), damit die anderen Geraete merken,
 * dass ihre Kopie veraltet ist.
 */

import { e, karte, hinweis, ladeanzeige, zeitpunktDeutsch, biete, waehleDatei, setzeMeldung } from '../ui.js';
import * as zuordnung from '../zuordnung.js';
import { sende, ladeDaten } from '../server.js';
import { setzeVerlassenPruefung } from '../router.js';

export function zeichneZuordnung(ziel, { daten, neuZeichnen }) {
  let offeneAenderungen = false;
  const stand = e('div', {});

  setzeVerlassenPruefung(() => offeneAenderungen
    ? 'Es gibt ungespeicherte Änderungen an der Zuordnungsliste. Wirklich verlassen?'
    : null);

  function markiereGeaendert() {
    if (offeneAenderungen) return;
    offeneAenderungen = true;
    zeigeStand(stand, hinweis({ art: 'warn', zeichen: '!', text: 'Ungespeicherte Änderungen.' }));
  }

  ziel.appendChild(e('h1', { text: 'Zuordnungsliste', style: 'margin-bottom:4px' }));
  ziel.appendChild(e('div', { klasse: 'feldhilfe', style: 'margin-bottom:24px', text:
    'Die Übersetzung Kürzel → Name. Sie liegt ausschließlich auf diesem Gerät und wird ' +
    'niemals in die Tabelle geschrieben.' }));

  // --- Dateiwege ----------------------------------------------------------
  ziel.appendChild(karte(null, [
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('button', {
        klasse: 'wichtig', text: 'Zuordnungsdatei laden',
        auf: { click: async () => {
          const datei = await waehleDatei();
          if (!datei) return;
          const ergebnis = zuordnung.leseCsv(datei.text);
          if (!ergebnis.gelesen) {
            zeigeStand(stand, hinweis({ art: 'schlecht', zeichen: '×', titel: 'Nichts übernommen',
              text: ergebnis.fehler.join('\n') || 'Die Datei enthielt keine verwertbaren Zeilen.' }));
            return;
          }
          zuordnung.uebernimm(ergebnis.eintraege, ergebnis.version);
          offeneAenderungen = false;
          const meldung = `${ergebnis.gelesen} Einträge übernommen.` +
            (ergebnis.fehler.length ? `\n${ergebnis.fehler.length} Zeile(n) übersprungen:\n` +
              ergebnis.fehler.slice(0, 5).join('\n') : '');
          setzeMeldung(hinweis({
            art: ergebnis.fehler.length ? 'warn' : 'gut',
            zeichen: ergebnis.fehler.length ? '!' : '✓',
            titel: 'Geladen', text: meldung
          }));
          neuZeichnen();
        } }
      }),
      e('button', {
        text: 'Als Datei sichern',
        auf: { click: () => {
          if (!zuordnung.istGeladen()) {
            zeigeStand(stand, hinweis({ art: 'warn', zeichen: '!', text: 'Es ist noch keine Zuordnung vorhanden.' }));
            return;
          }
          biete('zuordnung.csv', zuordnung.schreibeCsv());
          zeigeStand(stand, hinweis({ art: 'gut', zeichen: '✓', text:
            'Datei erzeugt. Bitte sicher aufbewahren — sie ist der einzige Weg zurück von Kürzeln zu Namen.' }));
        } }
      }),
      zuordnung.istGeladen() ? e('button', {
        klasse: 'gefahr schub', text: 'Zuordnung auf diesem Gerät löschen',
        auf: { click: () => {
          if (!window.confirm('Die Zuordnung wird von diesem Gerät entfernt. Ohne gesicherte Datei ' +
                              'sind die Namen dann nicht wiederherstellbar. Fortfahren?')) return;
          zuordnung.verwirf();
          offeneAenderungen = false;
          neuZeichnen();
        } }
      }) : null
    ]),
    e('div', { klasse: 'feldhilfe', style: 'margin-top:12px', text: zuordnung.istGeladen()
      ? `${zuordnung.anzahl()} Einträge · Stand ${zeitpunktDeutsch(zuordnung.version())}`
      : 'Noch keine Zuordnung geladen.' }),
    stand
  ]));

  if (!daten) {
    ziel.appendChild(hinweis({ art: 'warn', zeichen: '!', titel: 'Keine Verbindung zur Tabelle',
      text: 'Die Kürzel kommen aus dem Blatt „Schueler". Ohne Verbindung lässt sich die Liste nicht aufbauen.' }));
    return;
  }

  // --- Editor je Klasse ---------------------------------------------------
  daten.klassen.forEach((k) => {
    const kinder = zuordnung.sortiereNachListe(daten.schueler.filter((s) => s.klasse === k.klasse));
    const aktive = kinder.filter((s) => s.aktiv);
    const inaktive = kinder.filter((s) => !s.aktiv);

    const inhalt = [];

    // Klassenlehrkraft — bleibt ebenfalls lokal.
    const lk = zuordnung.eintrag('KLASSE-' + k.klasse) || { nachname: '', vorname: '' };
    inhalt.push(e('div', { klasse: 'leiste', style: 'align-items:flex-end' }, [
      e('div', { style: 'flex:1;min-width:140px' }, [
        e('label', { text: 'Klassenlehrkraft — Nachname' }),
        e('input', {
          type: 'text', value: lk.nachname, autocomplete: 'off',
          auf: { input: (ev) => { zuordnung.setzeEintrag('KLASSE-' + k.klasse, { nachname: ev.target.value }); markiereGeaendert(); } }
        })
      ]),
      e('div', { style: 'flex:1;min-width:140px' }, [
        e('label', { text: 'Vorname' }),
        e('input', {
          type: 'text', value: lk.vorname, autocomplete: 'off',
          auf: { input: (ev) => { zuordnung.setzeEintrag('KLASSE-' + k.klasse, { vorname: ev.target.value }); markiereGeaendert(); } }
        })
      ])
    ]));

    if (aktive.length) inhalt.push(tabelle(aktive, markiereGeaendert, false));
    if (inaktive.length) {
      inhalt.push(e('div', { klasse: 'abschnitt-titel', text: 'Abgemeldet' }));
      inhalt.push(tabelle(inaktive, markiereGeaendert, true));
    }
    if (!kinder.length) {
      inhalt.push(e('div', { klasse: 'leer', text: 'Für diese Klasse stehen noch keine Kürzel in der Tabelle.' }));
    }

    ziel.appendChild(karte(k.bezeichnung, inhalt));
  });

  // --- Speichern ----------------------------------------------------------
  const speicherStand = e('div', {});
  ziel.appendChild(karte(null, [
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('button', {
        klasse: 'wichtig', text: 'Speichern',
        auf: { click: async () => {
          const version = zuordnung.sichere();
          offeneAenderungen = false;
          zeigeStand(speicherStand, ladeanzeige('Zeitstempel wird hinterlegt …'));
          // Der Zeitstempel geht in die Tabelle, damit die anderen Geraete
          // merken, dass ihre Kopie veraltet ist. Nur der Zeitstempel.
          try {
            await sende('meta', { werte: { zuordnung_version: version } });
            await ladeDaten({ neu: true });
            setzeMeldung(hinweis({ art: 'gut', zeichen: '✓', titel: 'Gespeichert',
              text: `Lokal gesichert und als Stand ${zeitpunktDeutsch(version)} in der Tabelle vermerkt.` }));
          } catch (fehler) {
            setzeMeldung(hinweis({ art: 'warn', zeichen: '!', titel: 'Lokal gespeichert',
              text: 'Der Zeitstempel konnte nicht in die Tabelle geschrieben werden: ' + fehler.message +
                    '\nDie Namen sind auf diesem Gerät trotzdem gesichert.' }));
          }
          neuZeichnen();
        } }
      }),
      e('div', { klasse: 'feldhilfe', text: 'Änderungen wirken sofort; „Speichern" macht sie dauerhaft.' })
    ]),
    speicherStand
  ]));
}

function tabelle(kinder, markiereGeaendert, inaktiv) {
  const koerper = e('tbody', {}, kinder.map((s) => {
    const eintrag = zuordnung.eintrag(s.kuerzel) || { nachname: '', vorname: '', geschlecht: '' };
    return e('tr', { klasse: inaktiv ? 'inaktiv' : '' }, [
      e('td', { klasse: 'nummer', text: s.listennummer || '–' }),
      e('td', { klasse: 'kuerzel', text: s.kuerzel }),
      e('td', {}, [e('input', {
        type: 'text', value: eintrag.nachname, 'aria-label': 'Nachname zu ' + s.kuerzel,
        autocomplete: 'off',
        auf: { input: (ev) => { zuordnung.setzeEintrag(s.kuerzel, { nachname: ev.target.value }); markiereGeaendert(); } }
      })]),
      e('td', {}, [e('input', {
        type: 'text', value: eintrag.vorname, 'aria-label': 'Vorname zu ' + s.kuerzel,
        autocomplete: 'off',
        auf: { input: (ev) => { zuordnung.setzeEintrag(s.kuerzel, { vorname: ev.target.value }); markiereGeaendert(); } }
      })]),
      e('td', { style: 'width:80px' }, [e('input', {
        type: 'text', value: eintrag.geschlecht, maxlength: 4, 'aria-label': 'Geschlecht zu ' + s.kuerzel,
        autocomplete: 'off',
        auf: { input: (ev) => { zuordnung.setzeEintrag(s.kuerzel, { geschlecht: ev.target.value }); markiereGeaendert(); } }
      })])
    ]);
  }));

  return e('div', { klasse: 'tabellenrahmen', style: 'max-height:none' }, [
    e('table', { klasse: 'liste' }, [
      e('thead', {}, [e('tr', {}, [
        e('th', { text: 'Nr.' }), e('th', { text: 'Kürzel' }),
        e('th', { text: 'Nachname' }), e('th', { text: 'Vorname' }), e('th', { text: 'Geschl.' })
      ])]),
      koerper
    ])
  ]);
}

function zeigeStand(behaelter, inhalt) {
  behaelter.textContent = '';
  behaelter.style.marginTop = '16px';
  behaelter.appendChild(inhalt);
}
