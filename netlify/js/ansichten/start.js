/**
 * ansichten/start.js — Ebene 1.
 *
 * Stand Schritt 2: Geruest mit den Klassenknoepfen. Uhr, Tagesplan,
 * Kacheln und das Einheiten-Widget folgen in Schritt 3; die Plaetze sind
 * bereits vorgesehen, damit die Anordnung sichtbar ist.
 */

import { e, karte } from '../ui.js';
import { klassenlehrkraft } from '../zuordnung.js';

export function zeichneStart(ziel, { daten, verbergen }) {
  const stueck = document.createDocumentFragment();

  stueck.appendChild(e('h1', { text: 'Kommandozentrale Deutsch', style: 'margin-bottom:4px' }));
  stueck.appendChild(e('div', {
    klasse: 'feldhilfe',
    style: 'margin-bottom:24px',
    text: 'Tagesüberblick, Leistungstracker, Kontrollboards und Unterrichtseinheiten.'
  }));

  // Platzhalter fuer Schritt 3, damit die Anordnung erkennbar bleibt.
  stueck.appendChild(karte(null, [
    e('div', { klasse: 'leer', style: 'padding:24px 16px' }, [
      e('div', { text: 'Uhr, Tagesplan und die Kacheln für PEAK und Weekly Note folgen im nächsten Schritt.' })
    ])
  ]));

  stueck.appendChild(e('div', { klasse: 'abschnitt-titel', text: 'Klassen' }));

  const raster = e('div', { klasse: 'klassenraster' });

  if (!daten.klassen.length) {
    raster.appendChild(e('div', { klasse: 'leer', text: 'Im Blatt „Klassen" ist noch keine aktive Klasse eingetragen.' }));
  }

  daten.klassen.forEach((k) => {
    const anzahl = daten.schueler.filter((s) => s.klasse === k.klasse && s.aktiv).length;
    const lehrkraft = verbergen ? null : klassenlehrkraft(k.klasse);

    raster.appendChild(e('a', {
      klasse: 'klassenknopf',
      href: '#/klasse/' + encodeURIComponent(k.klasse),
      'aria-label': 'Klasse ' + k.bezeichnung + ' öffnen'
    }, [
      e('span', { klasse: 'name', text: k.bezeichnung }),
      e('span', { klasse: 'zusatz', text: anzahl + (anzahl === 1 ? ' Kind' : ' Kinder') +
                                          (lehrkraft ? ' · ' + lehrkraft : '') }),
      // Textloser Fortschrittsbalken; Wert folgt mit den Einheiten (Schritt 9).
      e('div', { klasse: 'balken', role: 'presentation' }, [e('i', { style: 'width:0%' })])
    ]));
  });

  stueck.appendChild(raster);
  ziel.appendChild(stueck);
}
