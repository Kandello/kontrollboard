/**
 * Daten.gs — Tabellenzugriff und Ladefunktion.
 *
 * Grundsatz: Blaetter werden immer komplett gelesen und gebuendelt
 * geschrieben. Zellenweiser Zugriff ist in Apps Script um Groessenordnungen
 * langsamer und bei drei gleichzeitig zugreifenden Geraeten unsicher.
 */

/** Vorerst durchgehend DE. Die Spalte ermoeglicht spaetere Faecher ohne Migration. */
var FACH = 'DE';

/**
 * Trennzeichen fuer zusammengesetzte Schluessel. Ein Zeichen, das in
 * Tabellendaten nicht vorkommt, damit ['ab','c'] und ['a','bc'] nicht
 * denselben Schluessel ergeben. Bewusst als Escape-Sequenz geschrieben:
 * ein rohes Steuerzeichen im Quelltext ueberlebt das Kopieren in den
 * Apps-Script-Editor nicht zuverlaessig.
 */
var TRENNER = '\u0000';

/** Blaetter, die eine fach-Spalte tragen und danach gefiltert werden. */
var MIT_FACH = ['Erhebungen', 'Gruppengewichte', 'Boards', 'Einheiten', 'Schueler'];

function holeBlatt_(name) {
  var blatt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!blatt) {
    throw new Error('Das Blatt "' + name + '" fehlt. Bitte im Menü "Blätter anlegen / prüfen" ausführen.');
  }
  return blatt;
}

/**
 * Liest ein Blatt als Liste von Objekten. Leere Zeilen werden uebersprungen.
 * Traegt das Blatt eine fach-Spalte, wird bereits hier gefiltert.
 */
function liesBlatt_(name) {
  var werte = holeBlatt_(name).getDataRange().getValues();
  if (werte.length < 2) return [];

  var kopf = werte[0].map(function (w) { return String(w).trim(); });
  var mitFach = MIT_FACH.indexOf(name) !== -1 && kopf.indexOf('fach') !== -1;
  var ergebnis = [];

  for (var i = 1; i < werte.length; i++) {
    var zeile = werte[i];
    if (zeile.join('') === '') continue;

    var satz = {};
    for (var s = 0; s < kopf.length; s++) {
      if (kopf[s]) satz[kopf[s]] = zeile[s];
    }
    if (mitFach && String(satz.fach || '').trim() !== FACH) continue;
    ergebnis.push(satz);
  }
  return ergebnis;
}

/**
 * Tolerante Boolean-Auswertung. Sheets liefert je nach Spracheinstellung
 * und Eingabeweg WAHR, TRUE, true, 1 oder einen echten Boolean.
 */
function istWahr_(wert) {
  if (wert === true) return true;
  if (wert === false || wert === '' || wert === null || wert === undefined) return false;
  var t = String(wert).trim().toLowerCase();
  return t === 'true' || t === 'wahr' || t === '1' || t === 'ja' || t === 'x';
}

/** Datumszellen liefern Date-Objekte, deren Zeitzone um einen Tag abweichen kann. */
function alsText_(wert) {
  if (wert === null || wert === undefined) return '';
  if (Object.prototype.toString.call(wert) === '[object Date]') {
    return Utilities.formatDate(wert, 'Europe/Berlin', 'yyyy-MM-dd');
  }
  return String(wert).trim();
}

