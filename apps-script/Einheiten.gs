/**
 * Einheiten.gs — Unterrichtseinheiten, Teilthemen und der Klassenfortschritt.
 *
 * Eigenes Modul, getrennt von Daten.gs und Boards.gs, damit dieses Werkzeug
 * geaendert werden kann, ohne die anderen zu beruehren (Abschnitt 15).
 *
 * JAHRESPLAN: Eine Einheit speichert ihre Startwoche NICHT. Gespeichert sind
 * nur `spur` (Rechtschreibung, Grammatik oder beides), `reihenfolge` und
 * `dauer_wochen`; die Startwoche ergibt sich daraus, indem die Einheiten je
 * Spur aufeinandergestapelt werden. Dadurch kann durch Verschieben oder
 * Verlaengern keine Ueberschneidung und keine Luecke entstehen, die von Hand
 * repariert werden muesste. Dieselbe Rechnung steht in netlify/js/einheiten.js
 * und wird dort geprueft.
 *
 * DATENSCHUTZ: Hier stehen ausschliesslich Klassenbezeichnungen (3L, 3M …),
 * niemals Kuerzel und niemals Namen. Der Fortschritt haengt an der Klasse als
 * Ganzes, weil Parallelklassen dieselben Einheiten zur selben Zeit bearbeiten.
 */

/** Erlaubte Spuren. '' heisst: noch nicht eingeplant (Vorrat). */
var EINHEIT_SPUREN = ['RS', 'GR', 'BEIDE'];

function findeEinheit_(id) {
  var treffer = liesBlatt_('Einheiten').filter(function (z) { return alsText_(z.id) === id; })[0];
  if (!treffer) throw new Error('Die Unterrichtseinheit wurde nicht gefunden.');
  return treffer;
}

function pruefeSpur_(spur) {
  spur = String(spur || '').trim().toUpperCase();
  if (spur !== '' && EINHEIT_SPUREN.indexOf(spur) === -1) {
    throw new Error('Unbekannte Spur: ' + spur);
  }
  return spur;
}

/**
 * Fehlt die Angabe ganz, gilt eine Woche. Eine ausdrueckliche 0 ist dagegen
 * ein Fehler und wird gemeldet — sonst verschwaende eine vertippte Dauer
 * stillschweigend zu einer Woche.
 */
function pruefeDauer_(dauer) {
  if (dauer === undefined || dauer === null || dauer === '') return 1;
  var n = Number(dauer);
  if (!isFinite(n) || Math.floor(n) !== n || n < 1 || n > 40) {
    throw new Error('Die Dauer muss eine ganze Zahl zwischen 1 und 40 Wochen sein.');
  }
  return n;
}

/** Klassen aus dem Blatt Klassen — der Fortschritt darf nur dorthin zeigen. */
function bekannteKlassen_() {
  var menge = {};
  liesBlatt_('Klassen').forEach(function (z) {
    var k = alsText_(z.klasse);
    if (k) menge[k] = true;
  });
  return menge;
}

/**
 * Legt eine Einheit an. Sie landet am Ende ihrer Spur, damit ein neuer
 * Eintrag den bestehenden Plan nicht verschiebt.
 *
 * `id` kommt vom Client (optimistische Anzeige vor der Serverantwort) und
 * wird uebernommen, falls angegeben — sonst hier erzeugt.
 */
function einheitErstellen(titel, spur, dauer_wochen, id) {
  titel = String(titel || '').trim();
  spur = pruefeSpur_(spur);
  var dauer = pruefeDauer_(dauer_wochen);
  id = String(id || '').trim() || Utilities.getUuid();
  if (!titel) throw new Error('Bitte einen Titel angeben.');

  return mitSperre_(function () {
    var vorhandene = liesBlatt_('Einheiten');
    var naechste = vorhandene.reduce(function (m, z) {
      return Math.max(m, alsZahl_(z.reihenfolge) || 0);
    }, 0) + 1;

    var einheit = {
      id: id, fach: FACH, titel: titel, beschreibung: '',
      reihenfolge: naechste, geplante_stunden: '', lehrplanbezug: '',
      status: 'geplant', aktiv: true, spur: spur, dauer_wochen: dauer
    };
    haengeAn_('Einheiten', [einheit]);
    return { einheit: einheit };
  });
}

/**
 * Aendert die beschreibenden Felder und die Dauer — nicht Spur und
 * Reihenfolge. Die aendert ausschliesslich einheitenReihenfolge().
 */
