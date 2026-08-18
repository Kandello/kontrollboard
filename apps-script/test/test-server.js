// Simuliert Apps Script so weit, dass die Serverlogik echt durchlaeuft.
const fs = require('fs');

class FakeSheet {
  constructor(name) { this.name = name; this.d = []; this.frozen = 0; }
  getName() { return this.name; }
  getLastRow() { let n = 0; this.d.forEach((r, i) => { if (r && r.join('') !== '') n = i + 1; }); return n; }
  getLastColumn() { return this.d.reduce((m, r) => Math.max(m, r ? r.length : 0), 0); }
  getMaxRows() { return Math.max(1000, this.d.length + 10); }
  setFrozenRows(n) { this.frozen = n; }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  getRange(r, c, nr = 1, nc = 1) {
    const s = this;
    return {
      getValues() {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = [];
          for (let j = 0; j < nc; j++) {
            const src = s.d[r - 1 + i];
            row.push(src && src[c - 1 + j] !== undefined ? src[c - 1 + j] : '');
          }
          out.push(row);
        }
        return out;
      },
      setValues(v) {
        v.forEach((row, i) => {
          const ri = r - 1 + i;
          if (!s.d[ri]) s.d[ri] = [];
          row.forEach((val, j) => { s.d[ri][c - 1 + j] = val; });
        });
        return this;
      },
      clearContent() {
        for (let i = 0; i < nr; i++) {
          const ri = r - 1 + i;
          if (s.d[ri]) for (let j = 0; j < nc; j++) s.d[ri][c - 1 + j] = '';
        }
        return this;
      },
      setNumberFormat() { return this; },
      setFontWeight() { return this; }
    };
  }
}

class FakeSS {
  constructor() { this.sheets = {}; }
  getSheetByName(n) { return this.sheets[n] || null; }
  insertSheet(n) { return (this.sheets[n] = new FakeSheet(n)); }
  setSpreadsheetTimeZone() {}
}

const ss = new FakeSS();
global.SpreadsheetApp = { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('keine UI im Test'); } };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
let uuid = 0;
global.Utilities = {
  getUuid: () => { uuid++; const h = require('crypto').randomUUID(); return h; },
  formatDate: (d, tz, fmt) => {
    const p = n => String(n).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
};
const props = {};
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
global.ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: t => ({ setMimeType() { return { text: t }; } })
};

for (const f of ['Setup', 'Daten', 'Boards', 'Code']) {
  const src = fs.readFileSync(`../${f}.gs`, 'utf8');
  (0, eval)(src.replace(/^function (\w+)/gm, 'global.$1 = function $1')
              .replace(/^var (\w+) =/gm, 'global.$1 ='));
}

