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

for (const f of ['Setup', 'Daten', 'Boards', 'Noten', 'Einheiten', 'Jahresplan', 'Code']) {
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
pruefe('alle 18 Blaetter angelegt', b1.angelegt.length, 18);
pruefe('Stundenplan 22 Zeilen', holeBlatt_('Stundenplan').getLastRow() - 1, 22);
pruefe('Kategorien 3 Zeilen', holeBlatt_('Kategorien').getLastRow() - 1, 3);
pruefe('Notenschluessel 6 Zeilen', holeBlatt_('Notenschluessel').getLastRow() - 1, 6);

console.log('\n=== setupSheets erneut (darf nichts zerstoeren) ===');
const b2 = setupSheets();
pruefe('nichts neu angelegt', b2.angelegt.length, 0);
pruefe('alle unveraendert', b2.unveraendert.length, 18);
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
pruefe('3 Kategorien', d.kategorien.length, 3);
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

console.log('\n=== Boards: anlegen (gemeinsam fuer alle Klassen, keine Klassen-Spalte mehr) ===');
{
  holeBlatt_('Boards').d = [SCHEMA.Boards.slice()];
  holeBlatt_('BoardSpalten').d = [SCHEMA.BoardSpalten.slice()];
  holeBlatt_('BoardWerte').d = [SCHEMA.BoardWerte.slice()];

  const r1 = boardErstellen('Materialien September', 'Erster Monat', 'Material, September');
  pruefe('Board angelegt', typeof r1.board.id, 'string');
  pruefe('keine Klasse im Datensatz', 'klasse' in r1.board, false);
  pruefe('Board in ladeAlles sichtbar', ladeAlles().boards.length, 1);
  pruefe('Status aktiv', ladeAlles().boards[0].status, 'aktiv');

  const r2 = boardErstellen('Lesepass', '', '', 'eigene-id-123');
  pruefe('vom Client vorgegebene id uebernommen', r2.board.id, 'eigene-id-123');
  pruefe('zwei Boards insgesamt', ladeAlles().boards.length, 2);

  let m = '';
  try { boardErstellen('', '', ''); } catch (e) { m = e.message; }
  pruefe('ohne Titel abgewiesen', /Titel/.test(m), true);

  const spaltenA = [
    boardSpalteHinzufuegen(r1.board.id, 'Heft'),
    boardSpalteHinzufuegen(r1.board.id, 'Stifte'),
    boardSpalteHinzufuegen(r1.board.id, 'Federmappe')
  ];
  pruefe('drei Spalten in Reihenfolge', spaltenA.map(s => s.bezeichnung), ['Heft', 'Stifte', 'Federmappe']);
  pruefe('Reihenfolge 1..3', spaltenA.map(s => s.reihenfolge), [1, 2, 3]);
  pruefe('drei Spalten in ladeAlles', ladeAlles().boardSpalten.length, 3);
}

console.log('\n=== Boards: dieselbe Checkliste gilt fuer jede Klasse (Trennung nur ueber Kuerzel) ===');
{
  const board = ladeAlles().boards[0];
  const heft = ladeAlles().boardSpalten.find(s => s.board_id === board.id && s.bezeichnung === 'Heft');
  boardWerteSpeichern([
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3L-01', zustand: 'haken' },
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3M-01', zustand: 'x' }
  ]);
  const werte = ladeAlles().boardWerte.filter(w => w.board_id === board.id && w.spalte_id === heft.id);
  pruefe('3L-01 und 3M-01 unabhaengig unter derselben Checkliste gespeichert',
    werte.map(w => w.kuerzel + ':' + w.zustand).sort(), ['3L-01:haken', '3M-01:x']);
  // Aufraeumen, damit der naechste Testblock unabhaengig bleibt.
  boardWerteSpeichern([
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3L-01', zustand: '' },
    { board_id: board.id, spalte_id: heft.id, kuerzel: '3M-01', zustand: '' }
  ]);
  pruefe('aufgeraeumt', ladeAlles().boardWerte.some(w => w.board_id === board.id && w.spalte_id === heft.id), false);
}

console.log('\n=== Boards: aktualisieren ===');
{
  const board = ladeAlles().boards[0];
  boardAktualisieren(board.id, 'Materialien Herbst', 'Neuer Untertitel', 'Material, Herbst');
  const nach = ladeAlles().boards.find(b => b.id === board.id);
  pruefe('Titel geaendert', nach.titel, 'Materialien Herbst');
  pruefe('Untertitel geaendert', nach.untertitel, 'Neuer Untertitel');
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

console.log('\n=== Boards: zuruecksetzen betrifft nur die eigene Klasse ===');
{
  const board = ladeAlles().boards[0];
  const heft = ladeAlles().boardSpalten.find(s => s.board_id === board.id && s.bezeichnung === 'Heft');
  boardWerteSpeichern([{ board_id: board.id, spalte_id: heft.id, kuerzel: '3M-05', zustand: 'haken' }]);
  pruefe('3L hat noch Werte vor dem Zuruecksetzen',
    ladeAlles().boardWerte.some(w => w.board_id === board.id && w.kuerzel === '3L-02'), true);
  pruefe('3M hat einen Wert vor dem Zuruecksetzen',
    ladeAlles().boardWerte.some(w => w.board_id === board.id && w.kuerzel === '3M-05'), true);
  const spaltenVorher = ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length;

  const r = boardZuruecksetzen(board.id, '3L');
  pruefe('Werte entfernt', r.entfernt > 0, true);
  pruefe('keine 3L-Werte mehr fuer dieses Board',
    ladeAlles().boardWerte.some(w => w.board_id === board.id && w.kuerzel === '3L-02'), false);
  pruefe('3M-Wert bleibt unberuehrt',
    ladeAlles().boardWerte.some(w => w.board_id === board.id && w.kuerzel === '3M-05'), true);
  pruefe('Spalten bleiben erhalten', ladeAlles().boardSpalten.filter(s => s.board_id === board.id).length, spaltenVorher);

  let m = '';
  try { boardZuruecksetzen(board.id, ''); } catch (e) { m = e.message; }
  pruefe('ohne Klasse abgewiesen', /Klasse/.test(m), true);
}

console.log('\n=== Boards: archivieren betrifft nur die eigene Klasse ===');
{
  const board = ladeAlles().boards[0];
  const r = boardStatus(board.id, '3L', 'archiviert');
  pruefe('Status archiviert', r.status, 'archiviert');
  pruefe('fuer 3L archiviert', ladeAlles().boardKlassenStatus
    .find(s => s.board_id === board.id && s.klasse === '3L').status, 'archiviert');
  pruefe('archiviert_am gesetzt', /^\d{4}-\d{2}-\d{2}$/.test(ladeAlles().boardKlassenStatus
    .find(s => s.board_id === board.id && s.klasse === '3L').archiviert_am), true);
  pruefe('fuer 3M weiterhin keine Statuszeile (gilt als aktiv)', ladeAlles().boardKlassenStatus
    .some(s => s.board_id === board.id && s.klasse === '3M'), false);

  boardStatus(board.id, '3L', 'aktiv');
  const wieder = ladeAlles().boardKlassenStatus.find(s => s.board_id === board.id && s.klasse === '3L');
  pruefe('zurueckgesetzt auf aktiv', wieder.status, 'aktiv');
  pruefe('archiviert_am geleert', wieder.archiviert_am, '');

  let m = '';
  try { boardStatus(board.id, '3L', 'unsinn'); } catch (e) { m = e.message; }
  pruefe('unbekannter Status abgewiesen', /Unbekannter Status/.test(m), true);
  m = '';
  try { boardStatus(board.id, '', 'archiviert'); } catch (e) { m = e.message; }
  pruefe('ohne Klasse abgewiesen', /Klasse/.test(m), true);
}

console.log('\n=== Boards: loeschen entfernt Board, Spalten, Werte und Klassenstatus vollstaendig ===');
{
  const board = ladeAlles().boards[0];
  pruefe('Board hat noch Spalten vor dem Loeschen',
    ladeAlles().boardSpalten.some(s => s.board_id === board.id), true);
  pruefe('Board hat noch Werte vor dem Loeschen',
    ladeAlles().boardWerte.some(w => w.board_id === board.id), true);
  pruefe('Board hat noch einen Klassenstatus vor dem Loeschen',
    ladeAlles().boardKlassenStatus.some(s => s.board_id === board.id), true);

  const r = boardLoeschen(board.id);
  pruefe('Spalten- und Wertezahl gemeldet', r.geloeschteSpalten > 0 && r.geloeschteWerte > 0, true);
  pruefe('Board verschwunden', ladeAlles().boards.some(b => b.id === board.id), false);
  pruefe('nur noch ein Board uebrig', ladeAlles().boards.length, 1);
  pruefe('keine Spalten mehr', ladeAlles().boardSpalten.some(s => s.board_id === board.id), false);
  pruefe('keine Werte mehr', ladeAlles().boardWerte.some(w => w.board_id === board.id), false);
  pruefe('kein Klassenstatus mehr', ladeAlles().boardKlassenStatus.some(s => s.board_id === board.id), false);

  let m = '';
  try { boardLoeschen(board.id); } catch (e) { m = e.message; }
  pruefe('erneutes Loeschen abgewiesen', /nicht gefunden/.test(m), true);
  m = '';
  try { boardLoeschen(''); } catch (e) { m = e.message; }
  pruefe('ohne id abgewiesen', /Keine Checkliste/.test(m), true);
}

console.log('\n=== Boards: ueber doPost erreichbar, mit Token-Pruefung ===');
{
  const t = holeToken_();
  const p1 = JSON.parse(doPost({ postData: { contents: JSON.stringify(
    { token: t, aktion: 'boardErstellen', titel: 'Lesestunde' }) } }).text);
  pruefe('boardErstellen ueber doPost', p1.ok, true);
  pruefe('zwei Boards insgesamt', ladeAlles().boards.length, 2);

  const p2 = JSON.parse(doPost({ postData: { contents: JSON.stringify(
    { token: 'falsch', aktion: 'boardErstellen', titel: 'X' }) } }).text);
  pruefe('falscher Token abgewiesen', p2.ok, false);
  pruefe('weiterhin nur zwei Boards', ladeAlles().boards.length, 2);
}

console.log('\n=== Boards: keine Klarnamen im Datenpaket ===');
{
  const roh = JSON.stringify(ladeAlles());
  pruefe('kein Klarname in Boards/Spalten/Werten sichtbar',
    /Musterfrau|Beispiel|Anna|Ben|Bruno/.test(roh), false);
}

console.log('\n=== Noten: Testthema setzen, aendern, entfernen ===');
{
  testThemaSetzen(2026, 1, 1, 'Wortarten');
  testThemaSetzen(2026, 1, 2, 'Präteritum');
  pruefe('zwei Themen angelegt', ladeAlles().tests.length, 2);
  pruefe('Thema gespeichert',
    ladeAlles().tests.find(t => t.nummer === 1).thema, 'Wortarten');

  testThemaSetzen(2026, 1, 1, 'Wortarten und Satzglieder');
  pruefe('geaendert, nicht dupliziert', ladeAlles().tests.length, 2);
  pruefe('neues Thema', ladeAlles().tests.find(t => t.nummer === 1).thema, 'Wortarten und Satzglieder');

  testThemaSetzen(2026, 1, 2, '');
  pruefe('leeres Thema entfernt den Eintrag', ladeAlles().tests.length, 1);

  let m = '';
  try { testThemaSetzen(2026, 3, 1, 'X'); } catch (e) { m = e.message; }
  pruefe('Halbjahr 3 abgewiesen', /Halbjahr/.test(m), true);
}

console.log('\n=== Noten: Erhebungen speichern, aendern, loeschen ===');
{
  const r = erhebungenSpeichern([
    { kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: 96 },
    { kuerzel: '3L-02', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: 82 },
    { kuerzel: '3L-01', kategorie_id: 'MUND', anlass: '2026-09', datum: '2026-09-30', wert: 90 }
  ]);
  pruefe('drei Erhebungen gespeichert', r.gespeichert, 3);
  pruefe('drei in ladeAlles', ladeAlles().erhebungen.length, 3);
  pruefe('Wert korrekt',
    ladeAlles().erhebungen.find(e => e.kuerzel === '3L-01' && e.kategorie_id === 'TEST').wert, 96);

  // Aendern: gleiche Kombination, neuer Wert -> keine Dublette, ID bleibt.
  const vorherId = ladeAlles().erhebungen.find(e => e.kuerzel === '3L-01' && e.kategorie_id === 'TEST').id;
  erhebungenSpeichern([{ kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: 98 }]);
  const nach = ladeAlles().erhebungen.find(e => e.kuerzel === '3L-01' && e.kategorie_id === 'TEST');
  pruefe('keine Dublette', ladeAlles().erhebungen.length, 3);
  pruefe('Wert aktualisiert', nach.wert, 98);
  pruefe('ID bleibt erhalten', nach.id, vorherId);

  // Leerer Wert loescht die Zeile (kein Wert ist nicht null Prozent).
  erhebungenSpeichern([{ kuerzel: '3L-02', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: '' }]);
  pruefe('leerer Wert entfernt die Zeile', ladeAlles().erhebungen.length, 2);
  pruefe('andere bleiben', ladeAlles().erhebungen.some(e => e.kuerzel === '3L-01'), true);
}

console.log('\n=== Noten: unsinnige Eingaben werden abgewiesen ===');
{
  const vorher = ladeAlles().erhebungen.length;
  let m = '';
  try { erhebungenSpeichern([{ kuerzel: 'Mustermann', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: 50 }]); }
  catch (e) { m = e.message; }
  pruefe('Name statt Kuerzel abgewiesen', /Ungültiges Kürzel/.test(m), true);

  m = '';
  try { erhebungenSpeichern([{ kuerzel: '3L-01', kategorie_id: 'QUATSCH', anlass: 'Test 1', datum: '2026-09-15', wert: 50 }]); }
  catch (e) { m = e.message; }
  pruefe('unbekannte Kategorie abgewiesen', /Unbekannte Kategorie/.test(m), true);

  m = '';
  try { erhebungenSpeichern([{ kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: 150 }]); }
  catch (e) { m = e.message; }
  pruefe('über 100 Prozent abgewiesen', /außerhalb/.test(m), true);

  m = '';
  try { erhebungenSpeichern([{ kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 1', datum: '2026-09-15', wert: -5 }]); }
  catch (e) { m = e.message; }
  pruefe('negativer Wert abgewiesen', /außerhalb/.test(m), true);

  m = '';
  try { erhebungenSpeichern([{ kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 1', datum: '15.09.2026', wert: 50 }]); }
  catch (e) { m = e.message; }
  pruefe('falsches Datumsformat abgewiesen', /Datum/.test(m), true);

  pruefe('nach allen Fehlern nichts geschrieben', ladeAlles().erhebungen.length, vorher);
}

console.log('\n=== Noten: Anlass einer Klasse loeschen laesst Parallelklassen unberuehrt ===');
{
  erhebungenSpeichern([
    { kuerzel: '3L-01', kategorie_id: 'TEST', anlass: 'Test 2', datum: '2026-11-10', wert: 70 },
    { kuerzel: '3M-05', kategorie_id: 'TEST', anlass: 'Test 2', datum: '2026-11-10', wert: 75 }
  ]);
  pruefe('beide Klassen haben Test 2',
    ladeAlles().erhebungen.filter(e => e.anlass === 'Test 2').length, 2);

  const r = erhebungenAnlassLoeschen('3L', 'TEST', 'Test 2');
  pruefe('ein Eintrag entfernt', r.entfernt, 1);
  pruefe('3L ist Test 2 los',
    ladeAlles().erhebungen.some(e => e.anlass === 'Test 2' && e.kuerzel === '3L-01'), false);
  pruefe('3M behaelt Test 2',
    ladeAlles().erhebungen.some(e => e.anlass === 'Test 2' && e.kuerzel === '3M-05'), true);
}

console.log('\n=== Noten: ueber doPost erreichbar ===');
{
  const t = holeToken_();
  const p = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    token: t, aktion: 'erhebungen', aenderungen: [
      { kuerzel: '3OB-11', kategorie_id: 'SCHR', anlass: '2026-10', datum: '2026-10-31', wert: 88 }
    ] }) } }).text);
  pruefe('erhebungen ueber doPost', p.ok, true);
  pruefe('Wert liegt in der Tabelle',
    ladeAlles().erhebungen.some(e => e.kuerzel === '3OB-11' && e.wert === 88), true);

  const p2 = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    token: 'falsch', aktion: 'erhebungen', aenderungen: [
      { kuerzel: '3OB-11', kategorie_id: 'SCHR', anlass: '2026-11', datum: '2026-11-30', wert: 50 }
    ] }) } }).text);
  pruefe('falscher Token abgewiesen', p2.ok, false);
  pruefe('nichts geschrieben',
    ladeAlles().erhebungen.some(e => e.anlass === '2026-11'), false);
}

