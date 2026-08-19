/**
 * Jahresplan.gs — die vorbereitete Startbelegung der Unterrichtseinheiten.
 *
 * Bewusst NICHT in Setup.gs und nicht in die automatische Vorbelegung:
 * Setup.gs soll frei von Lehrwerksinhalten bleiben, damit eine Kopie der
 * Tabelle auch an Kolleg:innen mit anderem Material weitergereicht werden
 * kann (Abschnitt 15). Dieser Plan gehoert zu „Flex und Flora 3" und wird
 * deshalb nur auf ausdruecklichen Aufruf eingetragen:
 * Menue „Kommandozentrale → Jahresplan einfügen".
 *
 * Der Plan folgt der mit der Lehrkraft abgestimmten Jahresverteilung:
 * vier Wochen Wortarten-Wiederholung auf beiden Spuren, danach
 * Rechtschreibung und Grammatik nebeneinander. Die Wochenangaben stehen
 * NICHT in der Tabelle — sie ergeben sich aus Spur, Reihenfolge und Dauer
 * (siehe Einheiten.gs). Wer den Plan umstellt, verschiebt die Boxen in der
 * Oberflaeche; hier muss dafuer nichts geaendert werden.
 *
 * Ein zweiter Aufruf schreibt nichts: der Plan wird nur in ein leeres Blatt
 * eingetragen, damit eigene Aenderungen niemals ueberschrieben werden.
 */

/**
 * [titel, spur, dauer_wochen, [teilthemen …]]
 *
 * Die Seitenzahlen stehen im Teilthema, damit im Unterricht sofort klar ist,
 * wo geblaettert wird. „RS" ist das gruene Heft (Richtig schreiben),
 * „GR" das pinke (Sprache untersuchen).
 */
var JAHRESPLAN = [
  ['Wortarten wiederholen und vertiefen', 'BEIDE', 4, [
    'Merkheftchen Nomen basteln',
    'Merkheftchen Verben basteln',
    'Merkheftchen Adjektive basteln',
    'Nomen zusammensetzen (GR 8–11)',
    'Verben: Grundform und Personalformen (GR 16–19)',
    'Adjektive: Grundform und Vergleichsstufen (GR 24–26)',
    'Wiederholung für den Test'
  ]],

  // --- Rechtschreibung, grünes Heft ----------------------------------------
  ['Mit dem Alphabet und der Wörterliste arbeiten', 'RS', 2, [
    'Nach dem 2. und 3. Buchstaben ordnen (RS 10)',
    'Wörter nachschlagen (RS 11)'
  ]],
  ['Wörter mit einfachen und doppelten Mitlauten', 'RS', 2, [
    'Einfache und doppelte Mitlaute unterscheiden (RS 12–13)',
    'Wörter mit einfachen und doppelten Mitlauten üben (RS 14)'
  ]],
  ['Wörter mit ck und tz schreiben', 'RS', 2, [
    'ck und tz schreiben (RS 16–17)',
    'Wörter mit ck und tz üben (RS 18)'
  ]],
  ['Verlängern: Auslaute hörbar machen', 'RS', 2, [
    'Verben verlängern (RS 21)',
    'Adjektive verlängern (RS 22)',
    'Verlängern üben (RS 23)'
  ]],
  ['Wörter mit i und ie schreiben', 'RS', 2, [
    'i und ie unterscheiden (RS 24–25)',
    'Wörter mit i und ie üben (RS 26)'
  ]],
  ['Wörter mit ä und äu ableiten', 'RS', 2, [
    'ä und äu ableiten (RS 28–29)',
    'Ableiten üben (RS 30)'
  ]],
  ['Wiederholung und Puffer (1. Halbjahr)', 'RS', 2, [
    'Wiederholung vor dem Halbjahresende',
    'Puffer für ausgefallene Stunden'
  ]],
  ['Merkwörter mit Dehnungs-h', 'RS', 3, [
    'Dehnungs-h kennenlernen (RS 32–33)',
    'oh/öh, uh/üh und eh üben (RS 34)',
    'ah/äh üben (RS 35)',
    'ih/lh üben (RS 36)',
    'Dehnungs-h üben (RS 37)'
  ]],
  ['Merkwörter mit Y, V und x', 'RS', 2, [
    'Merkwörter mit Y/y üben (RS 39)',
    'Merkwörter mit V/v üben (RS 40)',
    'Merkwörter mit x üben (RS 41)'
  ]],
  ['Wortstämme in Wortfamilien erkennen', 'RS', 2, [
    'Wortstämme mit ck schreiben (RS 43)',
    'Wortstämme mit a/ä und au/äu schreiben (RS 44)',
    'Wörter aus Wortfamilien üben (RS 45)'
  ]],
  ['Nomen mit Wortbausteinen großschreiben', 'RS', 2, [
    'Nomen mit -heit und -keit (RS 47)',
    'Nomen mit -ung (RS 48)',
    'Nomen mit Wortbausteinen üben (RS 49)'
  ]],
  ['Merkwörter mit langen Selbstlauten', 'RS', 2, [
    'Merkwörter mit aa, ee, oo üben (RS 51)',
    'Merkwörter mit i, -in und -ine üben (RS 52)',
    'Merkwörter mit langen Selbstlauten üben (RS 53)'
  ]],
  ['Wörter mit ß und ss unterscheiden', 'RS', 2, [
    'Verben und Adjektive mit ß und ss üben (RS 56)',
    'Wörter mit ß und ss erkennen (RS 57)'
  ]],
  ['Rechtschreibgespräche und Strategien (nachrangig)', 'RS', 2, [
    'Rechtschreibstrategien nutzen 1 (RS 59)',
    'Rechtschreibstrategien nutzen 2 (RS 60)',
    'Rechtschreibgespräche in der Gruppe führen (RS 61)',
    'Einen Text mit Strategien verbessern (RS 62)'
  ]],
  ['Puffer und Jahresabschluss (Rechtschreibung)', 'RS', 2, [
    'Wiederholung',
    'Puffer für ausgefallene Stunden'
  ]],

  // --- Grammatik, pinkes Heft ----------------------------------------------
  ['Nomen in der Mehrzahl bilden', 'GR', 3, [
    'Die Mehrzahl bilden (GR 14)',
    'Die Mehrzahl erkennen (GR 15)'
  ]],
  ['Wortbausteine vor Verben setzen', 'GR', 3, [
    'Verben mit Wortbausteinen bilden (GR 21)',
    'Verben mit Wortbausteinen trennen (GR 22)',
    'Verben mit ver- und vor- gebrauchen (GR 23)'
  ]],
  ['Wörtliche Rede und Satzzeichen verwenden', 'GR', 4, [
    'Begleitsätze ergänzen und zuordnen (GR 29)',
    'Redezeichen und Satzzeichen setzen (GR 30)',
    'Wörtliche Rede in Texten verwenden (GR 31)'
  ]],
  ['Wortfelder erkennen', 'GR', 3, [
    'Verben nach Wortfeldern ordnen (GR 33)',
    'Verben aus Wortfeldern verwenden (GR 34)',
    'Oberbegriffe und Wortfelder verwenden (GR 35)'
  ]],
  ['Puffer (Halbjahreswechsel)', 'GR', 1, [
    'Puffer für ausgefallene Stunden'
  ]],
  ['Nomen durch Adjektive erkennen', 'GR', 3, [
    'Nomen für Gefühle und Zustände erkennen (GR 38)',
    'Nomen für Zeiten erkennen (GR 39)',
    'Nomen erkennen (GR 40)'
  ]],
  ['Präsens und Präteritum kennenlernen', 'GR', 6, [
    'Regelmäßige Verben im Präteritum bilden (GR 43)',
    'Unregelmäßige Verben im Präteritum bilden (GR 44)',
    'Präsens und Präteritum erkennen (GR 45)',
    'sein im Präsens und Präteritum bilden (GR 46)',
    'Texte im Präteritum schreiben (GR 47)'
  ]],
  ['Satzglieder: Prädikat und Subjekt', 'GR', 5, [
    'Sätze bilden und umstellen (GR 50)',
    'Prädikate erkennen und einsetzen (GR 51)',
    'Subjekte erkennen und einsetzen (GR 52)',
    'Prädikate und Subjekte unterscheiden (GR 53)',
    'Adjektive: Gleiches und Unterschiedliches ausdrücken (GR 27)'
  ]],
  ['Sprache erforschen (nachrangig)', 'GR', 2, [
    'Mit mehrdeutigen Wörtern spielen (GR 55)',
    'Redewendungen verstehen (GR 56)',
    'Abkürzungen kennenlernen (GR 57)',
    'Sprache in Textnachrichten untersuchen (GR 58)',
    'Wörter aus anderen Sprachen verstehen (GR 59)',
    'Sprachen vergleichen (GR 60)'
  ]],
  ['Puffer und Jahresabschluss (Grammatik)', 'GR', 2, [
    'Wiederholung',
    'Puffer für ausgefallene Stunden'
  ]]
];