function alsZahl_(wert) {
  if (wert === '' || wert === null || wert === undefined) return null;
  var n = Number(String(wert).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/** Fuehrt eine schreibende Aktion unter Sperre aus. */
function mitSperre_(aktion) {
  var sperre = LockService.getScriptLock();
  if (!sperre.tryLock(20000)) {
    throw new Error('Die Tabelle wird gerade von einem anderen Gerät bearbeitet. Bitte in einigen Sekunden erneut versuchen.');
  }
  try { return aktion(); } finally { sperre.releaseLock(); }
}

/** Haengt Zeilen gebuendelt an. Erwartet Objekte, ordnet nach SCHEMA. */
function haengeAn_(name, saetze) {
  if (!saetze.length) return 0;
  var blatt = holeBlatt_(name);
  var kopf = SCHEMA[name];
  var zeilen = saetze.map(function (s) {
    return kopf.map(function (spalte) {
      return s[spalte] === undefined || s[spalte] === null ? '' : s[spalte];
    });
  });
  blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, kopf.length).setValues(zeilen);
  return zeilen.length;
}

/**
 * Schreibt Saetze anhand eines Schluessels: vorhandene Zeilen werden
 * ersetzt, fehlende angehaengt. Ein einziger Lese- und ein einziger
 * Schreibvorgang, unabhaengig von der Zahl der Saetze.
 */
function schreibeNachSchluessel_(name, saetze, schluesselSpalten) {
  if (!saetze.length) return { aktualisiert: 0, neu: 0 };

  var blatt = holeBlatt_(name);
  var kopf = SCHEMA[name];
  var werte = blatt.getDataRange().getValues();
  var vorhandenerKopf = werte.length ? werte[0].map(function (w) { return String(w).trim(); }) : kopf;

  function schluesselVon(quelle, istZeile) {
    return schluesselSpalten.map(function (spalte) {
      var w = istZeile ? quelle[vorhandenerKopf.indexOf(spalte)] : quelle[spalte];
      return alsText_(w);
    }).join(TRENNER);
  }

  var index = {};
  for (var i = 1; i < werte.length; i++) {
    if (werte[i].join('') === '') continue;
    index[schluesselVon(werte[i], true)] = i;
  }

  var neu = [];
  var aktualisiert = 0;

  saetze.forEach(function (satz) {
    var zeile = kopf.map(function (spalte) {
      return satz[spalte] === undefined || satz[spalte] === null ? '' : satz[spalte];
    });
    var s = schluesselVon(satz, false);
    if (index[s] !== undefined) {
      werte[index[s]] = zeile;
      aktualisiert++;
    } else {
      neu.push(zeile);
    }
  });

  if (aktualisiert && werte.length > 1) {
    var koerper = werte.slice(1).map(function (z) {
      var voll = z.slice(0, kopf.length);
      while (voll.length < kopf.length) voll.push('');
      return voll;
    });
    blatt.getRange(2, 1, koerper.length, kopf.length).setValues(koerper);
  }
  if (neu.length) {
    blatt.getRange(blatt.getLastRow() + 1, 1, neu.length, kopf.length).setValues(neu);
  }
  return { aktualisiert: aktualisiert, neu: neu.length };
}

/** Loescht Zeilen, deren Schluessel in der Liste steht. */
function loescheNachSchluessel_(name, schluesselSpalten, schluesselListe) {
  if (!schluesselListe.length) return 0;
  var blatt = holeBlatt_(name);
  var kopf = SCHEMA[name];
  var werte = blatt.getDataRange().getValues();
  if (werte.length < 2) return 0;

  var vorhandenerKopf = werte[0].map(function (w) { return String(w).trim(); });
  var zuLoeschen = {};
  schluesselListe.forEach(function (s) { zuLoeschen[s.join(TRENNER)] = true; });

  var behalten = [];
  var entfernt = 0;
  for (var i = 1; i < werte.length; i++) {
    if (werte[i].join('') === '') continue;
    var s = schluesselSpalten.map(function (spalte) {
      return alsText_(werte[i][vorhandenerKopf.indexOf(spalte)]);
    }).join(TRENNER);
    if (zuLoeschen[s]) { entfernt++; continue; }
    behalten.push(werte[i].slice(0, kopf.length));
  }

  if (entfernt) {
    if (blatt.getLastRow() > 1) {
      blatt.getRange(2, 1, blatt.getLastRow() - 1, kopf.length).clearContent();
    }
    if (behalten.length) {
      blatt.getRange(2, 1, behalten.length, kopf.length).setValues(behalten);
    }
  }
  return entfernt;
}

/**
 * Ein Ladeaufruf je Sitzung. Liefert alle Rohdaten, die die Oberflaeche
 * fuer die gesamte Navigation braucht — berechnet wird ausschliesslich
 * im Browser.
 *
 * Enthaelt ausschliesslich Kuerzel, niemals Namen.
 */
function ladeAlles() {
  var meta = {};
  liesBlatt_('Meta').forEach(function (z) {
    if (z.schluessel) meta[String(z.schluessel).trim()] = alsText_(z.wert);
  });

  return {
    stand: Utilities.formatDate(new Date(), 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm:ss"),
    fach: FACH,
    meta: meta,

    klassen: liesBlatt_('Klassen')
      .filter(function (z) { return istWahr_(z.aktiv); })
      .map(function (z) {
        return {
          klasse: alsText_(z.klasse),
          bezeichnung: alsText_(z.bezeichnung) || alsText_(z.klasse),
          reihenfolge: alsZahl_(z.reihenfolge) || 0,
          // Frei waehlbare Farbe, z. B. '#4aa8d8'. Bleibt sie leer, waehlt
          // die Oberflaeche anhand der Reihenfolge aus einer Palette.
          farbe: alsText_(z.farbe)
        };
      })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }),

    schueler: liesBlatt_('Schueler').map(function (z) {
      return {
        kuerzel: alsText_(z.kuerzel),
        klasse: alsText_(z.klasse),
        listennummer: alsZahl_(z.listennummer) || 0,
        aktiv: istWahr_(z.aktiv)
      };
    }),

    stundenplan: liesBlatt_('Stundenplan')
      .filter(function (z) { return istWahr_(z.aktiv); })
      .map(function (z) {
        return {
          wochentag: alsZahl_(z.wochentag) || 0,
          stunde: alsZahl_(z.stunde),
          von: alsText_(z.von),
          bis: alsText_(z.bis),
          klasse: alsText_(z.klasse),
          art: alsText_(z.art).toUpperCase(),
          zusatz: alsText_(z.zusatz)
        };
      }),

    kategorien: liesBlatt_('Kategorien')
      .filter(function (z) { return istWahr_(z.aktiv); })
      .map(function (z) {
        return {
          id: alsText_(z.id),
          bezeichnung: alsText_(z.bezeichnung),
          gruppe: alsText_(z.gruppe),
          reihenfolge: alsZahl_(z.reihenfolge) || 0
        };
      })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }),

    gruppengewichte: liesBlatt_('Gruppengewichte').map(function (z) {
      return { gruppe: alsText_(z.gruppe), gewicht: alsZahl_(z.gewicht) || 0 };
    }),

    notenschluessel: liesBlatt_('Notenschluessel')
      .filter(function (z) { return z.note !== '' && z.note !== null; })
      .map(function (z) {
        return { note: alsZahl_(z.note), min_prozent: alsZahl_(z.min_prozent) || 0 };
      })
      .sort(function (a, b) { return b.min_prozent - a.min_prozent; }),

    erhebungen: liesBlatt_('Erhebungen')
      .filter(function (z) { return !istWahr_(z.geloescht); })
      .map(function (z) {
        return {
          id: alsText_(z.id),
          datum: alsText_(z.datum),
          kuerzel: alsText_(z.kuerzel),
          kategorie_id: alsText_(z.kategorie_id),
          anlass: alsText_(z.anlass),
          wert: alsZahl_(z.wert),
          notiz: alsText_(z.notiz)
        };
      }),

    boards: liesBlatt_('Boards').map(function (z) {
      return {
        id: alsText_(z.id),
        titel: alsText_(z.titel),
        untertitel: alsText_(z.untertitel),
        labels: alsText_(z.labels),
        status: alsText_(z.status) || 'aktiv',
        erstellt_am: alsText_(z.erstellt_am),
        archiviert_am: alsText_(z.archiviert_am)
      };
    }),

    boardSpalten: liesBlatt_('BoardSpalten')
      .map(function (z) {
        return {
          id: alsText_(z.id),
          board_id: alsText_(z.board_id),
          bezeichnung: alsText_(z.bezeichnung),
          reihenfolge: alsZahl_(z.reihenfolge) || 0
        };
      })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }),

    boardWerte: liesBlatt_('BoardWerte')
      .filter(function (z) { return alsText_(z.zustand) !== ''; })
      .map(function (z) {
        return {
          board_id: alsText_(z.board_id),
          spalte_id: alsText_(z.spalte_id),
          kuerzel: alsText_(z.kuerzel),
          zustand: alsText_(z.zustand)
        };
      }),

    einheiten: liesBlatt_('Einheiten')
      .filter(function (z) { return istWahr_(z.aktiv); })
      .map(function (z) {
        return {
          id: alsText_(z.id),
          titel: alsText_(z.titel),
          beschreibung: alsText_(z.beschreibung),
          reihenfolge: alsZahl_(z.reihenfolge) || 0,
          geplante_stunden: alsZahl_(z.geplante_stunden),
          lehrplanbezug: alsText_(z.lehrplanbezug),
          status: alsText_(z.status) || 'geplant'
        };
      })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }),

    teilthemen: liesBlatt_('Teilthemen')
      .map(function (z) {
        return {
          id: alsText_(z.id),
          einheit_id: alsText_(z.einheit_id),
          titel: alsText_(z.titel),
          reihenfolge: alsZahl_(z.reihenfolge) || 0
        };
      })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; }),

    einheitFortschritt: liesBlatt_('EinheitFortschritt').map(function (z) {
      return {
        teilthema_id: alsText_(z.teilthema_id),
        klasse: alsText_(z.klasse),
        erledigt: istWahr_(z.erledigt),
        datum: alsText_(z.datum),
        notiz: alsText_(z.notiz)
      };
    }),

    wochenstatus: liesBlatt_('Wochenstatus').map(function (z) {
      return {
        kw: alsText_(z.kw),
        aufgabe: alsText_(z.aufgabe).toUpperCase(),
        erledigt_am: alsText_(z.erledigt_am)
      };
    }),

    warnungen: pruefeKonfiguration()
  };
}

