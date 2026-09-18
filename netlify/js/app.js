/**
 * app.js — Zusammenbau: Kopfleiste, Navigation, Startbanner.
 */

import { e, leere, ladeanzeige, hinweis, holeMeldung } from './ui.js';
import { lies, schreib, istVerfuegbar } from './speicher.js';
import { registriere, starte, gehe, pfadEintraege, zeichneErneut } from './router.js';
import { istEingerichtet, ladeDaten, ladeRest, istVollstaendig, holeDaten } from './server.js';
import * as zuordnung from './zuordnung.js';
import { zeichneStart, raeumeStartAuf } from './ansichten/start.js';
import { zeichneKlasse } from './ansichten/klasse.js';
import { zeichneChecklisten } from './ansichten/checklisten.js';
import { zeichneNoten } from './ansichten/noten.js';
import { zeichneEinheiten } from './ansichten/einheiten.js';
import { zeichneEinstellungen } from './ansichten/einstellungen.js';
import { zeichneZuordnung } from './ansichten/zuordnungAnsicht.js';

const inhalt = document.getElementById('inhalt');
const kopf = document.getElementById('kopf');

/** Klarnamen ausblenden — pro Geraet dauerhaft (Beamer-Betrieb). */
let verbergen = lies('verbergen', false);
/** Einmal geschlossene Startbanner nicht erneut zeigen. */
const geschlossen = new Set(lies('bannerGeschlossen', []));

let ladeFehler = null;

function neuZeichnen() {
  zeichneAlles();
}

// --- Kopfleiste ------------------------------------------------------------

function zeichneKopf() {
  const daten = holeDaten();
  leere(kopf);

  const pfad = e('nav', { klasse: 'pfad', 'aria-label': 'Pfad' });
  pfadEintraege(daten).forEach((eintrag, i, alle) => {
    if (i > 0) pfad.appendChild(e('span', { klasse: 'trenner', 'aria-hidden': 'true', text: '›' }));
    pfad.appendChild(eintrag.ziel && i < alle.length - 1
      ? e('a', { href: '#' + eintrag.ziel, text: eintrag.text })
      : e('span', { text: eintrag.text, 'aria-current': 'page' }));
  });

  const schalter = e('label', { klasse: 'schalter', title: 'Für die Projektion über den Beamer' }, [
    e('input', {
      type: 'checkbox', checked: verbergen,
      auf: { change: (ev) => {
        verbergen = ev.target.checked;
        schreib('verbergen', verbergen);
        zeichneAlles();
      } }
    }),
    e('span', { text: 'Namen verbergen' })
  ]);

  kopf.appendChild(e('div', { klasse: 'kopfleiste-inhalt' }, [
    pfad,
    schalter,
    e('a', { klasse: 'knopf klein', href: '#/einheiten', text: 'Einheiten' }),
    e('a', { klasse: 'knopf klein', href: '#/noten', text: 'Noten' }),
    e('a', { klasse: 'knopf klein', href: '#/checklisten', text: 'Checklisten' }),
    e('a', { klasse: 'knopf klein', href: '#/einstellungen', text: 'Einstellungen' })
  ]));
}

// --- Startbanner -----------------------------------------------------------