console.log('\n=== Noten: keine Klarnamen im Datenpaket ===');
{
  const roh = JSON.stringify(ladeAlles());
  pruefe('kein Klarname in Erhebungen/Tests sichtbar',
    /Musterfrau|Beispiel|Anna|Ben|Bruno/.test(roh), false);
}

console.log('\n=== Beteiligungspunkte: speichern, aendern, loeschen ===');
{
  const r = beteiligungspunkteSpeichern([
    { kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 8 },
    { kuerzel: '3L-01', art: 'SCHR', kw: '2026-W37', punkte: 6 },
    { kuerzel: '3L-02', art: 'MUND', kw: '2026-W37', punkte: 9 }
  ]);
  pruefe('drei Punkte gespeichert', r.gespeichert, 3);
  pruefe('drei in ladeAlles', ladeAlles().beteiligungspunkte.length, 3);
  pruefe('Punkte korrekt',
    ladeAlles().beteiligungspunkte.find(b => b.kuerzel === '3L-01' && b.art === 'MUND').punkte, 8);

  // Aendern: gleiche Kombination, neuer Wert -> keine Dublette.
  beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 10 }]);
  pruefe('keine Dublette', ladeAlles().beteiligungspunkte.length, 3);
  pruefe('Punkte aktualisiert',
    ladeAlles().beteiligungspunkte.find(b => b.kuerzel === '3L-01' && b.art === 'MUND').punkte, 10);

  // Leerer Wert loescht die Zeile (nicht beobachtet, nicht 0 Punkte).
  beteiligungspunkteSpeichern([{ kuerzel: '3L-02', art: 'MUND', kw: '2026-W37', punkte: '' }]);
  pruefe('leerer Wert entfernt die Zeile', ladeAlles().beteiligungspunkte.length, 2);
}

