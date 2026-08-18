/**
 * Boards.gs — Checklisten: Verwaltung von Boards, Spalten und Zellwerten.
 *
 * Eigenes Modul, getrennt von der allgemeinen Tabellenlogik (Daten.gs), damit
 * dieses Werkzeug geaendert werden kann, ohne die anderen zu beruehren
 * (Abschnitt 15). Enthaelt ausschliesslich Kuerzel, niemals Namen.
 */

/** Die vier Zellzustaende. 'leer' wird nie gespeichert — fehlende Kombination heisst leer. */
var BOARD_ZUSTAENDE = ['haken', 'teilweise', 'x'];

function findeBoard_(id) {
  var treffer = liesBlatt_('Boards').filter(function (z) { return alsText_(z.id) === id; })[0];
  if (!treffer) throw new Error('Die Checkliste wurde nicht gefunden.');
  return treffer;
}

/**
 * Legt eine neue Checkliste an — gemeinsam fuer alle Klassen, nicht je
 * Klasse einzeln (Parallelklassen erhalten ohnehin dieselben Listen).
 * Die Trennung nach Klasse ergibt sich allein aus dem Kuerzel der Kinder
 * in BoardWerte, nie aus der Checkliste selbst.
 *
 * `id` kommt vom Client (optimistische Anzeige vor der Serverantwort) und
 * wird uebernommen, falls angegeben — sonst hier erzeugt.
 */
function boardErstellen(titel, untertitel, labels, id) {
  titel = String(titel || '').trim();
  id = String(id || '').trim() || Utilities.getUuid();
  if (!titel) throw new Error('Bitte einen Titel angeben.');

  return mitSperre_(function () {
    var jetzt = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
    var board = {
      id: id, fach: FACH, titel: titel,
      untertitel: String(untertitel || ''), labels: String(labels || ''),
      status: 'aktiv', erstellt_am: jetzt, archiviert_am: ''
    };
    haengeAn_('Boards', [board]);
    return { board: board };
  });
}

/** Aendert Titel, Untertitel und Labels — nicht den Status. */
function boardAktualisieren(id, titel, untertitel, labels) {
  id = String(id || '').trim();
  titel = String(titel || '').trim();
  if (!id) throw new Error('Keine Checkliste angegeben.');
  if (!titel) throw new Error('Bitte einen Titel angeben.');

  return mitSperre_(function () {
    var vorhanden = findeBoard_(id);
    schreibeNachSchluessel_('Boards', [{
      id: id, fach: vorhanden.fach, titel: titel,
      untertitel: String(untertitel || ''), labels: String(labels || ''),
      status: vorhanden.status, erstellt_am: vorhanden.erstellt_am,
      archiviert_am: vorhanden.archiviert_am
    }], ['id']);
    return { id: id };
  });
}

/**
 * Aktiv <-> archiviert — je Klasse einzeln, nicht fuer die Checkliste als
 * Ganzes: Parallelklassen brauchen eine geteilte Liste nicht zwangslaeufig
 * gleich lang. Fehlt eine Zeile in BoardKlassenStatus fuer diese Kombination,
 * gilt die Klasse als aktiv (siehe Daten.gs).
 */
function boardStatus(id, klasse, status) {
  id = String(id || '').trim();
  klasse = String(klasse || '').trim();
  status = String(status || '').trim().toLowerCase();
  if (!klasse) throw new Error('Keine Klasse angegeben.');
  if (status !== 'aktiv' && status !== 'archiviert') throw new Error('Unbekannter Status.');

  return mitSperre_(function () {
    findeBoard_(id); // wirft, falls die Checkliste nicht existiert.
    var jetzt = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
    schreibeNachSchluessel_('BoardKlassenStatus', [{
      board_id: id, klasse: klasse, status: status,
      archiviert_am: status === 'archiviert' ? jetzt : ''
    }], ['board_id', 'klasse']);
    return { id: id, klasse: klasse, status: status };
  });
}

/**
 * Leert die Zustaende eines Boards fuer eine einzelne Klasse. Die Spalten
 * und die Zustaende der anderen Klassen bleiben erhalten — eine geteilte
 * Checkliste darf pro Klasse unabhaengig aufgeraeumt werden.
 */
function boardZuruecksetzen(id, klasse) {
  id = String(id || '').trim();
  klasse = String(klasse || '').trim();
  if (!id) throw new Error('Keine Checkliste angegeben.');
  if (!klasse) throw new Error('Keine Klasse angegeben.');

  return mitSperre_(function () {
    var kuerzelDieserKlasse = {};
    liesBlatt_('Schueler').forEach(function (s) {
      if (alsText_(s.klasse) === klasse) kuerzelDieserKlasse[alsText_(s.kuerzel)] = true;
    });
    var werte = liesBlatt_('BoardWerte').filter(function (z) {
      return alsText_(z.board_id) === id && kuerzelDieserKlasse[alsText_(z.kuerzel)];
    });
    var schluessel = werte.map(function (z) {
      return [alsText_(z.board_id), alsText_(z.spalte_id), alsText_(z.kuerzel)];
    });
    var entfernt = loescheNachSchluessel_('BoardWerte', ['board_id', 'spalte_id', 'kuerzel'], schluessel);
    return { entfernt: entfernt };
  });
}

