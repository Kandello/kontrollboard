/**
 * Code.gs — Datenschnittstelle fuer die Weboberflaeche.
 *
 * Die Oberflaeche liegt seit der Vorabpruefung nicht mehr in Apps Script,
 * sondern auf einem eigenen Host. Grund: Apps Script liefert seine
 * Oberflaeche zwingend in einem fremdstaemmigen Innenrahmen aus, und Safari
 * verwirft den lokalen Speicher eines solchen Rahmens bei jedem Neustart —
 * gemessen sowohl im Tab als auch als Home-Bildschirm-App. Damit waere die
 * lokale Zuordnung Kuerzel -> Name staendig verloren gegangen.
 *
 * Dieses Skript ist deshalb reine Datenschnittstelle und liefert JSON.
 *
 * DATENSCHUTZ: Hier passieren ausschliesslich Kuerzel. Namen, Namen von
 * Lehrkraeften und die Geschlechtsangabe erreichen diese Datei nie — sie
 * liegen allein im Browser des jeweiligen Geraets.
 *
 * ZUGRIFF: Die Web-App muss auf "Jeder, der ueber den Link verfuegt"
 * stehen, weil ein fremder Host die Google-Anmeldung nicht durchreichen
 * kann. Als Ersatz traegt jede Anfrage einen Zugangsschluessel, der in den
 * Skripteigenschaften liegt — nicht im Code und nicht im Repository.
 */

var TOKEN_SCHLUESSEL = 'zugangsschluessel';

/** Liest den Zugangsschluessel, erzeugt ihn beim ersten Aufruf. */
function holeToken_() {
  var eigenschaften = PropertiesService.getScriptProperties();
  var token = eigenschaften.getProperty(TOKEN_SCHLUESSEL);
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '');
    eigenschaften.setProperty(TOKEN_SCHLUESSEL, token);
  }
  return token;
}

function pruefeToken_(uebergeben) {
  var erwartet = holeToken_();
  if (!uebergeben || String(uebergeben) !== erwartet) {
    throw new Error('Zugang verweigert. Bitte den Zugangsschlüssel in den Einstellungen prüfen.');
  }
}

function antwort_(objekt) {
  return ContentService
    .createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}

function fehlerAntwort_(fehler) {
  // Niemals Stacktraces oder Nutzdaten nach aussen geben.
  var text = (fehler && fehler.message) ? String(fehler.message) : 'Unbekannter Fehler.';
  return antwort_({ ok: false, fehler: text });
}

/**
 * Lesende Aufrufe. Wird als einfacher GET aufgerufen, damit der Browser
 * keine Vorabanfrage (OPTIONS) schickt — die beantwortet Apps Script nicht.
 */
function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    pruefeToken_(p.token);

    switch (p.aktion) {
      case 'laden':
        return antwort_({ ok: true, daten: ladeAlles() });
      case 'ping':
        return antwort_({ ok: true, stand: new Date().toISOString() });
      default:
        throw new Error('Unbekannte Aktion.');
    }
  } catch (fehler) {
    return fehlerAntwort_(fehler);
  }
}

/**
 * Schreibende Aufrufe. Der Rumpf ist reiner Text mit JSON-Inhalt; ein
 * anderer Inhaltstyp loeste eine Vorabanfrage aus, die Apps Script nicht
 * beantworten kann.
 */
function doPost(e) {
  try {
    var rumpf = {};
    if (e && e.postData && e.postData.contents) {
      rumpf = JSON.parse(e.postData.contents);
    }
    pruefeToken_(rumpf.token);

    switch (rumpf.aktion) {
      case 'meta':
        return antwort_({ ok: true, ergebnis: setzeMeta(rumpf.werte || {}) });

      case 'wochenstatus':
        return antwort_({ ok: true, ergebnis:
          setzeWochenstatus(rumpf.kw, rumpf.aufgabe, rumpf.erledigt) });

      case 'boardErstellen':
        return antwort_({ ok: true, ergebnis:
          boardErstellen(rumpf.titel, rumpf.untertitel, rumpf.labels, rumpf.id) });

      case 'boardAktualisieren':
        return antwort_({ ok: true, ergebnis:
          boardAktualisieren(rumpf.id, rumpf.titel, rumpf.untertitel, rumpf.labels) });

      case 'boardStatus':
        return antwort_({ ok: true, ergebnis: boardStatus(rumpf.id, rumpf.status) });

      case 'boardZuruecksetzen':
        return antwort_({ ok: true, ergebnis: boardZuruecksetzen(rumpf.id) });

      case 'boardSpalteHinzufuegen':
        return antwort_({ ok: true, ergebnis:
          boardSpalteHinzufuegen(rumpf.board_id, rumpf.bezeichnung, rumpf.id) });

      case 'boardSpalteUmbenennen':
        return antwort_({ ok: true, ergebnis: boardSpalteUmbenennen(rumpf.id, rumpf.bezeichnung) });

      case 'boardSpaltenReihenfolge':
        return antwort_({ ok: true, ergebnis:
          boardSpaltenReihenfolge(rumpf.board_id, rumpf.reihenfolge) });

      case 'boardSpalteLoeschen':
        return antwort_({ ok: true, ergebnis: boardSpalteLoeschen(rumpf.id) });

      case 'boardWerte':
        return antwort_({ ok: true, ergebnis: boardWerteSpeichern(rumpf.aenderungen) });

      case 'schuelerImport':
        return antwort_({ ok: true, ergebnis: importSchuelerAusText(rumpf.csv || '') });

      case 'einrichten':
        return antwort_({ ok: true, ergebnis: setupSheets() });

      default:
        throw new Error('Unbekannte Aktion.');
    }
  } catch (fehler) {
    return fehlerAntwort_(fehler);
  }
}