console.log('\n=== Beteiligungspunkte: unsinnige Eingaben werden abgewiesen ===');
{
  const vorher = ladeAlles().beteiligungspunkte.length;
  let m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: 'Mustermann', art: 'MUND', kw: '2026-W37', punkte: 5 }]); }
  catch (e) { m = e.message; }
  pruefe('Name statt Kuerzel abgewiesen', /Ungültiges Kürzel/.test(m), true);

  m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'QUATSCH', kw: '2026-W37', punkte: 5 }]); }
  catch (e) { m = e.message; }
  pruefe('unbekannte Art abgewiesen', /Unbekannte Beteiligungsart/.test(m), true);

  m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'MUND', kw: '37', punkte: 5 }]); }
  catch (e) { m = e.message; }
  pruefe('ungueltige Kalenderwoche abgewiesen', /Ungültige Kalenderwoche/.test(m), true);

  m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 11 }]); }
  catch (e) { m = e.message; }
  pruefe('über 10 Punkte abgewiesen', /zwischen 1 und 10/.test(m), true);

  m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 0 }]); }
  catch (e) { m = e.message; }
  pruefe('0 Punkte abgewiesen (nicht beobachtet heißt leer, nicht 0)', /zwischen 1 und 10/.test(m), true);

  m = '';
  try { beteiligungspunkteSpeichern([{ kuerzel: '3L-01', art: 'MUND', kw: '2026-W37', punkte: 5.5 }]); }
  catch (e) { m = e.message; }
  pruefe('Kommazahl abgewiesen', /zwischen 1 und 10/.test(m), true);

  pruefe('nach allen Fehlern nichts geschrieben', ladeAlles().beteiligungspunkte.length, vorher);
}

