/**
 * Setup.gs — Blattstruktur, Vorbelegungen, Einrichtung.
 *
 * Enthaelt bewusst KEINE Klassenbezeichnungen, Namen, Kuerzel oder Links.
 * Alles Persoenliche steht in der Tabelle, damit die Weitergabe an
 * Kolleg:innen eine reine Kopie bleibt (Abschnitt 15 des Auftrags).
 */

/** Spaltenkoepfe je Blatt. Reihenfolge ist verbindlich. */
var SCHEMA = {
  Klassen:            ['klasse', 'bezeichnung', 'reihenfolge', 'aktiv'],
  Schueler:           ['kuerzel', 'klasse', 'listennummer', 'aktiv', 'fach'],
  Stundenplan:        ['wochentag', 'stunde', 'von', 'bis', 'klasse', 'art', 'zusatz', 'aktiv'],
  Kategorien:         ['id', 'bezeichnung', 'gruppe', 'reihenfolge', 'aktiv'],
  Gruppengewichte:    ['fach', 'gruppe', 'gewicht'],
  Erhebungen:         ['id', 'datum', 'fach', 'kuerzel', 'kategorie_id', 'anlass', 'wert', 'notiz', 'geloescht'],
  Notenschluessel:    ['note', 'min_prozent'],
  Boards:             ['id', 'klasse', 'fach', 'titel', 'untertitel', 'labels', 'status', 'erstellt_am', 'archiviert_am'],
  BoardSpalten:       ['id', 'board_id', 'bezeichnung', 'reihenfolge'],
  BoardWerte:         ['board_id', 'spalte_id', 'kuerzel', 'zustand', 'geaendert_am'],
  Einheiten:          ['id', 'fach', 'titel', 'beschreibung', 'reihenfolge', 'geplante_stunden', 'lehrplanbezug', 'status', 'aktiv'],
  Teilthemen:         ['id', 'einheit_id', 'titel', 'reihenfolge'],
  EinheitFortschritt: ['teilthema_id', 'klasse', 'erledigt', 'datum', 'notiz'],
  Wochenstatus:       ['kw', 'aufgabe', 'erledigt_am'],
  Meta:               ['schluessel', 'wert']
};

/**
 * Spalten, die zwingend als Text formatiert werden. Sheets wandelt sonst
 * '09:00' in eine Uhrzeit und '2026-08-17' in ein Datum um — deren
 * Zeitzonen-Auslegung weicht je nach Skript-Zeitzone um einen Tag ab.
 */
var TEXTSPALTEN = {
  Schueler:           ['kuerzel'],
  Stundenplan:        ['von', 'bis', 'klasse'],
  Erhebungen:         ['id', 'datum', 'kuerzel', 'anlass'],
  Boards:             ['id', 'erstellt_am', 'archiviert_am'],
  BoardSpalten:       ['id', 'board_id'],
  BoardWerte:         ['board_id', 'spalte_id', 'kuerzel', 'geaendert_am'],
  Einheiten:          ['id'],
  Teilthemen:         ['id', 'einheit_id'],
  EinheitFortschritt: ['teilthema_id', 'datum'],
  Wochenstatus:       ['kw', 'erledigt_am'],
  Meta:               ['wert']
};

