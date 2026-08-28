/**
 * Prueft die reine Logik der Merklisten (To-Do, Deadlines, Termine):
 * Sortierung, das rote Ausrufezeichen bei Deadlines, und die optimistischen
 * lokalen Aenderungen.
 *
 *   node merkliste.mjs
 */

import {
  sortiereMerkliste, eintraegeFuerTyp, istUeberfaellig,
  fuegeLokalHinzu, entferneLokal, setzeErledigtLokal
} from '../js/merkliste.js';

let n = 0, schlecht = 0;
function pruefe(name, ist, soll) {
  n++;
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) schlecht++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}` +
    (ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`));
}

const eintrag = (id, felder) => ({
  id, typ: 'TODO', text: id, datum: '', uhrzeit: '', erledigt: false, erstellt_am: '2026-08-01T08:00:00', ...felder
});

// ---------------------------------------------------------------------------
console.log('=== Sortierung nach Datum ===');
{
  const a = eintrag('a', { datum: '2026-09-10' });
  const b = eintrag('b', { datum: '2026-08-20' });
  const c = eintrag('c', { datum: '2026-08-20' }); // gleiches Datum wie b, spaeter erstellt
  c.erstellt_am = '2026-08-01T09:00:00';
  pruefe('aufsteigend nach Datum', sortiereMerkliste([a, b, c]).map((x) => x.id), ['b', 'c', 'a']);
}

console.log('\n=== Kein Datum rutscht ans Ende ===');
{
  const mitDatum = eintrag('mit', { datum: '2026-12-24' });
  const ohneDatum = eintrag('ohne', {});
  pruefe('das undatierte steht hinten', sortiereMerkliste([ohneDatum, mitDatum]).map((x) => x.id), ['mit', 'ohne']);
}

console.log('\n=== Bei gleichem Datum entscheidet die Uhrzeit ===');
{
  const spaet = eintrag('spaet', { datum: '2026-09-01', uhrzeit: '16:00' });
  const frueh = eintrag('frueh', { datum: '2026-09-01', uhrzeit: '08:00' });
  const ohneUhrzeit = eintrag('ohneUhrzeit', { datum: '2026-09-01' });
  pruefe('Uhrzeit sortiert innerhalb desselben Tages, keine Uhrzeit zuletzt',
    sortiereMerkliste([spaet, ohneUhrzeit, frueh]).map((x) => x.id), ['frueh', 'spaet', 'ohneUhrzeit']);
}

console.log('\n=== Abgehakte stehen unter allen offenen ===');
{
  const offenSpaet = eintrag('offenSpaet', { datum: '2026-12-01' });
  const abgehaktFrueh = eintrag('abgehaktFrueh', { datum: '2026-01-01', erledigt: true });
  pruefe('offen vor abgehakt, unabhaengig vom Datum',
    sortiereMerkliste([abgehaktFrueh, offenSpaet]).map((x) => x.id), ['offenSpaet', 'abgehaktFrueh']);
}
{
  const offenA = eintrag('offenA', { datum: '2026-05-01' });
  const abA = eintrag('abA', { datum: '2026-01-01', erledigt: true });
  const abB = eintrag('abB', { datum: '2026-02-01', erledigt: true });
  pruefe('innerhalb der abgehakten wird ebenfalls nach Datum sortiert',
    sortiereMerkliste([abB, offenA, abA]).map((x) => x.id), ['offenA', 'abA', 'abB']);
}

console.log('\n=== eintraegeFuerTyp filtert und sortiert ===');
{
  const daten = { merkliste: [
    eintrag('t1', { typ: 'TODO', datum: '2026-09-05' }),
    eintrag('d1', { typ: 'DEADLINE', datum: '2026-09-01' }),
    eintrag('t2', { typ: 'TODO', datum: '2026-09-01' })
  ] };
  pruefe('nur TODO, sortiert', eintraegeFuerTyp(daten, 'TODO').map((x) => x.id), ['t2', 't1']);
  pruefe('nur DEADLINE', eintraegeFuerTyp(daten, 'DEADLINE').map((x) => x.id), ['d1']);
  pruefe('unbekannter Typ liefert leer', eintraegeFuerTyp(daten, 'EVENT').map((x) => x.id), []);
}

// ---------------------------------------------------------------------------
console.log('\n=== Rotes Ausrufezeichen (nur Deadlines) ===');
const HEUTE = '2026-09-15';
{
  pruefe('heute faellig, offen: ja',
    istUeberfaellig(eintrag('x', { typ: 'DEADLINE', datum: '2026-09-15' }), HEUTE), true);
  pruefe('ueberfaellig (gestern), offen: ja',
    istUeberfaellig(eintrag('x', { typ: 'DEADLINE', datum: '2026-09-10' }), HEUTE), true);
  pruefe('in der Zukunft: nein',
    istUeberfaellig(eintrag('x', { typ: 'DEADLINE', datum: '2026-09-20' }), HEUTE), false);
  pruefe('heute faellig, aber abgehakt: nein',
    istUeberfaellig(eintrag('x', { typ: 'DEADLINE', datum: '2026-09-15', erledigt: true }), HEUTE), false);
  pruefe('ohne Datum: nein',
    istUeberfaellig(eintrag('x', { typ: 'DEADLINE', datum: '' }), HEUTE), false);
  pruefe('faellig, aber ein To-Do statt einer Deadline: nein',
    istUeberfaellig(eintrag('x', { typ: 'TODO', datum: '2026-09-10' }), HEUTE), false);
  pruefe('faellig, aber ein Termin statt einer Deadline: nein',
    istUeberfaellig(eintrag('x', { typ: 'EVENT', datum: '2026-09-10' }), HEUTE), false);
}

// ---------------------------------------------------------------------------
console.log('\n=== Optimistische lokale Aenderungen ===');
{
  const daten = { merkliste: [eintrag('a', {})] };
  fuegeLokalHinzu(daten, eintrag('b', {}));
  pruefe('hinzugefuegt', daten.merkliste.map((x) => x.id), ['a', 'b']);

  const entfernt = entferneLokal(daten, 'a');
  pruefe('entfernt und zurueckgegeben', entfernt.id, 'a');
  pruefe('nur noch eins uebrig', daten.merkliste.map((x) => x.id), ['b']);
  pruefe('unbekannte id liefert null', entferneLokal(daten, 'gibtsnicht'), null);

  const vorher = setzeErledigtLokal(daten, 'b', true);
  pruefe('vorheriger Wert wird zurueckgegeben', vorher, false);
  pruefe('Status uebernommen', daten.merkliste[0].erledigt, true);
  pruefe('unbekannte id liefert null', setzeErledigtLokal(daten, 'gibtsnicht', true), null);
}

console.log(schlecht === 0 ? `\nALLE ${n} TESTS BESTANDEN` : `\n${schlecht} von ${n} FEHLGESCHLAGEN`);
process.exit(schlecht === 0 ? 0 : 1);