console.log('\n=== Beteiligungspunkte: ueber doPost erreichbar ===');
{
  const t = holeToken_();
  const p = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    token: t, aktion: 'beteiligungspunkte', aenderungen: [
      { kuerzel: '3M-05', art: 'SCHR', kw: '2026-W38', punkte: 7 }
    ] }) } }).text);
  pruefe('beteiligungspunkte ueber doPost', p.ok, true);
  pruefe('Punkt liegt in der Tabelle',
    ladeAlles().beteiligungspunkte.some(b => b.kuerzel === '3M-05' && b.punkte === 7), true);
}

console.log('\n=== Beteiligungspunkte: keine Klarnamen im Datenpaket ===');
{
  const roh = JSON.stringify(ladeAlles());
  pruefe('kein Klarname in Beteiligungspunkten sichtbar',
    /Musterfrau|Beispiel|Anna|Ben|Bruno/.test(roh), false);
}

// ---------------------------------------------------------------------------
console.log('\n=== Jahresplan einfuegen ===');
{
  const b = jahresplanEinfuegen();
  pruefe('Plan wurde eingetragen', b.eingetragen, true);
  pruefe('26 Einheiten', b.einheiten, 26);
  pruefe('alle Einheiten im Blatt', holeBlatt_('Einheiten').getLastRow() - 1, 26);
  pruefe('Teilthemen ebenfalls', holeBlatt_('Teilthemen').getLastRow() - 1, b.teilthemen);

  const zweiter = jahresplanEinfuegen();
  pruefe('zweiter Aufruf schreibt nichts', zweiter.eingetragen, false);
  pruefe('… und laesst die Zeilen stehen', holeBlatt_('Einheiten').getLastRow() - 1, 26);

  const d = ladeAlles();
  pruefe('Einheiten kommen im Datenpaket an', d.einheiten.length, 26);
  pruefe('nach Reihenfolge sortiert',
    d.einheiten.map(e => e.reihenfolge).every((r, i, a) => i === 0 || a[i - 1] <= r), true);
  pruefe('die erste Einheit laeuft auf beiden Spuren', d.einheiten[0].spur, 'BEIDE');
  pruefe('… und dauert vier Wochen', d.einheiten[0].dauer_wochen, 4);
  pruefe('Teilthemen zeigen auf ihre Einheit',
    d.teilthemen.filter(t => t.einheit_id === d.einheiten[0].id).length, 7);
}

