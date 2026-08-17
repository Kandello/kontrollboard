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

for (const f of ['Setup', 'Daten', 'Code']) {
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

console.log(fehler === 0 ? '\nALLE TESTS BESTANDEN' : `\n${fehler} TEST(S) FEHLGESCHLAGEN`);
process.exit(fehler === 0 ? 0 : 1);