function einheitAktualisieren(id, titel, beschreibung, lehrplanbezug, dauer_wochen, geplante_stunden) {
  id = String(id || '').trim();
  titel = String(titel || '').trim();
  if (!id) throw new Error('Keine Unterrichtseinheit angegeben.');
  if (!titel) throw new Error('Bitte einen Titel angeben.');
  var dauer = pruefeDauer_(dauer_wochen);

  return mitSperre_(function () {
    var vorhanden = findeEinheit_(id);
    schreibeNachSchluessel_('Einheiten', [{
      id: id, fach: vorhanden.fach, titel: titel,
      beschreibung: String(beschreibung || ''),
      reihenfolge: alsZahl_(vorhanden.reihenfolge) || 0,
      geplante_stunden: geplante_stunden === '' || geplante_stunden === null ||
                        geplante_stunden === undefined ? '' : Number(geplante_stunden),
      lehrplanbezug: String(lehrplanbezug || ''),
      status: alsText_(vorhanden.status) || 'geplant',
      aktiv: true,
      spur: alsText_(vorhanden.spur).toUpperCase(),
      dauer_wochen: dauer
    }], ['id']);
    return { id: id, dauer_wochen: dauer };
  });
}

/**
 * Setzt Spur und Reihenfolge aller uebergebenen Einheiten in einem Zug —
 * das Ergebnis eines Verschiebens im Jahresplan. `saetze` ist die
 * vollstaendige neue Ordnung: [{ id, spur, reihenfolge }].
 *
 * Bewusst gebuendelt statt einzeln: ein Verschieben aendert immer die
 * Reihenfolge mehrerer Einheiten, und ein halb geschriebener Plan waere
 * schlimmer als gar keiner.
 */
function einheitenReihenfolge(saetze) {
  if (!saetze || !saetze.length) throw new Error('Keine Reihenfolge angegeben.');

  return mitSperre_(function () {
    var vorhandene = liesBlatt_('Einheiten');
    var nachId = {};
    vorhandene.forEach(function (z) { nachId[alsText_(z.id)] = z; });

    var zuSchreiben = saetze.map(function (s) {
      var id = String(s.id || '').trim();
      var alt = nachId[id];
      if (!alt) throw new Error('Eine Unterrichtseinheit wurde nicht gefunden.');
      var reihenfolge = Number(s.reihenfolge);
      if (!isFinite(reihenfolge)) throw new Error('Ungültige Reihenfolge.');
      return {
        id: id, fach: alt.fach, titel: alsText_(alt.titel),
        beschreibung: alsText_(alt.beschreibung),
        reihenfolge: reihenfolge,
        geplante_stunden: alsZahl_(alt.geplante_stunden) === null ? '' : alsZahl_(alt.geplante_stunden),
        lehrplanbezug: alsText_(alt.lehrplanbezug),
        status: alsText_(alt.status) || 'geplant',
        aktiv: true,
        spur: pruefeSpur_(s.spur),
        dauer_wochen: alsZahl_(alt.dauer_wochen) || 1
      };
    });

    schreibeNachSchluessel_('Einheiten', zuSchreiben, ['id']);
    return { gespeichert: zuSchreiben.length };
  });
}

/** Loescht eine Einheit samt Teilthemen und deren Fortschritt (Kaskade). */
function einheitLoeschen(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('Keine Unterrichtseinheit angegeben.');

  return mitSperre_(function () {
    var entfernt = loescheNachSchluessel_('Einheiten', ['id'], [[id]]);
    if (!entfernt) throw new Error('Die Unterrichtseinheit wurde nicht gefunden.');

    var themen = liesBlatt_('Teilthemen').filter(function (z) {
      return alsText_(z.einheit_id) === id;
    });
    var themenIds = themen.map(function (z) { return alsText_(z.id); });
    loescheNachSchluessel_('Teilthemen', ['id'], themenIds.map(function (t) { return [t]; }));

    var geloeschterFortschritt = loescheFortschrittZu_(themenIds);
    return { id: id, geloeschteTeilthemen: themenIds.length, geloeschterFortschritt: geloeschterFortschritt };
  });
}

/** Entfernt allen Klassenfortschritt zu den genannten Teilthemen. */
function loescheFortschrittZu_(themenIds) {
  if (!themenIds.length) return 0;
  var menge = {};
  themenIds.forEach(function (t) { menge[t] = true; });

  var betroffen = liesBlatt_('EinheitFortschritt').filter(function (z) {
    return menge[alsText_(z.teilthema_id)];
  });
  return loescheNachSchluessel_('EinheitFortschritt', ['teilthema_id', 'klasse'],
    betroffen.map(function (z) { return [alsText_(z.teilthema_id), alsText_(z.klasse)]; }));
}

/** Neues Teilthema ans Ende der Einheit. */
function teilthemaErstellen(einheit_id, titel, id) {
  einheit_id = String(einheit_id || '').trim();
  titel = String(titel || '').trim();
  id = String(id || '').trim() || Utilities.getUuid();
  if (!einheit_id) throw new Error('Keine Unterrichtseinheit angegeben.');
  if (!titel) throw new Error('Bitte einen Titel angeben.');

  return mitSperre_(function () {
    findeEinheit_(einheit_id); // wirft, falls die Einheit nicht existiert.
    var vorhandene = liesBlatt_('Teilthemen').filter(function (z) {
      return alsText_(z.einheit_id) === einheit_id;
    });
    var naechste = vorhandene.reduce(function (m, z) {
      return Math.max(m, alsZahl_(z.reihenfolge) || 0);
    }, 0) + 1;

    var thema = { id: id, einheit_id: einheit_id, titel: titel, reihenfolge: naechste };
    haengeAn_('Teilthemen', [thema]);
    return { teilthema: thema };
  });
}

