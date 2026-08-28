/**
 * Prueft die Jahresplan-Logik der Unterrichtseinheiten.
 *
 * Der heikle Teil ist das Stapeln: die Startwoche wird nicht gespeichert,
 * sondern gerechnet. Ein Fehler darin verschoebe stillschweigend den halben
 * Jahresplan, ohne dass irgendwo eine Meldung erschiene.
 *
 *   node einheiten.mjs
 */

import {
  jahresplan, verschiebe, setzeReihenfolgeLokal, einheitInWoche,
  teilthemenFuer, istErledigt, setzeFortschrittLokal,
  fortschrittEinheit, fortschrittKlasse, schulwoche, spurTitel, nachReihenfolge
} from '../js/einheiten.js';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

const einheit = (id, spur, reihenfolge, dauer, titel) =>
  ({ id, spur, reihenfolge, dauer_wochen: dauer, titel: titel || id });

// ---------------------------------------------------------------------------
console.log('=== Stapeln je Spur ===');
{
  const plan = jahresplan([
    einheit('a', 'RS', 1, 2),
    einheit('b', 'RS', 2, 3),
    einheit('c', 'GR', 3, 4)
  ]);
  const w = (id) => { const t = plan.geplant.find((e) => e.id === id); return [t.von, t.bis]; };

  pruefe('erste RS-Einheit beginnt in Woche 1', w('a'), [1, 2]);
  pruefe('zweite RS-Einheit schliesst luecklos an', w('b'), [3, 5]);
  pruefe('die Grammatikspur zaehlt eigenstaendig ab Woche 1', w('c'), [1, 4]);
  pruefe('Gesamtlaenge ist die laengste Spur', plan.wochen, 5);
  pruefe('nichts im Vorrat', plan.vorrat.length, 0);
}

// ---------------------------------------------------------------------------
console.log('\n=== Einheit auf beiden Spuren ===');
{
  const plan = jahresplan([
    einheit('vor', 'BEIDE', 1, 4),
    einheit('rs1', 'RS', 2, 2),
    einheit('gr1', 'GR', 3, 3)
  ]);
  const w = (id) => { const t = plan.geplant.find((e) => e.id === id); return [t.von, t.bis]; };

  pruefe('der Vorspann belegt Woche 1 bis 4', w('vor'), [1, 4]);
  pruefe('Rechtschreibung startet danach', w('rs1'), [5, 6]);
  pruefe('Grammatik ebenfalls danach', w('gr1'), [5, 7]);
}
{
  // Die BEIDE-Einheit muss warten, bis beide Spuren frei sind.
  const plan = jahresplan([
    einheit('rs1', 'RS', 1, 2),
    einheit('gr1', 'GR', 2, 5),
    einheit('quer', 'BEIDE', 3, 1),
    einheit('rs2', 'RS', 4, 2)
  ]);
  const w = (id) => { const t = plan.geplant.find((e) => e.id === id); return [t.von, t.bis]; };

  pruefe('wartet auf die laengere Spur', w('quer'), [6, 6]);
  pruefe('danach laufen beide Spuren wieder gleich', w('rs2'), [7, 8]);
}

// ---------------------------------------------------------------------------
console.log('\n=== Vorrat: Einheiten ohne Spur ===');
{
  const plan = jahresplan([
    einheit('a', 'RS', 1, 2),
    einheit('offen', '', 2, 1),
    einheit('b', 'RS', 3, 2)
  ]);
  pruefe('nicht eingeplante Einheit liegt im Vorrat', plan.vorrat.map((e) => e.id), ['offen']);
  pruefe('sie verschiebt den Plan nicht',
    plan.geplant.find((e) => e.id === 'b').von, 3);
}

// ---------------------------------------------------------------------------
console.log('\n=== Dauer und Fehleingaben ===');
{
  const plan = jahresplan([
    einheit('a', 'RS', 1, 0),
    einheit('b', 'RS', 2, null),
    einheit('c', 'RS', 3, 2)
  ]);
  const w = (id) => { const t = plan.geplant.find((e) => e.id === id); return [t.von, t.bis]; };
  pruefe('Dauer 0 zaehlt als eine Woche', w('a'), [1, 1]);
  pruefe('fehlende Dauer zaehlt als eine Woche', w('b'), [2, 2]);
  pruefe('danach geht es richtig weiter', w('c'), [3, 4]);
}
{
  const plan = jahresplan([]);
  pruefe('leerer Plan hat null Wochen', plan.wochen, 0);
  pruefe('… und keine Einheiten', plan.geplant.length, 0);
}
{
  // Unsortierte Rohdaten duerfen das Ergebnis nicht veraendern.
  const roh = [einheit('b', 'RS', 2, 3), einheit('a', 'RS', 1, 2)];
  const plan = jahresplan(roh);
  pruefe('Reihenfolge entscheidet, nicht die Position im Array',
    plan.geplant.map((e) => e.id), ['a', 'b']);
  pruefe('die Rohdaten bleiben unberuehrt', roh.map((e) => e.id), ['b', 'a']);
  pruefe('nachReihenfolge sortiert ohne zu veraendern',
    nachReihenfolge(roh).map((e) => e.id), ['a', 'b']);
}