/** Wird nur eingetragen, wenn das Blatt noch leer ist. */
var VORBELEGUNG = {
  Kategorien: [
    ['ASSESS', 'Assessment',   'ASSESS', 1, true],
    ['QUIZ',   'Quiz',         'QUIZ',   2, true],
    ['PART',   'Participation', 'PP',    3, true],
    ['PRES',   'Presentation',  'PP',    4, true]
  ],
  Gruppengewichte: [
    ['DE', 'ASSESS', 0.5],
    ['DE', 'QUIZ',   0.3],
    ['DE', 'PP',     0.2]
  ],
  Notenschluessel: [
    [1, 92], [2, 80], [3, 67], [4, 50], [5, 23], [6, 0]
  ],
  Stundenplan: [
    [1, 1, '09:00', '09:45', '3L',  'LESEN',   '+4H', true],
    [1, 2, '09:45', '10:30', '3L',  'DEUTSCH', '',    true],
    [1, 4, '11:30', '12:15', '3M',  'DEUTSCH', '',    true],
    [1, 5, '12:15', '13:00', '1A',  'FUF',     '',    true],
    [1, '', '13:30', '14:00', '',   'DIENST',  'Pausenaufsicht', true],
    [1, 6, '14:00', '14:45', '3OB', 'DEUTSCH', '',    true],
    [2, 1, '09:00', '09:45', '3OB', 'DEUTSCH', '',    true],
    [2, 2, '09:45', '10:30', '3OB', 'LESEN',   '+4M', true],
    [2, 4, '11:30', '12:15', '3L',  'DEUTSCH', '',    true],
    [2, 6, '14:00', '14:45', '3M',  'DEUTSCH', '',    true],
    [3, 1, '09:00', '09:45', '3M',  'DEUTSCH', '',    true],
    [3, 2, '09:45', '10:30', '3OB', 'DEUTSCH', '',    true],
    [3, 4, '11:30', '12:15', '3L',  'DEUTSCH', '',    true],
    [4, 1, '09:00', '09:45', '3M',  'LESEN',   '+4K', true],
    [4, 2, '09:45', '10:30', '3M',  'DEUTSCH', '',    true],
    [4, 4, '11:30', '12:15', '3OB', 'DEUTSCH', '',    true],
    [4, 5, '12:15', '13:00', '3L',  'DEUTSCH', '',    true],
    [4, 6, '14:00', '14:45', '1S',  'FUF',     '',    true],
    [5, 2, '09:45', '10:30', '3OB', 'DEUTSCH', '',    true],
    [5, 4, '11:30', '12:15', '1A',  'FUF',     '',    true],
    [5, 5, '12:15', '13:00', '3L',  'DEUTSCH', '',    true],
    [5, 6, '14:00', '14:45', '3M',  'DEUTSCH', '',    true]
  ],
  Klassen: [
    ['3L',  '3L',  1, true],
    ['3M',  '3M',  2, true],
    ['3OB', '3OB', 3, true]
  ],
  Meta: [
    ['zuordnung_version', ''],
    ['halbjahresgrenze',  '01-31'],
    ['schuljahresbeginn', ''],
    ['ferienmodus',       'FALSE'],
    ['link_weekly',       ''],
    ['link_peak',         ''],
    ['schema_version',    '1']
  ]
};

/**
 * Legt fehlende Blaetter samt Kopfzeile, Spaltenformaten und Vorbelegung an.
 * Mehrfach aufrufbar; vorhandene Daten werden nie ueberschrieben.
 */
function setupSheets() {
  var tabelle = SpreadsheetApp.getActiveSpreadsheet();
  var bericht = { angelegt: [], ergaenzt: [], unveraendert: [] };

  Object.keys(SCHEMA).forEach(function (name) {
    var kopf = SCHEMA[name];
    var blatt = tabelle.getSheetByName(name);
    var istNeu = false;

    if (!blatt) {
      blatt = tabelle.insertSheet(name);
      istNeu = true;
    }

    // Kopfzeile setzen bzw. fehlende Spalten hinten anfuegen.
    var breite = Math.max(blatt.getLastColumn(), kopf.length);
    var vorhandenerKopf = blatt.getLastRow() > 0
      ? blatt.getRange(1, 1, 1, breite).getValues()[0].map(function (w) { return String(w).trim(); })
      : [];

    var fehlende = kopf.filter(function (s) { return vorhandenerKopf.indexOf(s) === -1; });

    if (vorhandenerKopf.length === 0 || vorhandenerKopf.join('') === '') {
      blatt.getRange(1, 1, 1, kopf.length).setValues([kopf]);
      blatt.setFrozenRows(1);
      blatt.getRange(1, 1, 1, kopf.length).setFontWeight('bold');
      formatiereTextspalten_(blatt, name, kopf);
      if (istNeu) bericht.angelegt.push(name);
    } else if (fehlende.length) {
      var start = vorhandenerKopf.filter(function (w) { return w !== ''; }).length + 1;
      blatt.getRange(1, start, 1, fehlende.length).setValues([fehlende]);
      bericht.ergaenzt.push(name + ' (' + fehlende.join(', ') + ')');
    } else {
      bericht.unveraendert.push(name);
    }

    // Vorbelegung nur in ein noch leeres Blatt.
    var vorgabe = VORBELEGUNG[name];
    if (vorgabe && blatt.getLastRow() <= 1) {
      blatt.getRange(2, 1, vorgabe.length, vorgabe[0].length).setValues(vorgabe);
    }
  });

  tabelle.setSpreadsheetTimeZone('Europe/Berlin');
  return bericht;
}

