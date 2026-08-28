# Einspielen ohne Copy-Paste

Die `.gs`-Dateien einzeln in den Apps-Script-Editor zu kopieren ist nicht
nötig. Google hat dafür ein eigenes Kommandozeilen-Werkzeug: **clasp**. Nach
einer einmaligen Einrichtung ist jede Aktualisierung ein einziger Befehl.

Diese Datei ist die Kurzreferenz. Die ausführliche Anleitung für Windows,
Schritt für Schritt, gibt es als eigene Seite (siehe Chatverlauf).

---

## Der Alltag

```
cd ~/kontrollboard/apps-script
./hochladen.sh
```

Das Skript holt den neuesten Stand von GitHub, lädt die `.gs`-Dateien ins
Apps-Script-Projekt und veröffentlicht eine neue Version derselben
Bereitstellung. Die `/exec`-Adresse bleibt unverändert.

Die Oberfläche braucht keinen eigenen Schritt: Netlify baut selbst neu,
sobald etwas nach `main` geschoben wird.

Nur wenn sich die Blattstruktur geändert hat, danach in der Tabelle einmal
**Kommandozentrale → Blätter anlegen / prüfen** ausführen. Das ist gefahrlos
und beliebig oft wiederholbar: vorhandene Daten werden nie überschrieben,
fehlende Spalten nur hinten angehängt.

---

## Einmalige Einrichtung

**1. Git und Node.js installieren**

- Git für Windows: <https://git-scm.com/download/win> (bringt *Git Bash* mit,
  das hier durchgehend als Eingabefenster dient)
- Node.js, Fassung **LTS**: <https://nodejs.org>

**2. Das Projekt auf den PC holen**

```
cd ~
git clone https://github.com/Kandello/kontrollboard.git
```

**3. clasp installieren**

```
npm install -g @google/clasp@2.4.2
```

Die Version ist bewusst festgehalten: gegen sie ist `hochladen.sh` geprüft.
Ohne Versionsangabe kommt die jeweils neueste, deren Befehle abweichen können.

**4. Bei Google anmelden**

```
clasp login
```

Der Browser öffnet sich; dort das Google-Konto wählen, dem die Tabelle gehört.

**5. Die Apps Script API freischalten**

Einmalig auf <https://script.google.com/home/usersettings> den Schalter
„Google Apps Script API" auf **an** stellen. Ohne das lehnt clasp jeden
Upload ab — der häufigste Stolperstein.

**6. Das Projekt verbinden**

Die Script-ID steht in der Tabelle unter **Erweiterungen → Apps Script →
Projekteinstellungen → IDs**. Damit:

```
cd ~/kontrollboard/apps-script
echo '{"scriptId":"DEINE_SCRIPT_ID","rootDir":"."}' > .clasp.json
```

**7. Die Bereitstellung hinterlegen**

Im Apps-Script-Editor unter **Bereitstellen → Bereitstellungen verwalten**
die **Web-App-URL** kopieren — gesucht ist der Eintrag, dessen Adresse mit
der in den Einstellungen der Oberfläche übereinstimmt, nicht der mit `@HEAD`
oder auf `/dev`.

```
echo "https://script.google.com/macros/s/AKfycb…/exec" > .bereitstellung
```

Die reine Kennung (`AKfycb…`) tut es auch: das Skript zieht sie ohnehin
selbst aus der Adresse heraus — den Teil hinter dem letzten `/s/`. Auf das
*letzte* `/s/` abgestellt, weil Schul- und Firmenkonten (Google Workspace)
den Domainnamen mitten in der Adresse tragen.

`.clasp.json` und `.bereitstellung` bleiben absichtlich lokal (siehe
`.gitignore`): sie zeigen auf *deine* Tabelle und haben im geteilten Code
nichts zu suchen.

**8. Netlify an GitHub hängen** *(ersetzt das ZIP-Hochladen)*

Unter **Site configuration → Build & deploy → Continuous deployment →
Link repository** das Repository verbinden. Branch `main`, Build command
leer, Publish directory `netlify`.

---

## Nicht mehr im Editor tippen

`clasp push` überschreibt den Stand im Apps-Script-Editor mit dem vom PC.
Direkt im Editor getippte Änderungen gehen dabei verloren. Das Repository ist
ab jetzt die Quelle, Google das Ziel.

`clasp pull` ginge den umgekehrten Weg und würde die lokalen Dateien
überschreiben — im Normalbetrieb also nicht verwenden.
