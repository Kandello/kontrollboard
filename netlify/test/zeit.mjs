/**
 * Prueft die Wochen- und Zeitlogik.
 *
 * Die ISO-Kalenderwoche ist der Teil, bei dem ein Fehler still bleibt und
 * sich erst Monate spaeter zeigt — etwa wenn zum Jahreswechsel eine
 * erledigte Aufgabe ploetzlich wieder als offen erscheint.
 *
 *   node zeit.mjs
 */

import {
  heute, uhrzeit, wochentag, wochentagName, istWochenende,
  isoWoche, kwKennung, alsMinuten, alsIso, alsDeutsch, istErstesHalbjahr
} from '../js/zeit.js';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

const tag = (iso) => {
  const [jahr, monat, t] = iso.split('-').map(Number);
  return { jahr, monat, tag: t };
};

console.log('=== ISO-Kalenderwoche, Normalfaelle ===');
pruefe('2026-08-17 (Montag) ist KW 34', kwKennung(tag('2026-08-17')), '2026-W34');
pruefe('2026-08-23 (Sonntag) noch KW 34', kwKennung(tag('2026-08-23')), '2026-W34');
pruefe('2026-08-24 (Montag) ist KW 35', kwKennung(tag('2026-08-24')), '2026-W35');
pruefe('2026-01-01 ist KW 1', kwKennung(tag('2026-01-01')), '2026-W01');

console.log('\n=== Jahreswechsel: das Wochenjahr weicht ab ===');
// 2027-01-01 ist ein Freitag und gehoert noch zu Woche 53 des Jahres 2026.
pruefe('2027-01-01 gehoert zu 2026-W53', kwKennung(tag('2027-01-01')), '2026-W53');
pruefe('2027-01-03 (Sonntag) noch 2026-W53', kwKennung(tag('2027-01-03')), '2026-W53');
pruefe('2027-01-04 (Montag) ist 2027-W01', kwKennung(tag('2027-01-04')), '2027-W01');
// 2021-01-01 ist ein Freitag -> Woche 53 des Jahres 2020.
pruefe('2021-01-01 gehoert zu 2020-W53', kwKennung(tag('2021-01-01')), '2020-W53');
// 2019-12-30 ist ein Montag und gehoert schon zu Woche 1 des Jahres 2020.
pruefe('2019-12-30 gehoert zu 2020-W01', kwKennung(tag('2019-12-30')), '2020-W01');
pruefe('2019-12-29 (Sonntag) noch 2019-W52', kwKennung(tag('2019-12-29')), '2019-W52');

console.log('\n=== Jahre mit 53 Wochen ===');
pruefe('2020 hat KW 53', isoWoche(tag('2020-12-31')), { jahr: 2020, woche: 53 });
pruefe('2015-12-31 ist 2015-W53', kwKennung(tag('2015-12-31')), '2015-W53');
pruefe('2024-12-30 ist 2025-W01', kwKennung(tag('2024-12-30')), '2025-W01');

console.log('\n=== Sommerzeitumstellung ===');
// Am Umstellungstag darf der Tag nicht auf den Vortag kippen.
pruefe('2026-03-29 (Beginn Sommerzeit) ist KW 13', kwKennung(tag('2026-03-29')), '2026-W13');
pruefe('2026-10-25 (Ende Sommerzeit) ist KW 43', kwKennung(tag('2026-10-25')), '2026-W43');
pruefe('2026-03-29 ist ein Sonntag', wochentag(tag('2026-03-29')), 7);

console.log('\n=== Wochentage ===');
pruefe('2026-08-17 ist Montag (1)', wochentag(tag('2026-08-17')), 1);
pruefe('2026-08-21 ist Freitag (5)', wochentag(tag('2026-08-21')), 5);
pruefe('2026-08-22 ist Samstag (6)', wochentag(tag('2026-08-22')), 6);
pruefe('Name zu 1', wochentagName(1), 'Montag');
pruefe('Name zu 5', wochentagName(5), 'Freitag');
pruefe('Samstag ist Wochenende', istWochenende(tag('2026-08-22')), true);
pruefe('Sonntag ist Wochenende', istWochenende(tag('2026-08-23')), true);
pruefe('Freitag ist kein Wochenende', istWochenende(tag('2026-08-21')), false);

console.log('\n=== Uhrzeiten ===');
pruefe('09:00', alsMinuten('09:00'), 540);
pruefe('14:45', alsMinuten('14:45'), 885);
pruefe('9:05 ohne fuehrende Null', alsMinuten('9:05'), 545);
pruefe('00:00', alsMinuten('00:00'), 0);
pruefe('leer ist ungueltig', alsMinuten(''), null);
pruefe('Unsinn ist ungueltig', alsMinuten('Pause'), null);
pruefe('25:00 ist ungueltig', alsMinuten('25:00'), null);
pruefe('09:70 ist ungueltig', alsMinuten('09:70'), null);

console.log('\n=== Formate ===');
pruefe('ISO', alsIso(tag('2026-08-05')), '2026-08-05');
pruefe('deutsch', alsDeutsch(tag('2026-08-05')), '05.08.2026');

console.log('\n=== Zeitzone: Geraet steht anderswo ===');
{
  // 00:30 Uhr am 18. August in Berlin ist am 17. August 22:30 UTC.
  const zeitpunkt = new Date('2026-08-17T22:30:00Z');
  pruefe('Berliner Kalendertag', heute(zeitpunkt), { jahr: 2026, monat: 8, tag: 18 });
  pruefe('Berliner Uhrzeit', uhrzeit(zeitpunkt).stunde, 0);
  // 22:30 UTC am Sonntag ist in Berlin bereits Montag 00:30 — neue Woche.
  // In UTC gerechnet waere es noch Sonntag und damit die Vorwoche.
  const nachMitternacht = new Date('2026-08-23T22:30:00Z');
  pruefe('Wochenwechsel nach Berlin, nicht nach UTC', kwKennung(heute(nachMitternacht)), '2026-W35');
  pruefe('derselbe Zeitpunkt waere in UTC noch KW 34',
    kwKennung({ jahr: 2026, monat: 8, tag: 23 }), '2026-W34');
  // 21:30 UTC ist in Berlin erst 23:30 — noch Sonntag, noch alte Woche.
  pruefe('eine Stunde frueher noch KW 34',
    kwKennung(heute(new Date('2026-08-23T21:30:00Z'))), '2026-W34');
}

console.log('\n=== Halbjahresgrenze ===');
pruefe('Oktober liegt im ersten Halbjahr', istErstesHalbjahr(tag('2026-10-15'), '01-31', '2026-08-10'), true);
pruefe('20. Januar liegt im ersten Halbjahr', istErstesHalbjahr(tag('2027-01-20'), '01-31', '2026-08-10'), true);
pruefe('31. Januar ist der letzte Tag', istErstesHalbjahr(tag('2027-01-31'), '01-31', '2026-08-10'), true);
pruefe('1. Februar liegt im zweiten', istErstesHalbjahr(tag('2027-02-01'), '01-31', '2026-08-10'), false);
pruefe('Mai liegt im zweiten', istErstesHalbjahr(tag('2027-05-04'), '01-31', '2026-08-10'), false);

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