// ---------------------------------------------------------------------------
console.log('\n=== einheitInWoche ===');
{
  const plan = jahresplan([
    einheit('vor', 'BEIDE', 1, 2),
    einheit('rs1', 'RS', 2, 3),
    einheit('gr1', 'GR', 3, 1)
  ]);
  pruefe('Woche 1 liegt im Vorspann (RS)', einheitInWoche(plan, 'RS', 1).id, 'vor');
  pruefe('Woche 1 liegt im Vorspann (GR)', einheitInWoche(plan, 'GR', 1).id, 'vor');
  pruefe('Woche 3 ist die erste RS-Einheit', einheitInWoche(plan, 'RS', 3).id, 'rs1');
  pruefe('Woche 5 ist die letzte RS-Woche', einheitInWoche(plan, 'RS', 5).id, 'rs1');
  pruefe('Woche 6 ist frei', einheitInWoche(plan, 'RS', 6), null);
  pruefe('die Grammatikspur endet frueher', einheitInWoche(plan, 'GR', 4), null);
}

// ---------------------------------------------------------------------------
console.log('\n=== Verschieben ===');
{
  const roh = [
    einheit('a', 'RS', 1, 2),
    einheit('b', 'RS', 2, 2),
    einheit('c', 'RS', 3, 2)
  ];
  const saetze = verschiebe(roh, 'c', 'RS', 'a');
  pruefe('c wird vor a einsortiert', saetze.map((s) => s.id), ['c', 'a', 'b']);
  pruefe('durchnummeriert ohne Luecken', saetze.map((s) => s.reihenfolge), [1, 2, 3]);

  const daten = { einheiten: roh.map((e) => ({ ...e })) };
  setzeReihenfolgeLokal(daten, saetze);
  const plan = jahresplan(daten.einheiten);
  pruefe('nach dem Verschieben beginnt c in Woche 1',
    plan.geplant.find((e) => e.id === 'c').von, 1);
  pruefe('a rueckt nach hinten',
    plan.geplant.find((e) => e.id === 'a').von, 3);
}
{
  // Spurwechsel: eine Grammatikeinheit wandert in die Rechtschreibspur.
  const roh = [
    einheit('rs1', 'RS', 1, 2),
    einheit('gr1', 'GR', 2, 2),
    einheit('gr2', 'GR', 3, 2)
  ];
  const saetze = verschiebe(roh, 'gr2', 'RS', null);
  const daten = { einheiten: roh.map((e) => ({ ...e })) };
  setzeReihenfolgeLokal(daten, saetze);
  const plan = jahresplan(daten.einheiten);
  const gr2 = plan.geplant.find((e) => e.id === 'gr2');
  pruefe('gr2 liegt jetzt auf der Rechtschreibspur', gr2.spur, 'RS');
  pruefe('… und schliesst dort an rs1 an', [gr2.von, gr2.bis], [3, 4]);
  pruefe('die Grammatikspur bleibt unberuehrt',
    plan.geplant.find((e) => e.id === 'gr1').von, 1);
}
{
  // Ans Ende einer Spur, obwohl die andere Spur laenger ist: die Einheit
  // muss hinter der letzten Einheit IHRER Spur landen, nicht hinter allem.
  const roh = [
    einheit('rs1', 'RS', 1, 2),
    einheit('gr1', 'GR', 2, 2),
    einheit('gr2', 'GR', 3, 2),
    einheit('frei', '', 4, 1)
  ];
  const saetze = verschiebe(roh, 'frei', 'RS', null);
  const daten = { einheiten: roh.map((e) => ({ ...e })) };
  setzeReihenfolgeLokal(daten, saetze);
  const plan = jahresplan(daten.einheiten);
  pruefe('aus dem Vorrat ans Ende der Rechtschreibspur',
    [plan.geplant.find((e) => e.id === 'frei').von, plan.geplant.find((e) => e.id === 'frei').bis],
    [3, 3]);
}
{
  // Zurueck in den Vorrat.
  const roh = [einheit('a', 'RS', 1, 2), einheit('b', 'RS', 2, 2)];
  const saetze = verschiebe(roh, 'a', '', null);
  const daten = { einheiten: roh.map((e) => ({ ...e })) };
  setzeReihenfolgeLokal(daten, saetze);
  const plan = jahresplan(daten.einheiten);
  pruefe('a liegt wieder im Vorrat', plan.vorrat.map((e) => e.id), ['a']);
  pruefe('b rueckt auf Woche 1 vor',
    plan.geplant.find((e) => e.id === 'b').von, 1);
}
{
  const roh = [einheit('a', 'RS', 1, 2)];
  pruefe('unbekannte Einheit liefert nichts', verschiebe(roh, 'gibtsnicht', 'RS', null), null);
}