/**
 * Traegt den Plan ein — aber nur, wenn im Blatt Einheiten noch nichts steht.
 * Liefert einen Bericht statt zu werfen, damit der Menuepunkt auch beim
 * zweiten Klick eine verstaendliche Antwort gibt.
 */
function jahresplanEinfuegen() {
  return mitSperre_(function () {
    if (liesBlatt_('Einheiten').length) {
      return { eingetragen: false, grund: 'Im Blatt „Einheiten" stehen bereits Zeilen.' };
    }

    var einheiten = [];
    var themen = [];

    JAHRESPLAN.forEach(function (eintrag, i) {
      var id = 'E' + ('0' + (i + 1)).slice(-2);
      einheiten.push({
        id: id, fach: FACH, titel: eintrag[0], beschreibung: '',
        reihenfolge: i + 1, geplante_stunden: '', lehrplanbezug: '',
        status: 'geplant', aktiv: true, spur: eintrag[1], dauer_wochen: eintrag[2]
      });

      eintrag[3].forEach(function (titel, t) {
        themen.push({
          id: id + '-' + ('0' + (t + 1)).slice(-2),
          einheit_id: id, titel: titel, reihenfolge: t + 1
        });
      });
    });

    haengeAn_('Einheiten', einheiten);
    haengeAn_('Teilthemen', themen);
    return { eingetragen: true, einheiten: einheiten.length, teilthemen: themen.length };
  });
}

function menueJahresplan() {
  var ui = SpreadsheetApp.getUi();
  var b = jahresplanEinfuegen();
  if (!b.eingetragen) {
    ui.alert('Jahresplan nicht eingetragen',
      b.grund + '\n\nDamit nichts verloren geht, wird nur ein leeres Blatt befüllt. ' +
      'Soll der vorbereitete Plan wirklich hinein, zuerst die Datenzeilen in „Einheiten" ' +
      'und „Teilthemen" löschen.', ui.ButtonSet.OK);
    return;
  }
  ui.alert('Jahresplan eingetragen',
    b.einheiten + ' Unterrichtseinheiten und ' + b.teilthemen + ' Teilthemen angelegt.\n\n' +
    'Die Wochen ergeben sich aus Spur, Reihenfolge und Dauer — verschieben lässt sich ' +
    'alles in der Weboberfläche unter „Einheiten".', ui.ButtonSet.OK);
}