console.log('\n=== Einheiten anlegen, aendern, loeschen ===');
{
  const neu = einheitErstellen('Testeinheit', 'RS', 3, 'test-1');
  pruefe('Einheit angelegt', neu.einheit.id, 'test-1');
  pruefe('landet am Ende', neu.einheit.reihenfolge, 27);
  pruefe('Spur uebernommen', neu.einheit.spur, 'RS');

  einheitAktualisieren('test-1', 'Umbenannt', 'Beschreibung', 'Lehrplan', 5, 12);
  const d = ladeAlles();
  const t = d.einheiten.find(e => e.id === 'test-1');
  pruefe('Titel geaendert', t.titel, 'Umbenannt');
  pruefe('Dauer geaendert', t.dauer_wochen, 5);
  pruefe('Spur bleibt beim Aendern unberuehrt', t.spur, 'RS');
  pruefe('Reihenfolge bleibt beim Aendern unberuehrt', t.reihenfolge, 27);

  let geworfen = '';
  try { einheitErstellen('', 'RS', 1); } catch (e) { geworfen = e.message; }
  pruefe('leerer Titel abgewiesen', /Titel/.test(geworfen), true);

  geworfen = '';
  try { einheitErstellen('X', 'QUATSCH', 1); } catch (e) { geworfen = e.message; }
  pruefe('unbekannte Spur abgewiesen', /Spur/.test(geworfen), true);

  geworfen = '';
  try { einheitErstellen('X', 'RS', 0); } catch (e) { geworfen = e.message; }
  pruefe('Dauer 0 abgewiesen', /Dauer/.test(geworfen), true);

  geworfen = '';
  try { einheitErstellen('X', 'RS', 2.5); } catch (e) { geworfen = e.message; }
  pruefe('Kommazahl als Dauer abgewiesen', /Dauer/.test(geworfen), true);
}

