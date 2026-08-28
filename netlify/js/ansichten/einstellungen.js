/**
 * ansichten/einstellungen.js — Verbindung zur Tabelle und Meta-Werte.
 *
 * Adresse und Zugangsschluessel liegen im lokalen Speicher des Geraets,
 * nicht im Code. Damit bleibt die Weitergabe an Kolleg:innen eine reine
 * Kopie: eigene Tabelle, eigene Adresse, eigener Schluessel.
 */

import { e, karte, feld, hinweis, ladeanzeige, zeitpunktDeutsch, setzeMeldung } from '../ui.js';
import { holeVerbindung, setzeVerbindung, frage, sende, ladeDaten, leereDaten } from '../server.js';
import * as zuordnung from '../zuordnung.js';

export function zeichneEinstellungen(ziel, { daten, neuZeichnen }) {
  const v = holeVerbindung();

  ziel.appendChild(e('h1', { text: 'Einstellungen', style: 'margin-bottom:24px' }));

  // --- Verbindung ---------------------------------------------------------
  const urlFeld = feld({
    id: 'e-url', beschriftung: 'Adresse der Tabellen-Schnittstelle', wert: v.url, typ: 'url',
    platzhalter: 'https://script.google.com/macros/s/…/exec',
    hilfe: 'Die Web-App-Adresse aus dem Apps-Script-Editor. Endet auf /exec.'
  });
  const tokenFeld = feld({
    id: 'e-token', beschriftung: 'Zugangsschlüssel', wert: v.token,
    hilfe: 'In der Tabelle über „Kommandozentrale → Zugangsschlüssel anzeigen".'
  });
  const stand = e('div', {});

  ziel.appendChild(karte('Verbindung zur Tabelle', [
    urlFeld, tokenFeld,
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('button', {
        klasse: 'wichtig', text: 'Speichern und prüfen',
        auf: { click: async () => {
          const url = urlFeld.querySelector('input').value.trim();
          const token = tokenFeld.querySelector('input').value.trim();
          if (!url || !token) {
            zeigeStand(stand, hinweis({ art: 'warn', zeichen: '!', text: 'Bitte Adresse und Zugangsschlüssel eintragen.' }));
            return;
          }
          setzeVerbindung(url, token);
          leereDaten();
          zeigeStand(stand, ladeanzeige('Verbindung wird geprüft …'));
          try {
            await frage('ping');
            const frisch = await ladeDaten({ neu: true });
            setzeMeldung(hinweis({
              art: 'gut', zeichen: '✓', titel: 'Verbindung steht',
              text: `${frisch.schueler.length} Kürzel, ${frisch.klassen.length} Klassen, ` +
                    `${frisch.stundenplan.length} Stundenplanzeilen gelesen.`
            }));
            neuZeichnen();
          } catch (fehler) {
            zeigeStand(stand, hinweis({ art: 'schlecht', zeichen: '×', titel: 'Verbindung fehlgeschlagen', text: fehler.message }));
          }
        } }
      }),
      e('button', {
        text: 'Daten neu laden',
        auf: { click: async () => {
          zeigeStand(stand, ladeanzeige('Daten werden neu geladen …'));
          try {
            const frisch = await ladeDaten({ neu: true });
            setzeMeldung(hinweis({ art: 'gut', zeichen: '✓',
              text: `Stand ${zeitpunktDeutsch(frisch.stand)} · ${frisch.schueler.length} Kürzel.` }));
            neuZeichnen();
          } catch (fehler) {
            zeigeStand(stand, hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
          }
        } }
      })
    ]),
    stand
  ]));

  if (!daten) {
    ziel.appendChild(hinweis({
      art: 'warn', zeichen: '!', titel: 'Noch keine Daten',
      text: 'Sobald Adresse und Zugangsschlüssel stimmen, erscheinen hier die weiteren Einstellungen.'
    }));
    return;
  }

  // --- Links und Halbjahr -------------------------------------------------
  const weekly = feld({ id: 'e-weekly', beschriftung: 'Link „Weekly Note"', wert: daten.meta.link_weekly || '', typ: 'url' });
  const peak   = feld({ id: 'e-peak',   beschriftung: 'Link „PEAK"',        wert: daten.meta.link_peak || '',   typ: 'url' });
  const lernw  = feld({ id: 'e-lernwoerter', beschriftung: 'Link „Lernwörter"',
                        wert: daten.meta.link_lernwoerter || '', typ: 'url' });
  const grenze = feld({ id: 'e-grenze', beschriftung: 'Letzter Tag des ersten Halbjahres (MM-TT)',
                        wert: daten.meta.halbjahresgrenze || '01-31', platzhalter: '01-31' });
  const beginn = feld({ id: 'e-beginn', beschriftung: 'Schuljahresbeginn (JJJJ-MM-TT)',
                        wert: daten.meta.schuljahresbeginn || '', platzhalter: '2026-09-01' });
  const metaStand = e('div', {});

  ziel.appendChild(karte('Links und Schuljahr', [
    weekly, peak, lernw, grenze, beginn,
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('button', {
        klasse: 'wichtig', text: 'Speichern',
        auf: { click: async () => {
          zeigeStand(metaStand, ladeanzeige('Wird gespeichert …'));
          try {
            await sende('meta', { werte: {
              link_weekly: weekly.querySelector('input').value.trim(),
              link_peak: peak.querySelector('input').value.trim(),
              link_lernwoerter: lernw.querySelector('input').value.trim(),
              halbjahresgrenze: grenze.querySelector('input').value.trim(),
              schuljahresbeginn: beginn.querySelector('input').value.trim()
            } });
            await ladeDaten({ neu: true });
            setzeMeldung(hinweis({ art: 'gut', zeichen: '✓', text: 'Gespeichert.' }));
            neuZeichnen();
          } catch (fehler) {
            zeigeStand(metaStand, hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
          }
        } }
      })
    ]),
    metaStand
  ]));

  // --- Einrichtung --------------------------------------------------------
  const einrichtStand = e('div', {});
  ziel.appendChild(karte('Einrichtung der Tabelle', [
    e('div', { klasse: 'feldhilfe', style: 'margin-bottom:12px', text:
      'Beides lässt sich auch direkt in der Tabelle über das Menü „Kommandozentrale" ausführen.' }),
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('button', {
        text: 'Blätter anlegen / prüfen',
        auf: { click: async () => {
          zeigeStand(einrichtStand, ladeanzeige('Blätter werden geprüft …'));
          try {
            const a = await sende('einrichten');
            const b = a.ergebnis;
            setzeMeldung(hinweis({ art: 'gut', zeichen: '✓', titel: 'Fertig', text:
              `Angelegt: ${b.angelegt.join(', ') || '–'} · Ergänzt: ${b.ergaenzt.join(', ') || '–'} · ` +
              `Unverändert: ${b.unveraendert.length}` }));
            await ladeDaten({ neu: true });
            neuZeichnen();
          } catch (fehler) {
            zeigeStand(einrichtStand, hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
          }
        } }
      }),
      e('button', {
        text: 'Schülerliste einlesen (CSV)',
        auf: { click: async () => {
          const { waehleDatei } = await import('../ui.js');
          const datei = await waehleDatei();
          if (!datei) return;
          // Die Datei enthaelt ausschliesslich Kuerzel. Vor dem Senden pruefen.
          const verdacht = pruefeAufNamen(datei.text);
          if (verdacht) {
            zeigeStand(einrichtStand, hinweis({ art: 'schlecht', zeichen: '×',
              titel: 'Nicht gesendet', text: verdacht }));
            return;
          }
          zeigeStand(einrichtStand, ladeanzeige('Wird eingelesen …'));
          try {
            const a = await sende('schuelerImport', { csv: datei.text });
            setzeMeldung(hinweis({ art: 'gut', zeichen: '✓', titel: 'Import erfolgreich',
              text: `${a.ergebnis.neu} neu, ${a.ergebnis.aktualisiert} aktualisiert.` }));
            await ladeDaten({ neu: true });
            neuZeichnen();
          } catch (fehler) {
            zeigeStand(einrichtStand, hinweis({ art: 'schlecht', zeichen: '×', text: fehler.message }));
          }
        } }
      })
    ]),
    einrichtStand
  ]));

  // --- Zuordnung ----------------------------------------------------------
  ziel.appendChild(karte('Zuordnungsliste', [
    e('div', { klasse: 'feldhilfe', style: 'margin-bottom:12px', text: zuordnung.istGeladen()
      ? `${zuordnung.anzahl()} Einträge auf diesem Gerät, Stand ${zeitpunktDeutsch(zuordnung.version())}.`
      : 'Auf diesem Gerät ist noch keine Zuordnung geladen. Es erscheinen überall Kürzel.' }),
    e('div', { klasse: 'leiste', style: 'margin-bottom:0' }, [
      e('a', { klasse: 'knopf', href: '#/zuordnung', text: 'Zuordnungsliste bearbeiten' })
    ])
  ]));
}