function formatiereTextspalten_(blatt, name, kopf) {
  var spalten = TEXTSPALTEN[name];
  if (!spalten) return;
  spalten.forEach(function (spalte) {
    var index = kopf.indexOf(spalte);
    if (index === -1) return;
    blatt.getRange(2, index + 1, blatt.getMaxRows() - 1, 1).setNumberFormat('@');
  });
}

/**
 * Liest den Inhalt von schueler-import.csv in das Blatt Schueler.
 * Vorhandene Kuerzel werden aktualisiert statt doppelt angelegt.
 *
 * Die Datei enthaelt ausschliesslich Kuerzel, niemals Namen. Zeilen mit
 * einem ungueltigen Kuerzel werden abgewiesen — das faengt eine
 * versehentlich namenhaltige Datei ab, bevor etwas geschrieben wird.
 */
function importSchuelerAusText(csvText) {
  if (!csvText || !String(csvText).trim()) {
    throw new Error('Es wurde kein Inhalt uebergeben.');
  }

  var zeilen = String(csvText).replace(/^﻿/, '').split(/\r\n|\r|\n/);
  var kopf = null;
  var eintraege = [];
  var fehler = [];

  zeilen.forEach(function (zeile, nr) {
    if (!zeile.trim()) return;
    var felder = zeile.indexOf(';') !== -1 ? zeile.split(';') : zeile.split(',');
    felder = felder.map(function (f) { return f.trim(); });

    if (!kopf) {
      if (felder[0].toLowerCase() === 'kuerzel') { kopf = felder; return; }
      throw new Error('Die erste Zeile muss die Kopfzeile sein und mit "kuerzel" beginnen.');
    }

    var satz = {};
    kopf.forEach(function (spalte, i) { satz[spalte] = felder[i] !== undefined ? felder[i] : ''; });

    if (!/^[0-9][A-Za-z]{1,3}-[0-9]{2}$/.test(satz.kuerzel)) {
      fehler.push('Zeile ' + (nr + 1) + ': "' + satz.kuerzel + '" ist kein gueltiges Kuerzel.');
      return;
    }
    eintraege.push({
      kuerzel:      satz.kuerzel,
      klasse:       satz.klasse || '',
      listennummer: Number(satz.listennummer) || 0,
      aktiv:        istWahr_(satz.aktiv),
      fach:         satz.fach || 'DE'
    });
  });

  if (fehler.length) {
    throw new Error('Import abgebrochen, nichts geschrieben.\n' + fehler.join('\n'));
  }
  if (!eintraege.length) {
    throw new Error('Es wurden keine verwertbaren Zeilen gefunden.');
  }

  var sperre = LockService.getScriptLock();
  if (!sperre.tryLock(20000)) {
    throw new Error('Die Tabelle wird gerade von einem anderen Geraet bearbeitet. Bitte erneut versuchen.');
  }

  try {
    var blatt = holeBlatt_('Schueler');
    var kopfZeile = SCHEMA.Schueler;
    var werte = blatt.getDataRange().getValues();
    var vorhandene = {};
    for (var i = 1; i < werte.length; i++) {
      if (werte[i][0]) vorhandene[String(werte[i][0]).trim()] = i;
    }

    var neu = 0, aktualisiert = 0;
    var anzuhaengen = [];

    eintraege.forEach(function (e) {
      var zeile = kopfZeile.map(function (spalte) { return e[spalte]; });
      if (vorhandene[e.kuerzel] !== undefined) {
        werte[vorhandene[e.kuerzel]] = zeile;
        aktualisiert++;
      } else {
        anzuhaengen.push(zeile);
        neu++;
      }
    });

    if (aktualisiert && werte.length > 1) {
      blatt.getRange(2, 1, werte.length - 1, kopfZeile.length)
           .setValues(werte.slice(1).map(function (z) { return z.slice(0, kopfZeile.length); }));
    }
    if (anzuhaengen.length) {
      blatt.getRange(blatt.getLastRow() + 1, 1, anzuhaengen.length, kopfZeile.length)
           .setValues(anzuhaengen);
    }

    return { neu: neu, aktualisiert: aktualisiert, gesamt: eintraege.length };
  } finally {
    sperre.releaseLock();
  }
}

/**
 * Prueft die Konfiguration und meldet, was die Berechnung verfaelschen wuerde.
 * Wird bei jedem Laden mitgeliefert und in der Oberflaeche angezeigt.
 */
