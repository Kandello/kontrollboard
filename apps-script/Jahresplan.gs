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
 * wo geblaettert wird. „gruen" ist „Richtig schreiben", „pink" ist
 * „Sprache untersuchen" — so, wie die Hefte im Unterricht genannt werden.
 * Die Spur heisst weiterhin RS bzw. GR; das steht nur in der Tabelle.
 */
var JAHRESPLAN = [
  ['Wortarten wiederholen und vertiefen', 'BEIDE', 4, [
    'Merkheftchen Nomen basteln',
    'Merkheftchen Verben basteln',
    'Merkheftchen Adjektive basteln',
    'Nomen: Mehrzahl bilden und erkennen (pink, S. 12–15)',
    'Verben: Grundform und Personalformen (pink, S. 16–19)',
    'Adjektive: Grundform und Vergleichsstufen (pink, S. 24–26)',
    'Wiederholung für den Test'
  ]],

  // --- Rechtschreibung, grünes Heft ----------------------------------------
  ['Mit dem Alphabet und der Wörterliste arbeiten', 'RS', 2, [
    'Nach dem 2. und 3. Buchstaben ordnen (grün, S. 10)',
    'Wörter nachschlagen (grün, S. 11)'
  ]],
  ['Wörter mit einfachen und doppelten Mitlauten', 'RS', 2, [
    'Einfache und doppelte Mitlaute unterscheiden (grün, S. 12–13)',
    'Wörter mit einfachen und doppelten Mitlauten üben (grün, S. 14)'
  ]],
  ['Wörter mit ck und tz schreiben', 'RS', 2, [
    'ck und tz schreiben (grün, S. 16–17)',
    'Wörter mit ck und tz üben (grün, S. 18)'
  ]],
  ['Verlängern: Auslaute hörbar machen', 'RS', 2, [
    'Verben verlängern (grün, S. 21)',
    'Adjektive verlängern (grün, S. 22)',
    'Verlängern üben (grün, S. 23)'
  ]],
  ['Wörter mit i und ie schreiben', 'RS', 2, [
    'i und ie unterscheiden (grün, S. 24–25)',
    'Wörter mit i und ie üben (grün, S. 26)'
  ]],
  ['Wörter mit ä und äu ableiten', 'RS', 2, [
    'ä und äu ableiten (grün, S. 28–29)',
    'Ableiten üben (grün, S. 30)'
  ]],
  ['Wiederholung und Puffer (1. Halbjahr)', 'RS', 2, [
    'Wiederholung vor dem Halbjahresende',
    'Puffer für ausgefallene Stunden'
  ]],
  ['Merkwörter mit Dehnungs-h', 'RS', 3, [
    'Dehnungs-h kennenlernen (grün, S. 32–33)',
    'oh/öh, uh/üh und eh üben (grün, S. 34)',
    'ah/äh üben (grün, S. 35)',
    'ih/lh üben (grün, S. 36)',
    'Dehnungs-h üben (grün, S. 37)'
  ]],
  ['Merkwörter mit Y, V und x', 'RS', 2, [
    'Merkwörter mit Y/y üben (grün, S. 39)',
    'Merkwörter mit V/v üben (grün, S. 40)',
    'Merkwörter mit x üben (grün, S. 41)'
  ]],
  ['Wortstämme in Wortfamilien erkennen', 'RS', 2, [
    'Wortstämme mit ck schreiben (grün, S. 43)',
    'Wortstämme mit a/ä und au/äu schreiben (grün, S. 44)',
    'Wörter aus Wortfamilien üben (grün, S. 45)'
  ]],
  ['Nomen mit Wortbausteinen großschreiben', 'RS', 2, [
    'Nomen mit -heit und -keit (grün, S. 47)',
    'Nomen mit -ung (grün, S. 48)',
    'Nomen mit Wortbausteinen üben (grün, S. 49)'
  ]],
  ['Merkwörter mit langen Selbstlauten', 'RS', 2, [
    'Merkwörter mit aa, ee, oo üben (grün, S. 51)',
    'Merkwörter mit i, -in und -ine üben (grün, S. 52)',
    'Merkwörter mit langen Selbstlauten üben (grün, S. 53)'
  ]],
  ['Wörter mit ß und ss unterscheiden', 'RS', 2, [
    'Verben und Adjektive mit ß und ss üben (grün, S. 56)',
    'Wörter mit ß und ss erkennen (grün, S. 57)'
  ]],
  ['Rechtschreibgespräche und Strategien (nachrangig)', 'RS', 2, [
    'Rechtschreibstrategien nutzen 1 (grün, S. 59)',
    'Rechtschreibstrategien nutzen 2 (grün, S. 60)',
    'Rechtschreibgespräche in der Gruppe führen (grün, S. 61)',
    'Einen Text mit Strategien verbessern (grün, S. 62)'
  ]],
  ['Puffer und Jahresabschluss (Rechtschreibung)', 'RS', 2, [
    'Wiederholung',
    'Puffer für ausgefallene Stunden'
  ]],

  // --- Grammatik, pinkes Heft ----------------------------------------------
  ['Nomen zusammensetzen', 'GR', 3, [
    'Zusammengesetzte Nomen bilden (pink, S. 9)',
    'Nomen mit n oder s verbinden (pink, S. 10)',
    'Zusammengesetzte Nomen untersuchen (pink, S. 11)'
  ]],
  ['Wortbausteine vor Verben setzen', 'GR', 3, [
    'Verben mit Wortbausteinen bilden (pink, S. 21)',
    'Verben mit Wortbausteinen trennen (pink, S. 22)',
    'Verben mit ver- und vor- gebrauchen (pink, S. 23)'
  ]],
  ['Wörtliche Rede und Satzzeichen verwenden', 'GR', 4, [
    'Begleitsätze ergänzen und zuordnen (pink, S. 29)',
    'Redezeichen und Satzzeichen setzen (pink, S. 30)',
    'Wörtliche Rede in Texten verwenden (pink, S. 31)'
  ]],
  ['Wortfelder erkennen', 'GR', 3, [
    'Verben nach Wortfeldern ordnen (pink, S. 33)',
    'Verben aus Wortfeldern verwenden (pink, S. 34)',
    'Oberbegriffe und Wortfelder verwenden (pink, S. 35)'
  ]],
  ['Puffer (Halbjahreswechsel)', 'GR', 1, [
    'Puffer für ausgefallene Stunden'
  ]],
  ['Nomen durch Adjektive erkennen', 'GR', 3, [
    'Nomen für Gefühle und Zustände erkennen (pink, S. 38)',
    'Nomen für Zeiten erkennen (pink, S. 39)',
    'Nomen erkennen (pink, S. 40)'
  ]],
  ['Präsens und Präteritum kennenlernen', 'GR', 6, [
    'Regelmäßige Verben im Präteritum bilden (pink, S. 43)',
    'Unregelmäßige Verben im Präteritum bilden (pink, S. 44)',
    'Präsens und Präteritum erkennen (pink, S. 45)',
    'sein im Präsens und Präteritum bilden (pink, S. 46)',
    'Texte im Präteritum schreiben (pink, S. 47)'
  ]],
  ['Satzglieder: Prädikat und Subjekt', 'GR', 5, [
    'Sätze bilden und umstellen (pink, S. 50)',
    'Prädikate erkennen und einsetzen (pink, S. 51)',
    'Subjekte erkennen und einsetzen (pink, S. 52)',
    'Prädikate und Subjekte unterscheiden (pink, S. 53)',
    'Adjektive: Gleiches und Unterschiedliches ausdrücken (pink, S. 27)'
  ]],
  ['Sprache erforschen (nachrangig)', 'GR', 2, [
    'Mit mehrdeutigen Wörtern spielen (pink, S. 55)',
    'Redewendungen verstehen (pink, S. 56)',
    'Abkürzungen kennenlernen (pink, S. 57)',
    'Sprache in Textnachrichten untersuchen (pink, S. 58)',
    'Wörter aus anderen Sprachen verstehen (pink, S. 59)',
    'Sprachen vergleichen (pink, S. 60)'
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

/**
 * Wirft den bestehenden Plan weg und traegt ihn neu ein. Gedacht fuer den
 * Fall, dass sich die Vorlage geaendert hat — etwa weil ein Thema an eine
 * andere Stelle gehoert. Der abgehakte Klassenfortschritt geht dabei
 * verloren, deshalb fragt der Menuepunkt vorher nach.
 */
function jahresplanZuruecksetzen() {
  return mitSperre_(function () {
    ['Einheiten', 'Teilthemen', 'EinheitFortschritt'].forEach(function (name) {
      var blatt = holeBlatt_(name);
      if (blatt.getLastRow() > 1) {
        blatt.getRange(2, 1, blatt.getLastRow() - 1, SCHEMA[name].length).clearContent();
      }
    });
    return jahresplanEinfuegen();
  });
}

function menueJahresplanZuruecksetzen() {
  var ui = SpreadsheetApp.getUi();
  var antwort = ui.alert('Jahresplan zurücksetzen',
    'Der bestehende Jahresplan wird gelöscht und durch die aktuelle Vorlage ersetzt.\n\n' +
    'Achtung: Alle abgehakten Teilthemen aller Klassen gehen dabei verloren. ' +
    'Notentracker und Checklisten bleiben unberührt.\n\nFortfahren?',
    ui.ButtonSet.YES_NO);
  if (antwort !== ui.Button.YES) return;

  var b = jahresplanZuruecksetzen();
  ui.alert('Jahresplan erneuert',
    b.einheiten + ' Unterrichtseinheiten und ' + b.teilthemen + ' Teilthemen angelegt.',
    ui.ButtonSet.OK);
}
