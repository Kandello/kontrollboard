/**
 * Noten.gs — Notentracker: Erhebungen und Testthemen.
 *
 * Eigenes Modul, getrennt von Boards.gs und der allgemeinen Tabellenlogik,
 * damit an den Noten geaendert werden kann, ohne die anderen Werkzeuge zu
 * beruehren. Enthaelt ausschliesslich Kuerzel, niemals Namen.
 *
 * Gerechnet wird NICHT hier, sondern im Client (netlify/js/noten.js), der
 * gegen die bisherige Tabelle geprueft ist. Der Server speichert nur die
 * Rohwerte — so gibt es genau eine Stelle, an der die Notenformel steht.
 */

/** Prozentwerte ausserhalb dieser Grenzen sind ein Tippfehler, kein Messwert. */
var WERT_MIN = 0;
var WERT_MAX = 100;

/**
 * Setzt das Thema eines Tests. Gilt klassenuebergreifend — die
 * Parallelklassen schreiben denselben Test zum selben Thema. Ein leeres
 * Thema entfernt den Eintrag wieder.
 */
function testThemaSetzen(schuljahr, halbjahr, nummer, thema) {
  schuljahr = Number(schuljahr);
  halbjahr = Number(halbjahr);
  nummer = Number(nummer);
  thema = String(thema || '').trim();

  if (!schuljahr) throw new Error('Kein Schuljahr angegeben.');
  if (halbjahr !== 1 && halbjahr !== 2) throw new Error('Halbjahr muss 1 oder 2 sein.');
  if (!nummer || nummer < 1) throw new Error('Keine Testnummer angegeben.');

  return mitSperre_(function () {
    if (!thema) {
      var entfernt = loescheNachSchluessel_('Tests',
        ['fach', 'schuljahr', 'halbjahr', 'nummer'], [[FACH, schuljahr, halbjahr, nummer]]);
      return { entfernt: entfernt };
    }
    schreibeNachSchluessel_('Tests', [{
      fach: FACH, schuljahr: schuljahr, halbjahr: halbjahr, nummer: nummer, thema: thema
    }], ['fach', 'schuljahr', 'halbjahr', 'nummer']);
    return { schuljahr: schuljahr, halbjahr: halbjahr, nummer: nummer, thema: thema };
  });
}

/**
 * Gebuendeltes Schreiben von Erhebungen — der Client sammelt Eingaben und
 * schickt sie in einem Rutsch, wie bei den Checklisten. `wert: ''` loescht
 * den Eintrag (das Kind hat an dem Termin keinen Wert, nicht null Prozent).
 *
 * Schluessel ist Fach + Kuerzel + Kategorie + Anlass: je Kind gibt es zu
 * einem Anlass genau einen Wert je Kategorie.
 */
function erhebungenSpeichern(aenderungen) {
  if (!aenderungen || !aenderungen.length) return { gespeichert: 0, geloescht: 0 };

  return mitSperre_(function () {
    // Vorhandene Zeilen einmal lesen, um bestehende IDs zu erhalten —
    // sonst bekaeme jede Aenderung eine neue ID.
    var vorhanden = {};
    liesBlatt_('Erhebungen').forEach(function (z) {
      var s = [alsText_(z.fach) || FACH, alsText_(z.kuerzel), alsText_(z.kategorie_id), alsText_(z.anlass)].join('␟');
      vorhanden[s] = alsText_(z.id);
    });

    var gueltigeKategorien = {};
    liesBlatt_('Kategorien').forEach(function (z) { gueltigeKategorien[alsText_(z.id)] = true; });

    var zuSchreiben = [];
    var zuLoeschen = [];

    aenderungen.forEach(function (a) {
      var kuerzel = String(a.kuerzel || '').trim();
      var kategorie_id = String(a.kategorie_id || '').trim();
      var anlass = String(a.anlass || '').trim();
      var datum = String(a.datum || '').trim();
      var roh = a.wert;

      if (!kuerzel || !kategorie_id || !anlass) return;

      if (!/^[0-9][A-Za-z]{1,3}-[0-9]{2}$/.test(kuerzel)) {
        throw new Error('Ungültiges Kürzel: ' + kuerzel);
      }
      if (!gueltigeKategorien[kategorie_id]) {
        throw new Error('Unbekannte Kategorie: ' + kategorie_id);
      }

      var schluessel = [FACH, kuerzel, kategorie_id, anlass];

      if (roh === '' || roh === null || roh === undefined) {
        zuLoeschen.push(schluessel);
        return;
      }

      var wert = Number(roh);
      if (isNaN(wert)) throw new Error('Kein Zahlenwert für ' + kuerzel + ': ' + roh);
      if (wert < WERT_MIN || wert > WERT_MAX) {
        throw new Error('Wert für ' + kuerzel + ' liegt außerhalb von ' +
                        WERT_MIN + ' bis ' + WERT_MAX + ': ' + wert);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
        throw new Error('Ungültiges Datum für ' + kuerzel + ': ' + datum);
      }

      var alt = vorhanden[schluessel.join('␟')];
      zuSchreiben.push({
        id: alt || Utilities.getUuid(),
        datum: datum, fach: FACH, kuerzel: kuerzel,
        kategorie_id: kategorie_id, anlass: anlass,
        wert: wert, notiz: String(a.notiz || ''), geloescht: false
      });
    });

    var gespeichert = 0, geloescht = 0;
    if (zuSchreiben.length) {
      var r = schreibeNachSchluessel_('Erhebungen', zuSchreiben,
        ['fach', 'kuerzel', 'kategorie_id', 'anlass']);
      gespeichert = r.aktualisiert + r.neu;
    }
    if (zuLoeschen.length) {
      geloescht = loescheNachSchluessel_('Erhebungen',
        ['fach', 'kuerzel', 'kategorie_id', 'anlass'], zuLoeschen);
    }
    return { gespeichert: gespeichert, geloescht: geloescht };
  });
}

