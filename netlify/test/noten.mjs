/**
 * Prueft den Rechenkern des Notentrackers gegen die echten Zahlen aus der
 * bisherigen Numbers-Tabelle („Tracker"). Die 22 Prueffaelle in
 * prueffall-noten.json sind unveraendert aus dieser Tabelle exportiert —
 * Mittelwerte, Gesamtprozent und Note muessen auf die Stelle uebereinstimmen.
 *
 * Braucht keinen Server:  node noten.mjs
 */

import fs from 'fs';
import {
  runde, mittel, mitarbeitMittel, noteFuer, gesamtProzent, werteAus,
  halbjahrVon, schuljahrVon, erhebungenFuer, gewichteFuer, NOTENSCHLUESSEL,
  wochenDesMonats, beteiligungProzent, punkteFuer, beteiligungProzentFuer
} from '../js/noten.js';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

// Die Kategorien und Gewichte, wie sie im Blatt stehen. Assessment und Quiz
// gehoeren beide zur Gruppe TEST, weil die App den Testwert einmal erfasst.
const KATEGORIEN = [
  { id: 'ASSESS', gruppe: 'TEST' },
  { id: 'QUIZ',   gruppe: 'TEST' },
  { id: 'PART',   gruppe: 'PP' },
  { id: 'PRES',   gruppe: 'PP' }
];
const GEWICHTE = { TEST: 0.8, PP: 0.2 };

console.log('=== Rundung: kaufmaennisch aufwaerts, nicht symmetrisch ===');
pruefe('90,5 wird 91 (nicht 90)', runde(90.5), 91);
pruefe('89,5 wird 90', runde(89.5), 90);
pruefe('90,49 wird 90', runde(90.49), 90);
pruefe('90,0 bleibt 90', runde(90), 90);
pruefe('0,5 wird 1', runde(0.5), 1);

console.log('\n=== Mittelwert ===');
pruefe('leere Liste ergibt null, nicht 0', mittel([]), null);
pruefe('nur Luecken ergibt null', mittel([null, undefined, NaN]), null);
pruefe('Luecken zaehlen nicht mit', mittel([80, null, 90]), 85);
pruefe('einzelner Wert', mittel([73]), 73);

console.log('\n=== Mitarbeit: Mittel der beiden Mittelwerte ===');
{
  // Ungleiche Anzahl: Mittel der Mittel (85) ist NICHT das Mittel aller
  // Einzelwerte (86,67) — genau hier weichen die Rechenwege voneinander ab.
  const p = [90, 90];
  const v = [80];
  pruefe('Mittel der Mittelwerte, nicht aller Einzelwerte', mitarbeitMittel(p, v), 85);
  pruefe('Gegenprobe: Mittel aller Einzelwerte waere anders',
    Math.round(mittel([...p, ...v]) * 100) / 100, 86.67);

  pruefe('fehlt eine Saeule, gilt die andere allein', mitarbeitMittel([70, 80], []), 75);
  pruefe('fehlen beide, ergibt null', mitarbeitMittel([], []), null);
}

console.log('\n=== Notenschluessel ===');
pruefe('92 ist eine 1', noteFuer(92), 1);
pruefe('91 ist eine 2 (Grenze)', noteFuer(91), 2);
pruefe('80 ist eine 2', noteFuer(80), 2);
pruefe('79 ist eine 3', noteFuer(79), 3);
pruefe('67 ist eine 3', noteFuer(67), 3);
pruefe('50 ist eine 4', noteFuer(50), 4);
pruefe('23 ist eine 5', noteFuer(23), 5);
pruefe('22 ist eine 6', noteFuer(22), 6);
pruefe('0 ist eine 6', noteFuer(0), 6);
pruefe('100 ist eine 1', noteFuer(100), 1);
pruefe('ohne Prozentwert keine Note', noteFuer(null), null);
pruefe('verdrehter Schluessel liefert trotzdem richtig',
  noteFuer(85, [...NOTENSCHLUESSEL].reverse()), 2);

console.log('\n=== Fehlende Saeule verteilt ihr Gewicht ===');
{
  pruefe('nur Tests vorhanden: Note allein daraus',
    gesamtProzent({ TEST: 80 }, GEWICHTE), 80);
  pruefe('nur Mitarbeit vorhanden: Note allein daraus',
    gesamtProzent({ PP: 60 }, GEWICHTE), 60);
  pruefe('gar nichts vorhanden ergibt null',
    gesamtProzent({}, GEWICHTE), null);
  pruefe('beide vorhanden: gewichtet',
    gesamtProzent({ TEST: 90, PP: 70 }, GEWICHTE), 86);
}