let fehler = 0;
const pruefe = (name, ist, soll) => {
  const ok = JSON.stringify(ist) === JSON.stringify(soll);
  if (!ok) fehler++;
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${name}${ok ? '' : `\n        ist:  ${JSON.stringify(ist)}\n        soll: ${JSON.stringify(soll)}`}`);
};

console.log('=== setupSheets ===');
const b1 = setupSheets();
pruefe('alle 15 Blaetter angelegt', b1.angelegt.length, 15);
pruefe('Stundenplan 22 Zeilen', holeBlatt_('Stundenplan').getLastRow() - 1, 22);
pruefe('Kategorien 4 Zeilen', holeBlatt_('Kategorien').getLastRow() - 1, 4);
pruefe('Notenschluessel 6 Zeilen', holeBlatt_('Notenschluessel').getLastRow() - 1, 6);

console.log('\n=== setupSheets erneut (darf nichts zerstoeren) ===');
const b2 = setupSheets();
pruefe('nichts neu angelegt', b2.angelegt.length, 0);
pruefe('alle unveraendert', b2.unveraendert.length, 15);
pruefe('Stundenplan weiterhin 22', holeBlatt_('Stundenplan').getLastRow() - 1, 22);

console.log('\n=== importSchuelerAusText ===');
const csv = fs.readFileSync('/home/user/kontrollboard/schueler-import.csv', 'utf8');
const imp = importSchuelerAusText(csv);
pruefe('69 neu', imp.neu, 69);
pruefe('0 aktualisiert', imp.aktualisiert, 0);
const imp2 = importSchuelerAusText(csv);
pruefe('erneut: 0 neu', imp2.neu, 0);
pruefe('erneut: 69 aktualisiert', imp2.aktualisiert, 69);
pruefe('Blatt hat 69 Zeilen', holeBlatt_('Schueler').getLastRow() - 1, 69);

console.log('\n=== Import weist Namen ab ===');
try {
  importSchuelerAusText('kuerzel;klasse;listennummer;aktiv;fach\nMustermann;3L;1;TRUE;DE\n');
  pruefe('haette abbrechen muessen', 'kein Fehler', 'Fehler');
} catch (e) {
  pruefe('bricht ab', /ist kein gueltiges Kuerzel/.test(e.message), true);
  pruefe('nichts geschrieben', holeBlatt_('Schueler').getLastRow() - 1, 69);
}

console.log('\n=== pruefeKonfiguration ===');
pruefe('keine Warnungen bei Vorbelegung', pruefeKonfiguration(), []);

console.log('\n=== ladeAlles ===');
const d = ladeAlles();
pruefe('69 Schueler', d.schueler.length, 69);
pruefe('3 Klassen', d.klassen.length, 3);
pruefe('22 Stundenplanzeilen', d.stundenplan.length, 22);
pruefe('4 Kategorien', d.kategorien.length, 4);
pruefe('Gewichte summieren auf 1', Math.round(d.gruppengewichte.reduce((s, g) => s + g.gewicht, 0) * 1000) / 1000, 1);
pruefe('Notenschluessel absteigend', d.notenschluessel.map(n => n.min_prozent), [92, 80, 67, 50, 23, 0]);
pruefe('Meta halbjahresgrenze', d.meta.halbjahresgrenze, '01-31');
pruefe('keine Warnungen', d.warnungen, []);
pruefe('Uhrzeiten als Text', d.stundenplan[0].von, '09:00');
pruefe('Kuerzel als Text', /^3L-\d\d$/.test(d.schueler[0].kuerzel), true);

console.log('\n=== Klassenstaerke und Sortierung ===');
['3L','3M','3OB'].forEach(k => {
  const s = d.schueler.filter(x => x.klasse === k);
  pruefe(`${k}: 23 Kinder`, s.length, 23);
  const nr = s.map(x => x.listennummer).sort((a,b)=>a-b);
  pruefe(`${k}: listennummer 1..23`, nr, Array.from({length:23},(_,i)=>i+1));
});

console.log('\n=== setzeMeta ===');
setzeMeta({ ferienmodus: 'TRUE', link_peak: 'https://example.org/peak' });
const d2 = ladeAlles();
pruefe('ferienmodus gesetzt', d2.meta.ferienmodus, 'TRUE');
pruefe('link gesetzt', d2.meta.link_peak, 'https://example.org/peak');
pruefe('Meta nicht dupliziert', holeBlatt_('Meta').getLastRow() - 1, 7);

console.log('\n=== Boolean-Toleranz ===');
[['TRUE',true],['true',true],['WAHR',true],[1,true],[true,true],['ja',true],
 ['FALSE',false],['',false],[0,false],[null,false]].forEach(([ein, soll]) =>
  pruefe(`istWahr_(${JSON.stringify(ein)})`, istWahr_(ein), soll));

console.log('\n=== doGet / Token ===');
const token = holeToken_();
pruefe('Token 32 Zeichen', token.length, 32);
const ohne = JSON.parse(doGet({ parameter: { aktion: 'laden' } }).text);
pruefe('ohne Token abgelehnt', ohne.ok, false);
pruefe('Fehlertext ohne Nutzdaten', /Zugang verweigert/.test(ohne.fehler), true);
const mit = JSON.parse(doGet({ parameter: { aktion: 'laden', token } }).text);
pruefe('mit Token erlaubt', mit.ok, true);
pruefe('liefert Schueler', mit.daten.schueler.length, 69);
const unbekannt = JSON.parse(doGet({ parameter: { aktion: 'quatsch', token } }).text);
pruefe('unbekannte Aktion abgewiesen', unbekannt.ok, false);

console.log('\n=== doPost ===');
const post = JSON.parse(doPost({ postData: { contents: JSON.stringify({ token, aktion: 'meta', werte: { ferienmodus: 'FALSE' } }) } }).text);
pruefe('POST meta ok', post.ok, true);
pruefe('ferienmodus zurueckgesetzt', ladeAlles().meta.ferienmodus, 'FALSE');

console.log('\n=== Kein Klarname im gesamten Datenpaket ===');
const roh = JSON.stringify(ladeAlles());
pruefe('keine Buchstabenfolge ausserhalb Kuerzelmuster in schueler',
  ladeAlles().schueler.every(s => /^[0-9][A-Za-z]{1,3}-[0-9]{2}$/.test(s.kuerzel)), true);

console.log('\n=== Einzeiliger Paste wird erkannt ===');
{
  const einzeilig = fs.readFileSync('/home/user/kontrollboard/schueler-import.csv', 'utf8').replace(/\r?\n/g, '');
  let meldung = '';
  try { importSchuelerAusText(einzeilig); } catch (e) { meldung = e.message; }
  pruefe('bricht ab und nennt die Ursache', /keine Zeilenumbr/.test(meldung), true);
  pruefe('Blatt unveraendert bei 69', holeBlatt_('Schueler').getLastRow() - 1, 69);
}

console.log('\n=== Import ohne Dialog (Blatt "Import") ===');
{
  // 1. Aufruf legt das Blatt an
  const r1 = importSchuelerAusBlatt();
  pruefe('legt Blatt an', r1.angelegt, true);
  pruefe('Blatt vorhanden', !!ss.getSheetByName('Import'), true);

  // Fall A: ganze Zeile je Zelle (Firefox-artiges Einfuegen)
  const roh = fs.readFileSync('/home/user/kontrollboard/schueler-import.csv', 'utf8')
                .replace(/^\uFEFF/, '').split(/\r?\n/).filter(z => z.trim());
  const imp = ss.getSheetByName('Import');
  imp.getRange(1, 1, roh.length, 1).setValues(roh.map(z => [z]));
  const rA = importSchuelerAusBlatt();
  pruefe('Fall A: 69 Zeilen gelesen', rA.gesamt, 69);

  // Fall B: bereits auf Spalten verteilt
  imp.d = [];
  const zerlegt = roh.map(z => z.split(';'));
  imp.getRange(1, 1, zerlegt.length, 5).setValues(zerlegt);
  const rB = importSchuelerAusBlatt();
  pruefe('Fall B: 69 Zeilen gelesen', rB.gesamt, 69);
  pruefe('Fall B: alles aktualisiert, nichts doppelt', rB.neu, 0);
  pruefe('Schueler weiterhin 69', holeBlatt_('Schueler').getLastRow() - 1, 69);

  // Fall C: Sheets macht aus TRUE einen echten Boolean und aus 1 eine Zahl
  imp.d = [];
  const getypt = roh.map((z, i) => {
    const f = z.split(';');
    return i === 0 ? f : [f[0], f[1], Number(f[2]), f[3] === 'TRUE', f[4]];
  });
  imp.getRange(1, 1, getypt.length, 5).setValues(getypt);
  const rC = importSchuelerAusBlatt();
  pruefe('Fall C: 69 Zeilen trotz echter Typen', rC.gesamt, 69);
  const alle = ladeAlles().schueler;
  pruefe('Fall C: alle aktiv', alle.every(s => s.aktiv === true), true);
  pruefe('Fall C: Listennummern erhalten', alle.filter(s => s.klasse === '3L').map(s => s.listennummer).sort((a,b)=>a-b),
         Array.from({length:23},(_,i)=>i+1));

  // Leeres Blatt meldet sich verstaendlich
  imp.d = [];
  let m = '';
  try { importSchuelerAusBlatt(); } catch (e) { m = e.message; }
  pruefe('leeres Blatt meldet Ursache', /ist leer/.test(m), true);
}

console.log('\n=== Zusammengesetzte Schluessel kollidieren nicht ===');
{
  // Ohne echtes Trennzeichen ergaeben ['ab','c'] und ['a','bc'] denselben
  // Schluessel und die zweite Zeile ueberschriebe die erste.
  holeBlatt_('Wochenstatus').d = [SCHEMA.Wochenstatus.slice()];
  schreibeNachSchluessel_('Wochenstatus', [
    { kw: '2026-W3', aufgabe: '4PEAK', erledigt_am: '2026-08-17' },
    { kw: '2026-W34', aufgabe: 'PEAK', erledigt_am: '2026-08-18' }
  ], ['kw', 'aufgabe']);
  pruefe('beide Zeilen erhalten', holeBlatt_('Wochenstatus').getLastRow() - 1, 2);

  // Erneutes Schreiben desselben Schluessels aktualisiert statt anzuhaengen.
  const r = schreibeNachSchluessel_('Wochenstatus',
    [{ kw: '2026-W34', aufgabe: 'PEAK', erledigt_am: '2026-08-19' }], ['kw', 'aufgabe']);
  pruefe('gleicher Schluessel wird aktualisiert', [r.aktualisiert, r.neu], [1, 0]);
  pruefe('weiterhin 2 Zeilen', holeBlatt_('Wochenstatus').getLastRow() - 1, 2);

  const entfernt = loescheNachSchluessel_('Wochenstatus', ['kw', 'aufgabe'], [['2026-W34', 'PEAK']]);
  pruefe('gezielt geloescht', entfernt, 1);
  pruefe('die andere Zeile bleibt', holeBlatt_('Wochenstatus').getLastRow() - 1, 1);
}

console.log('\n=== Wochenstatus ===');
{
  holeBlatt_('Wochenstatus').d = [SCHEMA.Wochenstatus.slice()];

  setzeWochenstatus('2026-W34', 'PEAK', true);
  let w = ladeAlles().wochenstatus;
  pruefe('PEAK gesetzt', w.length, 1);
  pruefe('Aufgabe gross geschrieben', w[0].aufgabe, 'PEAK');
  pruefe('Datum als Text', /^\d{4}-\d{2}-\d{2}$/.test(w[0].erledigt_am), true);

  setzeWochenstatus('2026-W34', 'weekly', true);
  pruefe('WEEKLY zusaetzlich', ladeAlles().wochenstatus.length, 2);

  setzeWochenstatus('2026-W34', 'PEAK', true);
  pruefe('zweimal setzen erzeugt keine Dublette', ladeAlles().wochenstatus.length, 2);

  setzeWochenstatus('2026-W34', 'PEAK', false);
  w = ladeAlles().wochenstatus;
  pruefe('PEAK zurueckgenommen', w.length, 1);
  pruefe('WEEKLY bleibt', w[0].aufgabe, 'WEEKLY');

  setzeWochenstatus('2026-W35', 'WEEKLY', true);
  pruefe('andere Woche eigener Eintrag', ladeAlles().wochenstatus.length, 2);

  let m = '';
  try { setzeWochenstatus('Woche 34', 'PEAK', true); } catch (e) { m = e.message; }
  pruefe('unsinnige Kalenderwoche abgewiesen', /Ungültige Kalenderwoche/.test(m), true);

  m = '';
  try { setzeWochenstatus('2026-W34', 'IRGENDWAS', true); } catch (e) { m = e.message; }
  pruefe('unbekannte Aufgabe abgewiesen', /Unbekannte Wochenaufgabe/.test(m), true);
  pruefe('nach beiden Fehlern unveraendert', ladeAlles().wochenstatus.length, 2);

  const t = holeToken_();
  const p = JSON.parse(doPost({ postData: { contents: JSON.stringify(
    { token: t, aktion: 'wochenstatus', kw: '2026-W36', aufgabe: 'PEAK', erledigt: true }) } }).text);
  pruefe('ueber doPost erreichbar', p.ok, true);
  pruefe('doPost hat geschrieben', ladeAlles().wochenstatus.length, 3);
}

console.log('\n=== Boards: anlegen ===');
{
  holeBlatt_('Boards').d = [SCHEMA.Boards.slice()];
  holeBlatt_('BoardSpalten').d = [SCHEMA.BoardSpalten.slice()];
  holeBlatt_('BoardWerte').d = [SCHEMA.BoardWerte.slice()];

  const r1 = boardErstellen('3L', 'Materialien September', 'Erster Monat', 'Material, September',
    ['Heft', 'Stifte', 'Federmappe']);
  pruefe('Board angelegt', typeof r1.board.id, 'string');
  pruefe('drei Spalten in Reihenfolge', r1.spalten.map(s => s.bezeichnung), ['Heft', 'Stifte', 'Federmappe']);
  pruefe('Reihenfolge 1..3', r1.spalten.map(s => s.reihenfolge), [1, 2, 3]);
  pruefe('Board in ladeAlles sichtbar', ladeAlles().boards.length, 1);
  pruefe('drei Spalten in ladeAlles', ladeAlles().boardSpalten.length, 3);
  pruefe('Status aktiv', ladeAlles().boards[0].status, 'aktiv');

  let m = '';
  try { boardErstellen('', 'X', '', '', []); } catch (e) { m = e.message; }
  pruefe('ohne Klasse abgewiesen', /Klasse/.test(m), true);
  m = '';
  try { boardErstellen('3L', '', '', '', []); } catch (e) { m = e.message; }
  pruefe('ohne Titel abgewiesen', /Titel/.test(m), true);
}

console.log('\n=== Boards: Spalten uebernehmen beim Anlegen ===');
{
  const bestehend = ladeAlles().boardSpalten.map(s => s.bezeichnung);
  const r2 = boardErstellen('3M', 'Materialien September (Kopie)', '', '', bestehend);
  pruefe('uebernommene Spalten identisch', r2.spalten.map(s => s.bezeichnung), bestehend);
  pruefe('zwei Boards insgesamt', ladeAlles().boards.length, 2);
  pruefe('sechs Spalten insgesamt', ladeAlles().boardSpalten.length, 6);
}

console.log('\n=== Boards: aktualisieren ===');
{
  const board = ladeAlles().boards[0];
  boardAktualisieren(board.id, 'Materialien Herbst', 'Neuer Untertitel', 'Material, Herbst');
  const nach = ladeAlles().boards.find(b => b.id === board.id);
  pruefe('Titel geaendert', nach.titel, 'Materialien Herbst');
  pruefe('Untertitel geaendert', nach.untertitel, 'Neuer Untertitel');
  pruefe('Klasse unveraendert', nach.klasse, '3L');
  pruefe('Status unveraendert', nach.status, 'aktiv');
  pruefe('weiterhin nur zwei Boards (kein Duplikat)', ladeAlles().boards.length, 2);

  let m = '';
  try { boardAktualisieren('unbekannt', 'X', '', ''); } catch (e) { m = e.message; }
  pruefe('unbekanntes Board abgewiesen', /nicht gefunden/.test(m), true);
}

console.log('\n=== Boards: Zellzustaende schreiben, aktualisieren, loeschen ===');
{
  const board = ladeAlles().boards[0];
  const spalten = ladeAlles().boardSpalten.filter(s => s.board_id === board.id);
  const heft = spalten.find(s => s.bezeichnung === 'Heft');
  const stifte = spalten.find(s => s.bezeichnung === 'Stifte');

  const r = boardWerteSpeichern([
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3L-01', zustand: 'haken' },
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3L-02', zustand: 'teilweise' },
    { board_id: board.id, spalte_id: stifte.id, kuerzel: '3L-01', zustand: 'x' }
  ]);
  pruefe('drei neue Werte gespeichert', r.gespeichert, 3);
  pruefe('drei Werte in ladeAlles (nur nicht-leere)', ladeAlles().boardWerte.length, 3);

  // Zustand aendern: leer -> haken -> teilweise -> x -> leer
  boardWerteSpeichern([{ board_id: board.id, spalte_id: heft.id, kuerzel: '3L-01', zustand: 'teilweise' }]);
  let werte = ladeAlles().boardWerte;
  pruefe('Zustand aktualisiert, keine Dublette',
    werte.filter(w => w.board_id === board.id && w.spalte_id === heft.id && w.kuerzel === '3L-01').length, 1);
  pruefe('neuer Zustand uebernommen',
    werte.find(w => w.spalte_id === heft.id && w.kuerzel === '3L-01').zustand, 'teilweise');

  // Auf leer zuruecksetzen loescht die Zeile.
  boardWerteSpeichern([{ board_id: board.id, spalte_id: heft.id, kuerzel: '3L-01', zustand: '' }]);
  werte = ladeAlles().boardWerte;
  pruefe('leer entfernt die Zeile', werte.some(w => w.spalte_id === heft.id && w.kuerzel === '3L-01'), false);
  pruefe('andere Werte bleiben', werte.length, 2);

  let m = '';
  try { boardWerteSpeichern([{ board_id: board.id, spalte_id: heft.id, kuerzel: 'Mustermann', zustand: 'haken' }]); }
  catch (e) { m = e.message; }
  pruefe('ungueltiges Kuerzel abgewiesen', /Ungültiges Kürzel/.test(m), true);
  pruefe('nichts geschrieben nach Fehler', ladeAlles().boardWerte.length, 2);

  let m2 = '';
  try { boardWerteSpeichern([{ board_id: board.id, spalte_id: heft.id, kuerzel: '3L-03', zustand: 'quatsch' }]); }
  catch (e) { m2 = e.message; }
  pruefe('unbekannter Zustand abgewiesen', /Unbekannter Zustand/.test(m2), true);
}

console.log('\n=== Boards: Spalte hinzufuegen, umbenennen, Reihenfolge ===');
{
  const board = ladeAlles().boards[0];
  const neu = boardSpalteHinzufuegen(board.id, 'Elternbrief');
  pruefe('neue Spalte an Position 4', neu.reihenfolge, 4);
  pruefe('vier Spalten fuer dieses Board', ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length, 4);

  boardSpalteUmbenennen(neu.id, 'Elternbrief unterschrieben');
  pruefe('umbenannt', ladeAlles().boardSpalten.find(s => s.id === neu.id).bezeichnung, 'Elternbrief unterschrieben');

  const alle = ladeAlles().boardSpalten.filter(s => s.board_id === board.id).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const neueReihenfolge = [alle[3].id, alle[0].id, alle[1].id, alle[2].id];
  boardSpaltenReihenfolge(board.id, neueReihenfolge);
  const sortiert = ladeAlles().boardSpalten.filter(s => s.board_id === board.id).sort((a, b) => a.reihenfolge - b.reihenfolge);
  pruefe('Reihenfolge uebernommen', sortiert.map(s => s.id), neueReihenfolge);
  pruefe('Reihenfolge neu durchnummeriert 1..4', sortiert.map(s => s.reihenfolge), [1, 2, 3, 4]);
}

console.log('\n=== Boards: Spalte loeschen kaskadiert Werte ===');
{
  const board = ladeAlles().boards[0];
  const spalten = ladeAlles().boardSpalten.filter(s => s.board_id === board.id);
  const stifte = spalten.find(s => s.bezeichnung === 'Stifte');
  pruefe('Stifte hat einen Wert vor dem Loeschen',
    ladeAlles().boardWerte.some(w => w.spalte_id === stifte.id), true);

  const r = boardSpalteLoeschen(stifte.id);
  pruefe('ein Wert mitgeloescht', r.geloeschteWerte, 1);
  pruefe('Spalte verschwunden', ladeAlles().boardSpalten.some(s => s.id === stifte.id), false);
  pruefe('kein Wert mehr fuer diese Spalte', ladeAlles().boardWerte.some(w => w.spalte_id === stifte.id), false);
  pruefe('drei Spalten fuer das Board uebrig', ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length, 3);

  let m = '';
  try { boardSpalteLoeschen('unbekannt'); } catch (e) { m = e.message; }
  pruefe('unbekannte Spalte abgewiesen', /nicht gefunden/.test(m), true);
}

console.log('\n=== Boards: zuruecksetzen leert nur die Werte ===');
{
  const board = ladeAlles().boards[0];
  pruefe('Board hat noch Werte vor dem Zuruecksetzen',
    ladeAlles().boardWerte.some(w => w.board_id === board.id), true);
  const spaltenVorher = ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length;

  const r = boardZuruecksetzen(board.id);
  pruefe('Werte entfernt', r.entfernt > 0, true);
  pruefe('keine Werte mehr fuer dieses Board', ladeAlles().boardWerte.some(w => w.board_id === board.id), false);
  pruefe('Spalten bleiben erhalten', ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length, spaltenVorher);
}

console.log('\n=== Boards: archivieren ===');
{
  const board = ladeAlles().boards[0];
  const r = boardStatus(board.id, 'archiviert');
  pruefe('Status archiviert', r.status, 'archiviert');
  const nach = ladeAlles().boards.find(b => b.id === board.id);
  pruefe('Status in der Tabelle archiviert', nach.status, 'archiviert');
  pruefe('archiviert_am gesetzt', /^\d{4}-\d{2}-\d{2}$/.test(nach.archiviert_am), true);

  boardStatus(board.id, 'aktiv');
  const wieder = ladeAlles().boards.find(b => b.id === board.id);
  pruefe('zurueckgesetzt auf aktiv', wieder.status, 'aktiv');
  pruefe('archiviert_am geleert', wieder.archiviert_am, '');

  let m = '';
  try { boardStatus(board.id, 'unsinn'); } catch (e) { m = e.message; }
  pruefe('unbekannter Status abgewiesen', /Unbekannter Status/.test(m), true);
}

console.log('\n=== Boards: ueber doPost erreichbar, mit Token-Pruefung ===');
{
  const t = holeToken_();
  const p1 = JSON.parse(doPost({ postData: { contents: JSON.stringify(
    { token: t, aktion: 'boardErstellen', klasse: '3OB', titel: 'Lesepass', spalten: ['Kapitel 1'] }) } }).text);
  pruefe('boardErstellen ueber doPost', p1.ok, true);
  pruefe('drei Boards insgesamt', ladeAlles().boards.length, 3);

  const p2 = JSON.parse(doPost({ postData: { contents: JSON.stringify(
    { token: 'falsch', aktion: 'boardErstellen', klasse: '3OB', titel: 'X', spalten: [] }) } }).text);
  pruefe('falscher Token abgewiesen', p2.ok, false);
  pruefe('weiterhin nur drei Boards', ladeAlles().boards.length, 3);
}

console.log('\n=== Boards: keine Klarnamen im Datenpaket ===');
{
  const roh = JSON.stringify(ladeAlles());
  pruefe('kein Klarname in Boards/Spalten/Werten sichtbar',
    /Musterfrau|Beispiel|Anna|Ben|Bruno/.test(roh), false);
}

console.log(fehler === 0 ? '\nALLE TESTS BESTANDEN' : `\n${fehler} TEST(S) FEHLGESCHLAGEN`);
process.exit(fehler === 0 ? 0 : 1);