/** Schreibt einzelne Meta-Werte (Ferienmodus, Links, Zuordnungs-Zeitstempel). */
function setzeMeta(paare) {
  return mitSperre_(function () {
    var saetze = Object.keys(paare).map(function (s) {
      return { schluessel: s, wert: String(paare[s]) };
    });
    schreibeNachSchluessel_('Meta', saetze, ['schluessel']);
    return { gespeichert: saetze.length };
  });
}

/**
 * Setzt oder entfernt einen Eintrag im Blatt Wochenstatus.
 *
 * Fehlt der Eintrag, gilt die Aufgabe als offen. Dadurch setzt sich der
 * Status zum Wochenwechsel von selbst zurueck, ohne Zeitausloeser.
 *
 * Die Kalenderwoche wird im Browser nach ISO-8601 und Europe/Berlin
 * bestimmt und hier nur noch auf ihre Form geprueft — die Skript-Zeitzone
 * spielt also keine Rolle.
 */
function setzeWochenstatus(kw, aufgabe, erledigt) {
  var kennung = String(kw || '').trim();
  if (!/^\d{4}-W\d{2}$/.test(kennung)) {
    throw new Error('Ungültige Kalenderwoche.');
  }
  var welche = String(aufgabe || '').trim().toUpperCase();
  if (welche !== 'WEEKLY' && welche !== 'PEAK') {
    throw new Error('Unbekannte Wochenaufgabe.');
  }

  return mitSperre_(function () {
    if (erledigt) {
      schreibeNachSchluessel_('Wochenstatus', [{
        kw: kennung,
        aufgabe: welche,
        erledigt_am: Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd')
      }], ['kw', 'aufgabe']);
    } else {
      loescheNachSchluessel_('Wochenstatus', ['kw', 'aufgabe'], [[kennung, welche]]);
    }
    return { kw: kennung, aufgabe: welche, erledigt: Boolean(erledigt) };
  });
}
