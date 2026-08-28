# Einspielen ohne Copy-Paste

Die `.gs`-Dateien einzeln in den Apps-Script-Editor zu kopieren ist nicht
nötig. Google hat dafür ein eigenes Kommandozeilen-Werkzeug: **clasp**. Nach
einer einmaligen Einrichtung von etwa zehn Minuten ist jedes weitere
Einspielen ein einziger Befehl.

---

## Einmalige Einrichtung

**1. Node.js und clasp installieren**

Node.js von <https://nodejs.org> (die LTS-Fassung genügt), danach im
Terminal bzw. in der Eingabeaufforderung:

```
npm install -g @google/clasp
```

**2. Bei Google anmelden**

```
clasp login
```

Es öffnet sich der Browser; dort das Google-Konto wählen, dem die Tabelle
gehört. Die Anmeldung landet in `~/.clasprc.json` und hält dauerhaft.

**3. Die Apps Script API freischalten**

Einmalig auf <https://script.google.com/home/usersettings> den Schalter
„Google Apps Script API" auf **an** stellen. Ohne das lehnt clasp jeden
Upload ab — das ist der Stolperstein, an dem es sonst gern scheitert.

**4. Die Script-ID heraussuchen**

In der Tabelle: **Erweiterungen → Apps Script**, dort links
**Projekteinstellungen** (Zahnrad) → **IDs → Script-ID** kopieren.

**5. Das Projekt verbinden**

Im Ordner `apps-script/` eine Datei `.clasp.json` anlegen — mit der eben
kopierten ID:

```json
{
  "scriptId": "HIER_DIE_SCRIPT_ID",
  "rootDir": "."
}
```

Die Datei ist bewusst nicht im Repository (siehe `.gitignore`): sie zeigt
auf *deine* Tabelle und hat im geteilten Code nichts zu suchen.

**6. Die Bereitstellung hinterlegen** *(macht Schritt „scharfschalten"
automatisch)*

```
cd apps-script
clasp deployments
```

Das listet die vorhandenen Bereitstellungen. Gesucht ist die, deren Adresse
in der Oberfläche unter Einstellungen steht — die Kennung beginnt mit
`AKfycb…`. Diese Kennung in eine Datei schreiben:

```
echo AKfycb… > .bereitstellung
```

Auch diese Datei bleibt lokal.

---

## Ab jetzt: ein Befehl je Aktualisierung

```
cd apps-script
./hochladen.sh
```

Das lädt alle `.gs`-Dateien hoch **und** veröffentlicht eine neue Version
derselben Bereitstellung. Die `/exec`-Adresse bleibt dabei unverändert — in
der Oberfläche muss also nichts umgestellt werden.

Unter Windows ohne Git-Bash gehen die beiden Schritte auch von Hand:

```
clasp push --force
clasp deploy -i AKfycb… -d "Stand heute"
```

---

## Warum zwei Schritte?

`clasp push` schiebt den Code ins Projekt — die laufende Web-App liefert
aber weiterhin die zuletzt *veröffentlichte* Fassung aus. Erst eine neue
Version der Bereitstellung schaltet den neuen Stand scharf. Genau das ist
auch im Editor der Unterschied zwischen „Speichern" und „Bereitstellen".

---

## Wenn sich die Blattstruktur geändert hat

Bei manchen Aktualisierungen kommt eine Spalte oder ein Blatt hinzu. Dann
nach dem Hochladen einmal in der Tabelle **Kommandozentrale → Blätter
anlegen / prüfen** ausführen. Das ist gefahrlos und beliebig oft
wiederholbar: vorhandene Daten werden nie überschrieben, fehlende Spalten
nur hinten angehängt.

---

## Was mit `clasp pull` passiert — Vorsicht

`clasp pull` holt den Stand *aus Google zurück* und überschreibt dabei die
lokalen Dateien. Das ist nur sinnvoll, wenn direkt im Editor etwas geändert
wurde, das noch nicht im Repository steht. Sonst gehen damit genau die
Änderungen verloren, die eingespielt werden sollten. Im Normalfall ist das
Repository die Quelle und Google das Ziel — also nur `push`.

---

## Und die Oberfläche (netlify.zip)?

Dasselbe Thema, andere Hälfte. Netlify kann direkt aus GitHub bauen: unter
**Site configuration → Build & deploy → Link repository** das Repository
verbinden und als Veröffentlichungsverzeichnis `netlify` angeben. Danach
genügt ein `git push`, und die Seite aktualisiert sich von selbst — das
Hochladen der ZIP-Datei entfällt vollständig.