function banner() {
  const daten = holeDaten();
  const teile = [];

  // Kurzmeldung aus der letzten Aktion, falls vorhanden.
  const m = holeMeldung();
  if (m) teile.push(m);

  if (!istVerfuegbar()) {
    teile.push(hinweis({
      art: 'warn', zeichen: '!', titel: 'Kein dauerhafter Speicher',
      text: 'Dieser Browser erlaubt kein dauerhaftes Speichern — möglicherweise ein privates Fenster. ' +
            'Die Zuordnung gilt nur für diese Sitzung.'
    }));
  }

  if (!istEingerichtet()) {
    teile.push(hinweis({
      art: 'warn', zeichen: '→', titel: 'Verbindung einrichten',
      text: 'Adresse der Tabellen-Schnittstelle und Zugangsschlüssel fehlen noch.',
      knoepfe: [e('button', { klasse: 'wichtig', text: 'Zu den Einstellungen',
                              auf: { click: () => gehe('/einstellungen') } })]
    }));
    return teile;
  }

  if (ladeFehler) {
    teile.push(hinweis({
      art: 'schlecht', zeichen: '!', titel: 'Daten konnten nicht geladen werden',
      text: ladeFehler,
      beimSchliessen: () => { ladeFehler = null; },
      knoepfe: [
        e('button', { text: 'Erneut versuchen', auf: { click: () => {
          ladeFehler = null;
          // Auch die Ansicht neu aufbauen: scheiterte die zweite Runde,
          // steht hier gerade gar keine.
          lade().then(zeichneErneut);
        } } }),
        e('button', { klasse: 'leise', text: 'Einstellungen', auf: { click: () => gehe('/einstellungen') } })
      ]
    }));
    return teile;
  }

  if (!daten) return teile;

  // Warnungen aus der Konfigurationspruefung des Servers.
  if (daten.warnungen && daten.warnungen.length && !geschlossen.has('konfig')) {
    teile.push(schliessbar('konfig', {
      art: 'warn', zeichen: '!', titel: 'Hinweise zur Konfiguration',
      text: daten.warnungen.join('\n')
    }));
  }

  // Erstlauf: noch keine Zuordnung auf diesem Geraet.
  if (!zuordnung.istGeladen() && !geschlossen.has('erstlauf')) {
    teile.push(schliessbar('erstlauf', {
      art: 'warn', zeichen: '→', titel: 'Zuordnungsdatei laden',
      text: 'Auf diesem Gerät ist noch keine Zuordnung geladen. Die App ist voll bedienbar — ' +
            'es erscheinen überall Kürzel statt Namen.',
      knoepfe: [e('button', { klasse: 'wichtig', text: 'Zuordnungsliste öffnen',
                              auf: { click: () => gehe('/zuordnung') } })]
    }));
  } else if (zuordnung.istGeladen()) {
    // Abgleich der Kuerzelmengen — laeuft ausschliesslich ueber Kuerzel.
    const a = zuordnung.gleicheAb(daten.schueler.filter((s) => s.aktiv), daten.meta.zuordnung_version);
    if (!a.inOrdnung && !geschlossen.has('abgleich')) {
      const zeilen = [];
      if (a.fehlend.length) zeilen.push(`${a.fehlend.length} Kürzel ohne Zuordnung: ${a.fehlend.slice(0, 8).join(', ')}${a.fehlend.length > 8 ? ' …' : ''}`);
      if (a.ueberzaehlig.length) zeilen.push(`${a.ueberzaehlig.length} überzähliger Eintrag: ${a.ueberzaehlig.slice(0, 8).join(', ')}${a.ueberzaehlig.length > 8 ? ' …' : ''}`);
      if (a.veraltet) zeilen.push('Ein anderes Gerät hat die Zuordnung später gespeichert als dieses.');
      teile.push(schliessbar('abgleich', {
        art: 'warn', zeichen: '!', titel: 'Zuordnung weicht ab', text: zeilen.join('\n'),
        knoepfe: [e('button', { text: 'Zuordnungsliste öffnen', auf: { click: () => gehe('/zuordnung') } })]
      }));
    }
  }

  return teile;
}

/**
 * Ein Banner, das sich wegklicken laesst und dann weggeklickt bleibt.
 *
 * Das Schliessen zeichnet die Seite nicht neu: hinweis() nimmt das Feld
 * selbst heraus. Ein Neuzeichnen waere hier auch schaedlich — es setzte
 * mitten im Blaettern die Startseite zurueck.
 */
function schliessbar(kennung, optionen) {
  return hinweis({
    ...optionen,
    beimSchliessen: () => {
      geschlossen.add(kennung);
      schreib('bannerGeschlossen', [...geschlossen]);
    }
  });
}

// --- Zeichnen --------------------------------------------------------------

let aktuelleAnsicht = null;

function zeichneAlles() {
  // Der Minutentakt der Uhr wuerde sonst auf abgeloesten Knoten weiterlaufen.
  raeumeStartAuf();
  zeichneKopf();
  leere(inhalt);
  banner().forEach((b) => inhalt.appendChild(b));
  if (aktuelleAnsicht) aktuelleAnsicht();
}

