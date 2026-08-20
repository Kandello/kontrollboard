/**
 * Merkliste.gs — persoenliche Merklisten der Lehrkraft: To-Dos, Deadlines,
 * Termine. Eigenes Blatt, aber dieselbe Verwaltung fuer alle drei Arten,
 * weil sie sich nur in ein paar Regeln unterscheiden (Sortierung,
 * Pflichtfeld Datum, rotes Ausrufezeichen), nicht im Datenmodell.
 *
 * Kein Bezug zu Schuelerdaten — hier steht nie ein Kuerzel.
 */

/** Reihenfolge ist absichtlich ohne Bedeutung; nur zur Gueltigkeitspruefung. */
var MERKLISTE_TYPEN = ['TODO', 'DEADLINE', 'EVENT'];

/**
 * Legt einen Eintrag an. `id` kommt vom Client (optimistische Anzeige vor
 * der Serverantwort) und wird uebernommen, falls angegeben — sonst hier
 * erzeugt, wie bei boardErstellen.
 */
function merklisteHinzufuegen(typ, text, datum, uhrzeit, id) {
  typ = String(typ || '').trim().toUpperCase();
  text = String(text || '').trim();
  datum = String(datum || '').trim();
  uhrzeit = String(uhrzeit || '').trim();
  id = String(id || '').trim() || Utilities.getUuid();

  if (MERKLISTE_TYPEN.indexOf(typ) === -1) throw new Error('Unbekannte Art von Eintrag.');
  if (!text) throw new Error('Bitte einen Text angeben.');
  if (typ === 'EVENT' && !datum) throw new Error('Ein Termin braucht ein Datum.');
  if (datum && !/^\d{4}-\d{2}-\d{2}$/.test(datum)) throw new Error('Ungültiges Datum.');
  if (uhrzeit && !/^\d{2}:\d{2}$/.test(uhrzeit)) throw new Error('Ungültige Uhrzeit.');

  return mitSperre_(function () {
    var eintrag = {
      id: id, fach: FACH, typ: typ, text: text, datum: datum, uhrzeit: uhrzeit,
      erledigt: false,
      erstellt_am: Utilities.formatDate(new Date(), 'Europe/Berlin', "yyyy-MM-dd'T'HH:mm:ss")
    };
    haengeAn_('Merkliste', [eintrag]);
    return { eintrag: eintrag };
  });
}

/** Hakt einen Eintrag ab oder macht das rueckgaengig — sonst nichts editierbar. */
function merklisteErledigt(id, erledigt) {
  id = String(id || '').trim();
  if (!id) throw new Error('Kein Eintrag angegeben.');

  return mitSperre_(function () {
    var vorhanden = liesBlatt_('Merkliste').filter(function (z) { return alsText_(z.id) === id; })[0];
    if (!vorhanden) throw new Error('Der Eintrag wurde nicht gefunden.');

    schreibeNachSchluessel_('Merkliste', [{
      id: id, fach: vorhanden.fach, typ: vorhanden.typ, text: vorhanden.text,
      datum: vorhanden.datum, uhrzeit: vorhanden.uhrzeit,
      erledigt: Boolean(erledigt), erstellt_am: vorhanden.erstellt_am
    }], ['id']);
    return { id: id, erledigt: Boolean(erledigt) };
  });
}