console.log('\n=== Halbjahre (Grenze 31.01.) ===');
pruefe('August liegt im ersten Halbjahr', halbjahrVon('2026-08-15'), 1);
pruefe('31.12. liegt im ersten', halbjahrVon('2026-12-31'), 1);
pruefe('20.01. liegt im ersten', halbjahrVon('2027-01-20'), 1);
pruefe('31.01. ist der letzte Tag des ersten', halbjahrVon('2027-01-31'), 1);
pruefe('01.02. liegt im zweiten', halbjahrVon('2027-02-01'), 2);
pruefe('Juni liegt im zweiten', halbjahrVon('2027-06-30'), 2);
pruefe('Schuljahr: August 2026 gehoert zu 2026', schuljahrVon('2026-08-15'), 2026);
pruefe('Schuljahr: Januar 2027 gehoert noch zu 2026', schuljahrVon('2027-01-20'), 2026);
pruefe('Schuljahr: Juni 2027 gehoert zu 2026', schuljahrVon('2027-06-30'), 2026);

console.log('\n=== Gewichte aus dem Blatt: Assessment + Quiz werden zusammengezogen ===');
{
  const daten = { gruppengewichte: [
    { fach: 'DE', gruppe: 'TEST', gewicht: 0.5 },
    { fach: 'DE', gruppe: 'TEST', gewicht: 0.3 },
    { fach: 'DE', gruppe: 'PP',   gewicht: 0.2 }
  ] };
  pruefe('0,5 + 0,3 ergibt 0,8 fuer Tests', gewichteFuer(daten, 'DE'), { TEST: 0.8, PP: 0.2 });
}

console.log('\n=== Filter auf Kind und Halbjahr ===');
{
  const daten = { erhebungen: [
    { kuerzel: '3L-01', datum: '2026-09-10', kategorie_id: 'ASSESS', wert: 90 },
    { kuerzel: '3L-01', datum: '2027-03-10', kategorie_id: 'ASSESS', wert: 50 },
    { kuerzel: '3L-02', datum: '2026-09-10', kategorie_id: 'ASSESS', wert: 70 }
  ] };
  pruefe('nur das eigene Kind, nur das erste Halbjahr',
    erhebungenFuer(daten, { kuerzel: '3L-01', halbjahr: 1, schuljahr: 2026 }).map((e) => e.wert), [90]);
  pruefe('zweites Halbjahr',
    erhebungenFuer(daten, { kuerzel: '3L-01', halbjahr: 2, schuljahr: 2026 }).map((e) => e.wert), [50]);
  pruefe('ohne Halbjahr: beide',
    erhebungenFuer(daten, { kuerzel: '3L-01' }).map((e) => e.wert), [90, 50]);
}

// --- Der eigentliche Prueffall ----------------------------------------------
//
// 22 Kinder aus der bisherigen Tabelle. Stimmt hier auch nur eine Note nicht,
// rechnet die App anders als das Verfahren, nach dem bisher benotet wurde.

console.log('\n=== Prüffall: 22 Kinder aus der bisherigen Tabelle ===');
{
  const faelle = JSON.parse(fs.readFileSync(new URL('./prueffall-noten.json', import.meta.url)));
  pruefe('22 Prüffälle geladen', faelle.length, 22);

  let abweichungen = 0;
  faelle.forEach((f) => {
    // Die Vorlage fuehrt jeden Test doppelt (Assessment und Quiz mit
    // gleichem Wert) — genau so werden die Erhebungen hier aufgebaut.
    const erhebungen = [
      ...f.assessment.map((w) => ({ kategorie_id: 'ASSESS', wert: w })),
      ...f.quiz.map((w) => ({ kategorie_id: 'QUIZ', wert: w })),
      ...f.participation.map((w) => ({ kategorie_id: 'PART', wert: w })),
      ...f.presentation.map((w) => ({ kategorie_id: 'PRES', wert: w }))
    ];
    const e = werteAus(erhebungen, { kategorien: KATEGORIEN, gewichte: GEWICHTE });
    const passt = e.prozent === f.sollGesamt && e.note === f.sollNote;
    if (!passt) {
      abweichungen++;
      console.log(`      ABWEICHUNG ${f.name}: ${e.prozent}% Note ${e.note} ` +
                  `— Tabelle sagt ${f.sollGesamt}% Note ${f.sollNote}`);
    }
  });
  pruefe('alle 22 stimmen mit der bisherigen Tabelle überein', abweichungen, 0);

  // Punktprobe an einem Fall mit exakt .5 — dort haengt die Note an der
  // Rundungsregel, deshalb hier noch einmal ausdruecklich.
  const halb = faelle.find((f) => {
    const a = mittel(f.assessment), q = mittel(f.quiz);
    const pp = mitarbeitMittel(f.participation, f.presentation);
    return Math.abs((a * 0.5 + q * 0.3 + pp * 0.2) % 1 - 0.5) < 1e-9;
  });
  pruefe('ein Fall liegt auf exakt ,5 (prüft die Rundungsregel scharf)', Boolean(halb), true);
  if (halb) {
    const erhebungen = [
      ...halb.assessment.map((w) => ({ kategorie_id: 'ASSESS', wert: w })),
      ...halb.quiz.map((w) => ({ kategorie_id: 'QUIZ', wert: w })),
      ...halb.participation.map((w) => ({ kategorie_id: 'PART', wert: w })),
      ...halb.presentation.map((w) => ({ kategorie_id: 'PRES', wert: w }))
    ];
    const e = werteAus(erhebungen, { kategorien: KATEGORIEN, gewichte: GEWICHTE });
    pruefe(`  ,5-Fall wird aufgerundet (${e.prozent}%)`, e.prozent, halb.sollGesamt);
  }
}