function pruefeKonfiguration() {
  var warnungen = [];

  var schluessel = liesBlatt_('Notenschluessel')
    .filter(function (z) { return z.note !== '' && z.note !== null; })
    .map(function (z) { return { note: Number(z.note), min: Number(z.min_prozent) }; })
    .sort(function (a, b) { return b.min - a.min; });

  if (!schluessel.length) {
    warnungen.push('Der Notenschluessel ist leer.');
  } else {
    if (schluessel[schluessel.length - 1].min > 0) {
      warnungen.push('Der Notenschluessel deckt den Bereich unter ' +
                     schluessel[schluessel.length - 1].min + ' % nicht ab.');
    }
    if (schluessel[0].min > 100) {
      warnungen.push('Die hoechste Notengrenze liegt ueber 100 %.');
    }
    for (var i = 0; i < schluessel.length - 1; i++) {
      if (schluessel[i].min === schluessel[i + 1].min) {
        warnungen.push('Zwei Noten haben dieselbe Untergrenze (' + schluessel[i].min + ' %).');
      }
    }
  }

  var gewichte = liesBlatt_('Gruppengewichte').filter(function (z) { return z.fach === FACH; });
  var summe = gewichte.reduce(function (s, z) { return s + Number(z.gewicht || 0); }, 0);
  if (gewichte.length && Math.abs(summe - 1) > 0.0001) {
    warnungen.push('Die Gruppengewichte ergeben ' + summe.toFixed(3) + ' statt 1,0.');
  }
  if (!gewichte.length) {
    warnungen.push('Es sind keine Gruppengewichte hinterlegt.');
  }

  var kategorien = liesBlatt_('Kategorien').filter(function (z) { return istWahr_(z.aktiv); });
  var gruppenMitGewicht = gewichte.map(function (z) { return z.gruppe; });
  kategorien.forEach(function (k) {
    if (gruppenMitGewicht.indexOf(k.gruppe) === -1) {
      warnungen.push('Die Kategorie "' + k.id + '" verweist auf die Gruppe "' + k.gruppe +
                     '", fuer die kein Gewicht hinterlegt ist.');
    }
  });

  return warnungen;
}

/** Menue in der Tabelle, damit die Einrichtung ohne Skripteditor laeuft. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kommandozentrale')
    .addItem('Blätter anlegen / prüfen', 'menueSetup')
    .addItem('Schülerliste einlesen', 'menueImport')
    .addItem('Konfiguration prüfen', 'menuePruefung')
    .addSeparator()
    .addItem('Zugangsschlüssel anzeigen', 'menueToken')
    .toUi();
}

function menueSetup() {
  var b = setupSheets();
  var text = 'Angelegt: ' + (b.angelegt.join(', ') || '–') +
             '\nErgänzt: ' + (b.ergaenzt.join(', ') || '–') +
             '\nUnverändert: ' + b.unveraendert.length + ' Blätter';
  SpreadsheetApp.getUi().alert('Einrichtung abgeschlossen', text, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menueImport() {
  var ui = SpreadsheetApp.getUi();
  var antwort = ui.prompt(
    'Schülerliste einlesen',
    'Inhalt von schueler-import.csv hier einfügen (Kopfzeile mit einschließen):',
    ui.ButtonSet.OK_CANCEL);
  if (antwort.getSelectedButton() !== ui.Button.OK) return;
  try {
    var e = importSchuelerAusText(antwort.getResponseText());
    ui.alert('Import erfolgreich',
             e.neu + ' neu angelegt, ' + e.aktualisiert + ' aktualisiert (' + e.gesamt + ' Zeilen).',
             ui.ButtonSet.OK);
  } catch (fehler) {
    ui.alert('Import fehlgeschlagen', fehler.message, ui.ButtonSet.OK);
  }
}

function menuePruefung() {
  var w = pruefeKonfiguration();
  SpreadsheetApp.getUi().alert(
    w.length ? 'Hinweise zur Konfiguration' : 'Konfiguration in Ordnung',
    w.length ? w.join('\n\n') : 'Notenschlüssel und Gruppengewichte sind stimmig.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function menueToken() {
  SpreadsheetApp.getUi().alert(
    'Zugangsschlüssel',
    'Dieser Schlüssel gehört in die Einstellungen der Web-Oberfläche:\n\n' +
    holeToken_() +
    '\n\nEr ersetzt kein Passwort, hält aber zufällige Zugriffe fern. ' +
    'Nicht weitergeben und nicht in ein öffentliches Repository schreiben.',
    SpreadsheetApp.getUi().ButtonSet.OK);
}