/** Neue Spalte ans Ende. `id` kommt vom Client (optimistische Anzeige), sonst wird sie erzeugt. */
function boardSpalteHinzufuegen(board_id, bezeichnung, id) {
  board_id = String(board_id || '').trim();
  bezeichnung = String(bezeichnung || '').trim();
  id = String(id || '').trim() || Utilities.getUuid();
  if (!board_id) throw new Error('Keine Checkliste angegeben.');
  if (!bezeichnung) throw new Error('Bitte eine Bezeichnung angeben.');

  return mitSperre_(function () {
    var vorhandene = liesBlatt_('BoardSpalten').filter(function (z) { return alsText_(z.board_id) === board_id; });
    var naechste = vorhandene.reduce(function (m, z) { return Math.max(m, Number(z.reihenfolge) || 0); }, 0) + 1;
    haengeAn_('BoardSpalten', [{ id: id, board_id: board_id, bezeichnung: bezeichnung, reihenfolge: naechste }]);
    return { id: id, board_id: board_id, bezeichnung: bezeichnung, reihenfolge: naechste };
  });
}

function boardSpalteUmbenennen(id, bezeichnung) {
  id = String(id || '').trim();
  bezeichnung = String(bezeichnung || '').trim();
  if (!id) throw new Error('Keine Spalte angegeben.');
  if (!bezeichnung) throw new Error('Bitte eine Bezeichnung angeben.');

  return mitSperre_(function () {
    var spalte = liesBlatt_('BoardSpalten').filter(function (z) { return alsText_(z.id) === id; })[0];
    if (!spalte) throw new Error('Die Spalte wurde nicht gefunden.');
    schreibeNachSchluessel_('BoardSpalten', [{
      id: id, board_id: spalte.board_id, bezeichnung: bezeichnung, reihenfolge: spalte.reihenfolge
    }], ['id']);
    return { id: id, bezeichnung: bezeichnung };
  });
}

/** `reihenfolge` ist die vollstaendige, neu geordnete Liste der Spalten-IDs. */
function boardSpaltenReihenfolge(board_id, reihenfolge) {
  board_id = String(board_id || '').trim();
  if (!board_id) throw new Error('Keine Checkliste angegeben.');
  if (!reihenfolge || !reihenfolge.length) throw new Error('Keine Reihenfolge angegeben.');

  return mitSperre_(function () {
    var spalten = liesBlatt_('BoardSpalten').filter(function (z) { return alsText_(z.board_id) === board_id; });
    var nachId = {};
    spalten.forEach(function (z) { nachId[alsText_(z.id)] = z; });

    var saetze = reihenfolge.map(function (id, i) {
      var s = nachId[String(id)];
      if (!s) throw new Error('Eine Spalte wurde nicht gefunden.');
      return { id: alsText_(s.id), board_id: alsText_(s.board_id), bezeichnung: alsText_(s.bezeichnung), reihenfolge: i + 1 };
    });
    schreibeNachSchluessel_('BoardSpalten', saetze, ['id']);
    return { gespeichert: saetze.length };
  });
}

/** Loescht eine Spalte und alle ihre Werte (Kaskade). */
function boardSpalteLoeschen(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('Keine Spalte angegeben.');

  return mitSperre_(function () {
    var entfernt = loescheNachSchluessel_('BoardSpalten', ['id'], [[id]]);
    if (!entfernt) throw new Error('Die Spalte wurde nicht gefunden.');

    var werte = liesBlatt_('BoardWerte').filter(function (z) { return alsText_(z.spalte_id) === id; });
    var schluessel = werte.map(function (z) {
      return [alsText_(z.board_id), alsText_(z.spalte_id), alsText_(z.kuerzel)];
    });
    loescheNachSchluessel_('BoardWerte', ['board_id', 'spalte_id', 'kuerzel'], schluessel);
    return { id: id, geloeschteWerte: schluessel.length };
  });
}

/**
 * Gebuendeltes Schreiben der Zellzustaende — der Client sammelt Aenderungen
 * etwa eine Sekunde lang und schickt sie in einem Rutsch. `zustand: ''`
 * loescht die Zeile (heisst wieder leer).
 */
function boardWerteSpeichern(aenderungen) {
  if (!aenderungen || !aenderungen.length) return { gespeichert: 0, geloescht: 0 };

  return mitSperre_(function () {
    var jetzt = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
    var zuSchreiben = [];
    var zuLoeschen = [];

    aenderungen.forEach(function (a) {
      var board_id = String(a.board_id || '').trim();
      var spalte_id = String(a.spalte_id || '').trim();
      var kuerzel = String(a.kuerzel || '').trim();
      var zustand = String(a.zustand || '').trim();
      if (!board_id || !spalte_id || !kuerzel) return;

      if (!/^[0-9][A-Za-z]{1,3}-[0-9]{2}$/.test(kuerzel)) {
        throw new Error('Ungültiges Kürzel: ' + kuerzel);
      }

      if (zustand === '') {
        zuLoeschen.push([board_id, spalte_id, kuerzel]);
      } else if (BOARD_ZUSTAENDE.indexOf(zustand) !== -1) {
        zuSchreiben.push({ board_id: board_id, spalte_id: spalte_id, kuerzel: kuerzel, zustand: zustand, geaendert_am: jetzt });
      } else {
        throw new Error('Unbekannter Zustand: ' + zustand);
      }
    });

    var gespeichert = 0, geloescht = 0;
    if (zuSchreiben.length) {
      var r = schreibeNachSchluessel_('BoardWerte', zuSchreiben, ['board_id', 'spalte_id', 'kuerzel']);
      gespeichert = r.aktualisiert + r.neu;
    }
    if (zuLoeschen.length) {
      geloescht = loescheNachSchluessel_('BoardWerte', ['board_id', 'spalte_id', 'kuerzel'], zuLoeschen);
    }
    return { gespeichert: gespeichert, geloescht: geloescht };
  });
}