/**
 * Zaehlt die Aufrufe, damit eine Ansicht, die auf Daten wartet, nicht
 * nachtraeglich eine laengst verlassene Seite zeichnet.
 */
let ansichtZaehler = 0;

/**
 * `rest: true` fuer Ansichten, die die grossen Tabellen brauchen (Noten,
 * Checklisten). Sie warten, falls die Hintergrundrunde noch laeuft —
 * meist ist sie laengst durch, dann kostet das nichts.
 */
function ansicht(zeichner, { rest = false } = {}) {
  return async (werte) => {
    const meine = ++ansichtZaehler;

    if (rest && istEingerichtet() && !ladeFehler && !istVollstaendig()) {
      aktuelleAnsicht = () => inhalt.appendChild(ladeanzeige('Daten werden geladen …'));
      zeichneAlles();
      try {
        await ladeRest();
      } catch (fehler) {
        if (meine !== ansichtZaehler) return;
        // Die Ladeanzeige stehen zu lassen waere falsch, den Zeichner
        // aufzurufen unmoeglich — ihm fehlten genau die Daten. Also nur
        // das Banner mit dem Fehler.
        ladeFehler = fehler.message;
        aktuelleAnsicht = null;
        zeichneAlles();
        return;
      }
      if (meine !== ansichtZaehler) return;
    }

    // holeDaten() wird bei jedem Zeichnen neu gelesen, nicht hier gebunden —
    // sonst zeigte die Ansicht nach einem Neuladen noch den alten Stand.
    aktuelleAnsicht = () => zeichner(inhalt, {
      daten: holeDaten(), verbergen, neuZeichnen, ...werte
    });
    zeichneAlles();
  };
}

// --- Laden -----------------------------------------------------------------

async function lade() {
  if (!istEingerichtet()) { zeichneAlles(); return; }
  leere(inhalt);
  inhalt.appendChild(ladeanzeige());
  try {
    await ladeDaten();
    ladeFehler = null;
  } catch (fehler) {
    ladeFehler = fehler.message;
  }
  zeichneAlles();
}

// --- Routen ---------------------------------------------------------------

registriere('/', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneStart(ziel, k);
}));

registriere('/klasse/:klasse', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneKlasse(ziel, { ...k, werkzeug: null });
}));

registriere('/klasse/:klasse/:werkzeug', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneKlasse(ziel, k);
}));

registriere('/checklisten', ansicht((ziel, k) => {
  if (!k.daten) return;
  if (!k.daten.klassen.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Keine Klasse eingetragen',
      text: 'Im Blatt „Klassen" ist noch keine aktive Klasse eingetragen.'
    }));
    return;
  }
  // Anlegen und Spalten befuellen sollen ohne Umweg über eine Klassenwahl
  // möglich sein — #/checklisten leitet deshalb direkt in die erste Klasse.
  gehe('/checklisten/' + encodeURIComponent(k.daten.klassen[0].klasse), { ersetzen: true });
}));

registriere('/checklisten/:klasse', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneChecklisten(ziel, k);
}, { rest: true }));

registriere('/noten', ansicht((ziel, k) => {
  if (!k.daten) return;
  if (!k.daten.klassen.length) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '→', titel: 'Keine Klasse eingetragen',
      text: 'Im Blatt „Klassen" ist noch keine aktive Klasse eingetragen.'
    }));
    return;
  }
  gehe('/noten/' + encodeURIComponent(k.daten.klassen[0].klasse), { ersetzen: true });
}));

registriere('/noten/:klasse', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneNoten(ziel, k);
}, { rest: true }));

registriere('/einheiten', ansicht((ziel, k) => {
  if (!k.daten) return;
  zeichneEinheiten(ziel, k);
}));

registriere('/einstellungen', ansicht(zeichneEinstellungen));
registriere('/zuordnung', ansicht(zeichneZuordnung));

// --- Start ---------------------------------------------------------------

lade().then(() => starte());