console.log('\n=== Beteiligung: Wochen eines Monats ===');
{
  // September 2026: Montage am 7., 14., 21. und 28. -> KW 37-40.
  pruefe('vier Montage im September 2026', wochenDesMonats(2026, 9),
    ['2026-W37', '2026-W38', '2026-W39', '2026-W40']);

  // Januar 2027: erster Montag ist der 4. -> KW gehoert bereits zu 2027.
  const wochenJan = wochenDesMonats(2027, 1);
  pruefe('erste Woche im Januar 2027 beginnt mit dem richtigen Jahr',
    wochenJan[0], '2027-W01');
}

console.log('\n=== Beteiligung: Punkteschnitt -> Prozent ===');
{
  pruefe('Schnitt 8,0 wird 80 %', beteiligungProzent([7, 8, 9, 8]), 80);
  pruefe('Schnitt genau auf ,5 wird aufgerundet', beteiligungProzent([7, 8]), 75);
  pruefe('ein einzelner Wert', beteiligungProzent([10]), 100);
  pruefe('keine Punkte ergibt null, nicht 0 %', beteiligungProzent([]), null);
  pruefe('Luecken zaehlen nicht mit', beteiligungProzent([8, null, 8]), 80);
}

console.log('\n=== Beteiligung: Punkte und Prozent eines Kindes ===');
{
  const daten = { beteiligungspunkte: [
    { kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 8 },
    { kuerzel: '3L-01', art: 'MUND', kw: '2026-W38', punkte: 6 },
    { kuerzel: '3L-01', art: 'SCHR', kw: '2026-W37', punkte: 10 },
    { kuerzel: '3L-02', art: 'MUND', kw: '2026-W37', punkte: 2 }
  ] };
  pruefe('Punkte einer bestimmten Woche', punkteFuer(daten, '3L-01', 'MUND', '2026-W37'), 8);
  pruefe('ohne Eintrag null', punkteFuer(daten, '3L-01', 'MUND', '2026-W40'), null);
  pruefe('anderes Kind bleibt unberührt', punkteFuer(daten, '3L-02', 'MUND', '2026-W37'), 2);

  // September 2026 hat vier Wochen (37-40); 3L-01/MUND hat nur in KW37+38
  // Punkte -> Schnitt (8+6)/2=7 -> 70%. KW39/40 fehlen und zaehlen nicht mit.
  pruefe('Monatsprozent aus den vorhandenen Wochen',
    beteiligungProzentFuer(daten, '3L-01', 'MUND', 2026, 9), 70);
  pruefe('andere Art desselben Kindes unabhängig',
    beteiligungProzentFuer(daten, '3L-01', 'SCHR', 2026, 9), 100);
  pruefe('Kind ganz ohne Punkte in dem Monat: null',
    beteiligungProzentFuer(daten, '3L-09', 'MUND', 2026, 9), null);
}

console.log('\n=== Kind ohne jede Erhebung ===');
{
  const e = werteAus([], { kategorien: KATEGORIEN, gewichte: GEWICHTE });
  pruefe('kein Prozentwert', e.prozent, null);
  pruefe('keine Note — nicht etwa eine 6', e.note, null);
}

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