console.log('\n=== Reihenfolge setzen ===');
{
  const d = ladeAlles();
  // Die erste Rechtschreib-Einheit ans Ende der Grammatikspur schieben.
  const saetze = d.einheiten.map((e, i) => ({ id: e.id, spur: e.spur, reihenfolge: i + 1 }));
  saetze[1].spur = 'GR';
  einheitenReihenfolge(saetze);

  const d2 = ladeAlles();
  pruefe('Spur wurde umgesetzt', d2.einheiten[1].spur, 'GR');
  pruefe('Titel blieb erhalten', d2.einheiten[1].titel, d.einheiten[1].titel);
  pruefe('Dauer blieb erhalten', d2.einheiten[1].dauer_wochen, d.einheiten[1].dauer_wochen);

  let geworfen = '';
  try { einheitenReihenfolge([{ id: 'gibtsnicht', spur: 'RS', reihenfolge: 1 }]); }
  catch (e) { geworfen = e.message; }
  pruefe('unbekannte Einheit abgewiesen', /nicht gefunden/.test(geworfen), true);

  geworfen = '';
  try { einheitenReihenfolge([]); } catch (e) { geworfen = e.message; }
  pruefe('leere Reihenfolge abgewiesen', /Reihenfolge/.test(geworfen), true);
}

