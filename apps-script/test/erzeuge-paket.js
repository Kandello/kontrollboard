// Nutzt die echte Serverlogik, um ein realistisches Datenpaket zu erzeugen.
const fs = require('fs');
const quelle = fs.readFileSync('test-server.js', 'utf8');
// Testausgabe unterdruecken und nur das Paket schreiben.
const stumm = quelle
  .replace(/^console\.log\(.*$/gm, '')
  .replace(/const pruefe = [\s\S]*?\n};/m, 'const pruefe = () => {};')
  .replace(/process\.exit\([\s\S]*?\);/, '');
eval(stumm);
setzeMeta({ ferienmodus: 'FALSE', link_weekly: 'https://example.org/weekly', link_peak: 'https://example.org/peak', schuljahresbeginn: '2026-09-01' });
fs.writeFileSync('paket.json', JSON.stringify(ladeAlles(), null, 1));
console.log('paket.json geschrieben, Schueler:', ladeAlles().schueler.length);