/**
 * Loescht alle Erhebungen eines Anlasses fuer eine Klasse — etwa einen
 * versehentlich angelegten Test. Betrifft nur die genannte Klasse; die
 * Parallelklassen behalten ihre Werte.
 */
function erhebungenAnlassLoeschen(klasse, kategorie_id, anlass) {
  klasse = String(klasse || '').trim();
  kategorie_id = String(kategorie_id || '').trim();
  anlass = String(anlass || '').trim();
  if (!klasse) throw new Error('Keine Klasse angegeben.');
  if (!kategorie_id || !anlass) throw new Error('Kein Anlass angegeben.');

  return mitSperre_(function () {
    var kuerzelDerKlasse = {};
    liesBlatt_('Schueler').forEach(function (s) {
      if (alsText_(s.klasse) === klasse) kuerzelDerKlasse[alsText_(s.kuerzel)] = true;
    });

    var treffer = liesBlatt_('Erhebungen').filter(function (z) {
      return alsText_(z.kategorie_id) === kategorie_id &&
             alsText_(z.anlass) === anlass &&
             kuerzelDerKlasse[alsText_(z.kuerzel)];
    });

    var entfernt = loescheNachSchluessel_('Erhebungen',
      ['fach', 'kuerzel', 'kategorie_id', 'anlass'],
      treffer.map(function (z) {
        return [alsText_(z.fach) || FACH, alsText_(z.kuerzel), alsText_(z.kategorie_id), alsText_(z.anlass)];
      }));
    return { entfernt: entfernt };
  });
}

/** Die beiden Beteiligungsarten — muendlich, und schriftlich (Praesentation ist darin aufgegangen). */
var BETEILIGUNG_ARTEN = ['MUND', 'SCHR'];

/**
 * Gebuendeltes Schreiben woechentlicher Beteiligungspunkte (1-10). Anders
 * als bei Erhebungen ist hier keine eigene id notwendig — Fach, Kuerzel,
 * Art und Kalenderwoche identifizieren die Zeile eindeutig. `punkte: ''`
 * loescht den Eintrag (nicht beobachtet, nicht 0 Punkte).
 *
 * Die Umrechnung in eine monatliche Prozentzahl passiert ausschliesslich
 * im Client (netlify/js/noten.js) — hier liegen nur die Rohpunkte.
 */
function beteiligungspunkteSpeichern(aenderungen) {
  if (!aenderungen || !aenderungen.length) return { gespeichert: 0, geloescht: 0 };

  return mitSperre_(function () {
    var zuSchreiben = [];
    var zuLoeschen = [];

    aenderungen.forEach(function (a) {
      var kuerzel = String(a.kuerzel || '').trim();
      var art = String(a.art || '').trim();
      var kw = String(a.kw || '').trim();
      var roh = a.punkte;

      if (!kuerzel || !art || !kw) return;

      if (!/^[0-9][A-Za-z]{1,3}-[0-9]{2}$/.test(kuerzel)) {
        throw new Error('Ungültiges Kürzel: ' + kuerzel);
      }
      if (BETEILIGUNG_ARTEN.indexOf(art) === -1) {
        throw new Error('Unbekannte Beteiligungsart: ' + art);
      }
      if (!/^\d{4}-W\d{2}$/.test(kw)) {
        throw new Error('Ungültige Kalenderwoche: ' + kw);
      }

      var schluessel = [FACH, kuerzel, art, kw];

      if (roh === '' || roh === null || roh === undefined) {
        zuLoeschen.push(schluessel);
        return;
      }

      var punkte = Number(roh);
      if (!Number.isInteger(punkte) || punkte < 1 || punkte > 10) {
        throw new Error('Punkte für ' + kuerzel + ' müssen zwischen 1 und 10 liegen: ' + roh);
      }

      zuSchreiben.push({ fach: FACH, kuerzel: kuerzel, art: art, kw: kw, punkte: punkte });
    });

    var gespeichert = 0, geloescht = 0;
    if (zuSchreiben.length) {
      var r = schreibeNachSchluessel_('Beteiligungspunkte', zuSchreiben, ['fach', 'kuerzel', 'art', 'kw']);
      gespeichert = r.aktualisiert + r.neu;
    }
    if (zuLoeschen.length) {
      geloescht = loescheNachSchluessel_('Beteiligungspunkte', ['fach', 'kuerzel', 'art', 'kw'], zuLoeschen);
    }
    return { gespeichert: gespeichert, geloescht: geloescht };
  });
}
