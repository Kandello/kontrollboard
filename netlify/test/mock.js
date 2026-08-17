// Statischer Server fuer netlify/ plus nachgebauter Apps-Script-Endpunkt.
const http = require('http'), fs = require('fs'), path = require('path'), url = require('url');
const WURZEL = '/home/user/kontrollboard/netlify';
const PAKET = JSON.parse(fs.readFileSync('/home/user/kontrollboard/apps-script/test/paket.json', 'utf8'));
const TOKEN = 'testtoken123';
const TYPEN = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.webmanifest':'application/manifest+json' };

http.createServer((req, res) => {
  const u = url.parse(req.url, true);
  const cors = { 'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json' };

  if (u.pathname === '/exec') {
    if (req.method === 'POST') {
      let rumpf = '';
      req.on('data', d => rumpf += d);
      req.on('end', () => {
        let b = {}; try { b = JSON.parse(rumpf); } catch (e) {}
        if (b.token !== TOKEN) return res.writeHead(200, cors).end(JSON.stringify({ ok:false, fehler:'Zugang verweigert.' }));
        if (b.aktion === 'meta') {
          Object.assign(PAKET.meta, b.werte || {});
          return res.writeHead(200, cors).end(JSON.stringify({ ok:true, ergebnis:{ gespeichert:Object.keys(b.werte||{}).length } }));
        }
        if (b.aktion === 'wochenstatus') {
          const kw = String(b.kw || ''), auf = String(b.aufgabe || '').toUpperCase();
          if (!/^\d{4}-W\d{2}$/.test(kw)) return res.writeHead(200, cors).end(JSON.stringify({ ok:false, fehler:'Ungültige Kalenderwoche.' }));
          PAKET.wochenstatus = PAKET.wochenstatus.filter(w => !(w.kw === kw && w.aufgabe === auf));
          if (b.erledigt) PAKET.wochenstatus.push({ kw, aufgabe: auf, erledigt_am: new Date().toISOString().slice(0,10) });
          return res.writeHead(200, cors).end(JSON.stringify({ ok:true, ergebnis:{ kw, aufgabe:auf, erledigt:!!b.erledigt } }));
        }
        return res.writeHead(200, cors).end(JSON.stringify({ ok:false, fehler:'Unbekannte Aktion.' }));
      });
      return;
    }
    if (u.query.token !== TOKEN) return res.writeHead(200, cors).end(JSON.stringify({ ok:false, fehler:'Zugang verweigert. Bitte den Zugangsschlüssel in den Einstellungen prüfen.' }));
    if (u.query.aktion === 'ping') return res.writeHead(200, cors).end(JSON.stringify({ ok:true, stand:new Date().toISOString() }));
    if (u.query.aktion === 'laden') return res.writeHead(200, cors).end(JSON.stringify({ ok:true, daten:PAKET }));
    return res.writeHead(200, cors).end(JSON.stringify({ ok:false, fehler:'Unbekannte Aktion.' }));
  }

  let p = path.join(WURZEL, u.pathname === '/' ? 'index.html' : u.pathname);
  if (!p.startsWith(WURZEL)) return res.writeHead(403).end();
  fs.readFile(p, (err, inhalt) => {
    if (err) return res.writeHead(404).end('nicht gefunden');
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(p)] || 'application/octet-stream' });
    res.end(inhalt);
  });
}).listen(8901, () => console.log('laeuft auf 8901'));