/**
 * Grobe Abwehr gegen eine versehentlich namenhaltige Importdatei. Prueft
 * clientseitig, ob die Schluesselspalte durchgaengig dem Kuerzelmuster
 * entspricht — der Server prueft es ebenfalls, aber dann waere die Datei
 * schon uebertragen.
 */
function pruefeAufNamen(csvText) {
  const zeilen = String(csvText).replace(/^﻿/, '').split(/\r\n|\r|\n/).filter((z) => z.trim());
  if (!zeilen.length) return 'Die Datei ist leer.';
  const muster = /^[0-9][A-Za-z]{1,3}-[0-9]{2}$/;
  const schlecht = [];
  zeilen.slice(1).forEach((zeile, i) => {
    const erstes = zeile.split(zeile.includes(';') ? ';' : ',')[0].trim();
    if (erstes && !muster.test(erstes)) schlecht.push(`Zeile ${i + 2}: „${erstes}"`);
  });
  if (!schlecht.length) return null;
  return 'Die erste Spalte enthält Werte, die keine Kürzel sind. Die Datei wurde NICHT gesendet.\n' +
         schlecht.slice(0, 5).join('\n') + (schlecht.length > 5 ? `\n… und ${schlecht.length - 5} weitere.` : '');
}

function zeigeStand(behaelter, inhalt) {
  behaelter.textContent = '';
  behaelter.style.marginTop = '16px';
  behaelter.appendChild(inhalt);
}