console.log('\n=== Teilthemen ===');
{
  teilthemaErstellen('test-1', 'Erstes Teilthema', 'tt-1');
  teilthemaErstellen('test-1', 'Zweites Teilthema', 'tt-2');
  let d = ladeAlles();
  pruefe('zwei Teilthemen angelegt', d.teilthemen.filter(t => t.einheit_id === 'test-1').length, 2);
  pruefe('durchnummeriert', d.teilthemen.find(t => t.id === 'tt-2').reihenfolge, 2);

  teilthemaUmbenennen('tt-1', 'Umbenanntes Teilthema');
  d = ladeAlles();
  pruefe('umbenannt', d.teilthemen.find(t => t.id === 'tt-1').titel, 'Umbenanntes Teilthema');

  teilthemenReihenfolge('test-1', ['tt-2', 'tt-1']);
  d = ladeAlles();
  pruefe('neu geordnet', d.teilthemen.find(t => t.id === 'tt-2').reihenfolge, 1);

  let geworfen = '';
  try { teilthemaErstellen('gibtsnicht', 'X'); } catch (e) { geworfen = e.message; }
  pruefe('Teilthema ohne Einheit abgewiesen', /nicht gefunden/.test(geworfen), true);
}

console.log('\n=== Fortschritt je Klasse ===');
{
  fortschrittSpeichern([
    { teilthema_id: 'tt-1', klasse: '3L', erledigt: true },
    { teilthema_id: 'tt-2', klasse: '3M', erledigt: true }
  ]);
  let d = ladeAlles();
  pruefe('zwei Eintraege', d.einheitFortschritt.length, 2);
  pruefe('3L hat tt-1 erledigt',
    d.einheitFortschritt.some(f => f.teilthema_id === 'tt-1' && f.klasse === '3L' && f.erledigt), true);
  pruefe('3M nicht',
    d.einheitFortschritt.some(f => f.teilthema_id === 'tt-1' && f.klasse === '3M'), false);
  pruefe('Datum wurde gesetzt',
    /^\d{4}-\d{2}-\d{2}$/.test(d.einheitFortschritt[0].datum), true);

  // Zuruecknehmen loescht die Zeile, statt sie auf falsch zu setzen.
  fortschrittSpeichern([{ teilthema_id: 'tt-1', klasse: '3L', erledigt: false }]);
  d = ladeAlles();
  pruefe('Zuruecknehmen entfernt die Zeile', d.einheitFortschritt.length, 1);

  let geworfen = '';
  try { fortschrittSpeichern([{ teilthema_id: 'tt-2', klasse: '9Z', erledigt: true }]); }
  catch (e) { geworfen = e.message; }
  pruefe('unbekannte Klasse abgewiesen', /Klasse/.test(geworfen), true);

  geworfen = '';
  try { fortschrittSpeichern([{ teilthema_id: 'gibtsnicht', klasse: '3L', erledigt: true }]); }
  catch (e) { geworfen = e.message; }
  pruefe('unbekanntes Teilthema abgewiesen', /Teilthema/.test(geworfen), true);

  d = ladeAlles();
  pruefe('nach den Fehlern nichts dazugekommen', d.einheitFortschritt.length, 1);
}

console.log('\n=== Kaskaden beim Loeschen ===');
{
  fortschrittSpeichern([{ teilthema_id: 'tt-2', klasse: '3L', erledigt: true }]);
  let d = ladeAlles();
  pruefe('zwei Fortschrittszeilen zu tt-2',
    d.einheitFortschritt.filter(f => f.teilthema_id === 'tt-2').length, 2);

  teilthemaLoeschen('tt-2');
  d = ladeAlles();
  pruefe('Teilthema weg', d.teilthemen.some(t => t.id === 'tt-2'), false);
  pruefe('… und sein Fortschritt gleich mit',
    d.einheitFortschritt.filter(f => f.teilthema_id === 'tt-2').length, 0);

  const bericht = einheitLoeschen('test-1');
  pruefe('Einheit geloescht', bericht.id, 'test-1');
  pruefe('das letzte Teilthema mit', bericht.geloeschteTeilthemen, 1);
  d = ladeAlles();
  pruefe('Einheit ist fort', d.einheiten.some(e => e.id === 'test-1'), false);
  pruefe('kein verwaistes Teilthema', d.teilthemen.some(t => t.einheit_id === 'test-1'), false);

  let geworfen = '';
  try { einheitLoeschen('test-1'); } catch (e) { geworfen = e.message; }
  pruefe('zweites Loeschen abgewiesen', /nicht gefunden/.test(geworfen), true);
}