// ---------------------------------------------------------------------------
console.log('\n=== Teilthemen und Fortschritt ===');
const daten = {
  einheiten: [einheit('e1', 'RS', 1, 2), einheit('e2', 'GR', 2, 2), einheit('e3', '', 3, 1)],
  teilthemen: [
    { id: 't3', einheit_id: 'e1', titel: 'Drittens', reihenfolge: 3 },
    { id: 't1', einheit_id: 'e1', titel: 'Erstens', reihenfolge: 1 },
    { id: 't2', einheit_id: 'e1', titel: 'Zweitens', reihenfolge: 2 },
    { id: 't4', einheit_id: 'e2', titel: 'Anderes', reihenfolge: 1 },
    { id: 't5', einheit_id: 'e3', titel: 'Im Vorrat', reihenfolge: 1 }
  ],
  einheitFortschritt: []
};

pruefe('Teilthemen kommen sortiert', teilthemenFuer(daten, 'e1').map((t) => t.id), ['t1', 't2', 't3']);
pruefe('fremde Teilthemen bleiben draussen', teilthemenFuer(daten, 'e2').map((t) => t.id), ['t4']);
pruefe('ohne Eintrag gilt offen', istErledigt(daten, 't1', '3L'), false);
pruefe('Fortschritt zu Beginn null Prozent', fortschrittEinheit(daten, 'e1', '3L').prozent, 0);

setzeFortschrittLokal(daten, 't1', '3L', true, '2026-09-01');
pruefe('nach dem Abhaken erledigt', istErledigt(daten, 't1', '3L'), true);
pruefe('die andere Klasse bleibt offen', istErledigt(daten, 't1', '3M'), false);
pruefe('ein von drei Teilthemen', fortschrittEinheit(daten, 'e1', '3L').erledigt, 1);
pruefe('gerundet 33 Prozent', fortschrittEinheit(daten, 'e1', '3L').prozent, 33);

setzeFortschrittLokal(daten, 't2', '3L', true, '2026-09-02');
pruefe('zwei von drei sind 67 Prozent', fortschrittEinheit(daten, 'e1', '3L').prozent, 67);

setzeFortschrittLokal(daten, 't1', '3L', false);
pruefe('Zuruecknehmen entfernt den Eintrag', istErledigt(daten, 't1', '3L'), false);
pruefe('… und laesst keine Leiche zurueck',
  daten.einheitFortschritt.filter((f) => f.teilthema_id === 't1').length, 0);

pruefe('Einheit ohne Teilthemen hat keinen Prozentwert',
  fortschrittEinheit({ ...daten, teilthemen: [] }, 'e1', '3L').prozent, null);

// Klassenfortschritt zaehlt nur eingeplante Einheiten — der Vorrat bleibt aussen vor.
pruefe('Klassenfortschritt zaehlt vier eingeplante Teilthemen',
  fortschrittKlasse(daten, '3L').gesamt, 4);
pruefe('ein Teilthema erledigt', fortschrittKlasse(daten, '3L').erledigt, 1);
pruefe('das sind 25 Prozent', fortschrittKlasse(daten, '3L').prozent, 25);
pruefe('andere Klasse noch bei null', fortschrittKlasse(daten, '3M').prozent, 0);
pruefe('ganz ohne Teilthemen kein Prozentwert',
  fortschrittKlasse({ einheiten: [], teilthemen: [], einheitFortschritt: [] }, '3L').prozent, null);

// ---------------------------------------------------------------------------
console.log('\n=== Schulwoche ===');
const tag = (iso) => {
  const [jahr, monat, t] = iso.split('-').map(Number);
  return { jahr, monat, tag: t };
};
pruefe('Beginn ist Woche 1', schulwoche(tag('2026-08-17'), '2026-08-17'), 1);
pruefe('derselbe Freitag noch Woche 1', schulwoche(tag('2026-08-21'), '2026-08-17'), 1);
pruefe('die Woche darauf ist Woche 2', schulwoche(tag('2026-08-24'), '2026-08-17'), 2);
pruefe('acht Wochen spaeter', schulwoche(tag('2026-10-12'), '2026-08-17'), 9);
pruefe('ueber den Jahreswechsel', schulwoche(tag('2027-01-11'), '2026-08-17'), 22);
pruefe('vor dem Beginn wird negativ gezaehlt', schulwoche(tag('2026-08-10'), '2026-08-17'), 0);
pruefe('ohne Schuljahresbeginn keine Zaehlung', schulwoche(tag('2026-10-12'), ''), null);
pruefe('unbrauchbare Angabe zaehlt ebenfalls nicht', schulwoche(tag('2026-10-12'), 'August'), null);

// ---------------------------------------------------------------------------
console.log('\n=== Spurbezeichnungen ===');
pruefe('RS', spurTitel('RS'), 'Rechtschreibung');
pruefe('GR', spurTitel('GR'), 'Grammatik');
pruefe('BEIDE', spurTitel('BEIDE'), 'Beide Spuren');
pruefe('ohne Spur', spurTitel(''), 'Nicht eingeplant');

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