function teilthemaUmbenennen(id, titel) {
  id = String(id || '').trim();
  titel = String(titel || '').trim();
  if (!id) throw new Error('Kein Teilthema angegeben.');
  if (!titel) throw new Error('Bitte einen Titel angeben.');

  return mitSperre_(function () {
    var thema = liesBlatt_('Teilthemen').filter(function (z) { return alsText_(z.id) === id; })[0];
    if (!thema) throw new Error('Das Teilthema wurde nicht gefunden.');
    schreibeNachSchluessel_('Teilthemen', [{
      id: id, einheit_id: alsText_(thema.einheit_id), titel: titel,
      reihenfolge: alsZahl_(thema.reihenfolge) || 0
    }], ['id']);
    return { id: id, titel: titel };
  });
}

/** Loescht ein Teilthema samt Fortschritt aller Klassen (Kaskade). */
function teilthemaLoeschen(id) {
  id = String(id || '').trim();
  if (!id) throw new Error('Kein Teilthema angegeben.');

  return mitSperre_(function () {
    var entfernt = loescheNachSchluessel_('Teilthemen', ['id'], [[id]]);
    if (!entfernt) throw new Error('Das Teilthema wurde nicht gefunden.');
    return { id: id, geloeschterFortschritt: loescheFortschrittZu_([id]) };
  });
}

/** `reihenfolge` ist die vollstaendige, neu geordnete Liste der Teilthema-IDs. */
function teilthemenReihenfolge(einheit_id, reihenfolge) {
  einheit_id = String(einheit_id || '').trim();
  if (!einheit_id) throw new Error('Keine Unterrichtseinheit angegeben.');
  if (!reihenfolge || !reihenfolge.length) throw new Error('Keine Reihenfolge angegeben.');

  return mitSperre_(function () {
    var themen = liesBlatt_('Teilthemen').filter(function (z) {
      return alsText_(z.einheit_id) === einheit_id;
    });
    var nachId = {};
    themen.forEach(function (z) { nachId[alsText_(z.id)] = z; });

    var saetze = reihenfolge.map(function (id, i) {
      var t = nachId[String(id)];
      if (!t) throw new Error('Ein Teilthema wurde nicht gefunden.');
      return {
        id: alsText_(t.id), einheit_id: einheit_id,
        titel: alsText_(t.titel), reihenfolge: i + 1
      };
    });
    schreibeNachSchluessel_('Teilthemen', saetze, ['id']);
    return { gespeichert: saetze.length };
  });
}

/**
 * Gebuendeltes Schreiben des Klassenfortschritts — der Client sammelt
 * Aenderungen etwa eine Sekunde lang und schickt sie in einem Rutsch.
 * `erledigt: false` loescht die Zeile (fehlende Zeile heisst „offen"),
 * damit das Blatt nicht mit Negativeintraegen volllaeuft.
 */
function fortschrittSpeichern(aenderungen) {
  if (!aenderungen || !aenderungen.length) return { gespeichert: 0, geloescht: 0 };

  return mitSperre_(function () {
    var klassen = bekannteKlassen_();
    var themen = {};
    liesBlatt_('Teilthemen').forEach(function (z) { themen[alsText_(z.id)] = true; });

    var jetzt = Utilities.formatDate(new Date(), 'Europe/Berlin', 'yyyy-MM-dd');
    var zuSchreiben = [];
    var zuLoeschen = [];

    aenderungen.forEach(function (a) {
      var teilthema_id = String(a.teilthema_id || '').trim();
      var klasse = String(a.klasse || '').trim();
      if (!teilthema_id || !klasse) return;

      if (!themen[teilthema_id]) throw new Error('Unbekanntes Teilthema: ' + teilthema_id);
      if (!klassen[klasse]) throw new Error('Unbekannte Klasse: ' + klasse);

      if (istWahr_(a.erledigt)) {
        zuSchreiben.push({
          teilthema_id: teilthema_id, klasse: klasse, erledigt: true,
          datum: String(a.datum || jetzt).slice(0, 10), notiz: String(a.notiz || '')
        });
      } else {
        zuLoeschen.push([teilthema_id, klasse]);
      }
    });

    var gespeichert = 0, geloescht = 0;
    if (zuSchreiben.length) {
      var r = schreibeNachSchluessel_('EinheitFortschritt', zuSchreiben, ['teilthema_id', 'klasse']);
      gespeichert = r.aktualisiert + r.neu;
    }
    if (zuLoeschen.length) {
      geloescht = loescheNachSchluessel_('EinheitFortschritt', ['teilthema_id', 'klasse'], zuLoeschen);
    }
    return { gespeichert: gespeichert, geloescht: geloescht };
  });
}