console.log('\n=== Einheiten ueber doPost erreichbar ===');
{
  const a = doPost({ postData: { contents: JSON.stringify({
    token: holeToken_(), aktion: 'einheitErstellen', titel: 'Über doPost', spur: 'GR', dauer_wochen: 2
  }) } });
  pruefe('einheitErstellen ueber doPost', JSON.parse(a.text).ok, true);

  const id = JSON.parse(a.text).ergebnis.einheit.id;
  const b = doPost({ postData: { contents: JSON.stringify({
    token: holeToken_(), aktion: 'einheitLoeschen', id: id
  }) } });
  pruefe('einheitLoeschen ueber doPost', JSON.parse(b.text).ok, true);
}

console.log('\n=== Einheiten: keine Klarnamen im Datenpaket ===');
{
  const roh = JSON.stringify(ladeAlles());
  pruefe('kein Klarname in Einheiten oder Fortschritt',
    /Musterfrau|Beispiel|Anna|Ben|Bruno/.test(roh), false);
}

console.log('\n=== Jahresplan zuruecksetzen ===');
{
  // Vorher etwas Fortschritt anlegen, damit sich zeigt, dass er mit weggeht.
  const vorher = ladeAlles();
  const einThema = vorher.teilthemen[0];
  fortschrittSpeichern([{ teilthema_id: einThema.id, klasse: '3L', erledigt: true }]);
  pruefe('Fortschritt steht vor dem Zuruecksetzen', ladeAlles().einheitFortschritt.length > 0, true);

  const b = jahresplanZuruecksetzen();
  pruefe('Plan neu eingetragen', b.eingetragen, true);
  pruefe('wieder 26 Einheiten', b.einheiten, 26);

  const d = ladeAlles();
  pruefe('keine doppelten Einheiten', d.einheiten.length, 26);
  pruefe('Fortschritt ist mit weggeraeumt', d.einheitFortschritt.length, 0);
  pruefe('keine verwaisten Teilthemen',
    d.teilthemen.every(t => d.einheiten.some(e => e.id === t.einheit_id)), true);

  // Der inhaltliche Tausch: die Mehrzahlbildung gehoert in den Vorspann,
  // das Zusammensetzen in die Grammatikspur.
  const vorspann = d.einheiten[0];
  pruefe('Vorspann laeuft auf beiden Spuren', vorspann.spur, 'BEIDE');
  const vorspannThemen = d.teilthemen.filter(t => t.einheit_id === vorspann.id).map(t => t.titel);
  pruefe('Mehrzahl steht im Vorspann',
    vorspannThemen.some(t => /Mehrzahl/.test(t)), true);
  pruefe('Zusammensetzen steht NICHT mehr im Vorspann',
    vorspannThemen.some(t => /[Zz]usammensetz/.test(t)), false);
  pruefe('dafuer als eigene Grammatikeinheit',
    d.einheiten.some(e => e.titel === 'Nomen zusammensetzen' && e.spur === 'GR'), true);
  pruefe('keine Einheit heisst mehr "Nomen in der Mehrzahl bilden"',
    d.einheiten.some(e => e.titel === 'Nomen in der Mehrzahl bilden'), false);

  // Heftbezeichnungen ausgeschrieben statt Kuerzel.
  const alleThemen = d.teilthemen.map(t => t.titel).join(' | ');
  pruefe('Seitenangaben nennen das Heft', /\(gr[üu]n, S\. /.test(alleThemen), true);
  pruefe('… auch das pinke', /\(pink, S\. /.test(alleThemen), true);
  pruefe('keine rohen Kuerzel mehr', /\((RS|GR) \d/.test(alleThemen), false);
}

console.log(fehler === 0 ? '\nALLE TESTS BESTANDEN' : `\n${fehler} TEST(S) FEHLGESCHLAGEN`);
process.exit(fehler === 0 ? 0 : 1);
