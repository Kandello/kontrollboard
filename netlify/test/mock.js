// Statischer Server fuer netlify/ plus ein Apps-Script-Endpunkt, der die
// ECHTE Serverlogik ausfuehrt (dieselbe Stub-Technik wie
// apps-script/test/test-server.js) statt sie ein zweites Mal von Hand
// nachzubauen. Das schliesst aus, dass Mock und echter Server auseinanderlaufen.
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');

const WURZEL = '/home/user/kontrollboard/netlify';
const APPS_SCRIPT = '/home/user/kontrollboard/apps-script';
const TOKEN = 'testtoken123';
const TYPEN = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json' };

// --- Minimaler Nachbau der Apps-Script-Laufzeit ----------------------------

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
global.SpreadsheetApp = { getActiveSpreadsheet: () => ss, getUi: () => { throw new Error('keine UI im Mock'); } };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) };
global.Utilities = {
  getUuid: () => require('crypto').randomUUID(),
  formatDate: (d, tz, fmt) => {
    const p = (n) => String(n).padStart(2, '0');
    if (fmt === 'yyyy-MM-dd') return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
};
// Fester Zugangsschluessel, damit er zu den Tests passt, die ihn hart codieren.
const props = { zugangsschluessel: TOKEN };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
global.ContentService = {
  MimeType: { JSON: 'json' },
  createTextOutput: (t) => ({ setMimeType() { return { text: t }; } })
};

for (const datei of ['Setup', 'Daten', 'Boards', 'Noten', 'Einheiten', 'Jahresplan', 'Code']) {
  const quelle = fs.readFileSync(`${APPS_SCRIPT}/${datei}.gs`, 'utf8');
  (0, eval)(quelle.replace(/^function (\w+)/gm, 'global.$1 = function $1')
                  .replace(/^var (\w+) =/gm, 'global.$1 ='));
}

// Frisch eingerichtete Tabelle mit den echten 69 Kuerzeln, genau wie in DEPLOY.md.
setupSheets();
importSchuelerAusText(fs.readFileSync('/home/user/kontrollboard/schueler-import.csv', 'utf8'));

// Jahresplan und Schuljahresbeginn, damit die Einheiten-Ansicht etwas zu
// zeigen hat und die Schulwoche bestimmbar ist.
jahresplanEinfuegen();
setzeMeta({ schuljahresbeginn: '2026-08-17' });

// --- HTTP-Server ------------------------------------------------------------

http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (u.pathname === '/exec') {
    if (req.method === 'POST') {
      let rumpf = '';
      req.on('data', (d) => { rumpf += d; });
      req.on('end', () => {
        const antwort = doPost({ postData: { contents: rumpf } });
        res.writeHead(200, cors).end(antwort.text);
      });
      return;
    }
    const antwort = doGet({ parameter: u.query });
    res.writeHead(200, cors).end(antwort.text);
    return;
  }

  let p = path.join(WURZEL, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!p.startsWith(WURZEL)) return res.writeHead(403).end();
  fs.readFile(p, (err, inhalt) => {
    if (err) return res.writeHead(404).end('nicht gefunden');
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    res.end(inhalt);
  });
}).listen(8901, () => console.log('laeuft auf 8901, Zugangsschluessel:', TOKEN));
