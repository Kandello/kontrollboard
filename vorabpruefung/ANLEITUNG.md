# Vorabprüfung — Anleitung

Dieses kleine Skript gehört **nicht** zur Kommandozentrale. Es beantwortet vorab fünf
technische Fragen, deren Antworten bestimmen, wie die App gebaut wird. Danach kann es
gelöscht werden.

Es liest keine Tabelle, verarbeitet keine Schülerdaten und braucht keine Zuordnungsdatei.

**Zeitaufwand:** etwa 10 Minuten, verteilt auf drei Geräte.

---

## A. Einrichten (einmalig, etwa 3 Minuten)

1. [script.google.com](https://script.google.com) öffnen, oben links auf **Neues Projekt**.
2. Das Projekt oben umbenennen in `Vorabpruefung`.
3. Die vorhandene Datei `Code.gs` links im Editor anklicken, den kompletten Inhalt
   markieren und löschen. Stattdessen den Inhalt von **`vorabpruefung/Code.gs`** einfügen.
4. Links neben „Dateien" auf **+** → **HTML**. Als Namen exakt `Index` eintragen
   (ohne `.html`, das ergänzt Google selbst).
5. Den Inhalt der neuen Datei löschen und den Inhalt von **`vorabpruefung/Index.html`**
   einfügen.
6. Oben auf das Disketten-Symbol (**Speichern**).
7. Oben rechts **Bereitstellen** → **Neue Bereitstellung**.
8. Neben „Typ auswählen" auf das Zahnrad → **Web-App**.
9. Einstellen:
   - **Ausführen als:** Ich
   - **Zugriff:** Nur ich
10. Auf **Bereitstellen**, dann die Berechtigung erteilen. Google zeigt eine Warnung
    („Diese App ist nicht verifiziert") — das ist bei eigenen Skripten normal. Über
    **Erweitert** → **Zu Vorabpruefung wechseln (unsicher)** bestätigen.
11. Google zeigt die **Web-App-URL**. Diese URL kopieren und aufheben — sie wird auf
    allen drei Geräten gebraucht.

---

## B. Messen

Bitte auf **allen drei Geräten** durchführen: dienstlicher PC, privater PC, iPad.

### Auf jedem Gerät

1. Die Web-App-URL öffnen.
2. Ganz oben im Kasten **„Umgebung"** steht die *Adresse dieser Seite*. Diese Zeile bitte
   notieren — sie ist der Kern der ganzen Prüfung.
3. In **Prüfung 1** auf **„Marke setzen"** tippen.
4. Der Reihe nach, und nach jedem Schritt die Seite erneut aufrufen und nachsehen, ob die
   Marke noch da ist:

   | Schritt | Was tun | Was er zeigt |
   |---|---|---|
   | a | Seite neu laden | Speichert der Browser überhaupt? |
   | b | Browser vollständig schließen und neu öffnen | Überlebt es einen Neustart? |
   | c | Im Editor **Bereitstellen → Bereitstellungen verwalten → Stift → Version: Neue Version → Bereitstellen**, danach dieselbe URL aufrufen | **Der eigentliche Ernstfall** |

5. **Prüfungen 2 bis 5** durcharbeiten. Bei 3, 4 und 5 gibt es Knöpfe, mit denen Sie
   angeben, was Sie beobachtet haben — bitte tatsächlich hinsehen und ehrlich antworten,
   das Skript kann es nicht selbst feststellen.
6. Bei Prüfung 5 bitte **in beide Richtungen scrollen**: nach unten (bleibt die Kopfzeile
   oben?) und nach rechts (bleibt die Spalte „Nr." links?).
7. Unten auf **„Bericht erzeugen"**, den Text kopieren und mir zurückschicken. In den
   letzten beiden Zeilen bitte von Hand ergänzen, um welches Gerät es sich handelt und
   nach welchem Schritt (a, b oder c) der Bericht entstand.

### Zusätzlich nur auf dem iPad

Nach Schritt 4c bitte noch einmal, diesmal als Home-Bildschirm-App:

1. Die URL in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. Die App vom Home-Bildschirm starten und die Schritte 3 bis 7 wiederholen.

Das ist wichtig, weil Safari lokalen Speicher nach sieben ungenutzten Tagen löscht — vom
Home-Bildschirm gestartete Apps aber davon ausnimmt. Genau so wird die Kommandozentrale
später auch benutzt.

---

## C. Was die Ergebnisse bedeuten

### Prüfung 1 — lokaler Speicher

Die einzige Prüfung, deren Ergebnis wirklich etwas verändert.

| Beobachtung | Bedeutung |
|---|---|
| Marke überlebt a, b und c | Bestmöglicher Fall. Zuordnung einmal laden, dann dauerhaft da. |
| Marke überlebt a und b, **nicht** c | Nach jeder Code-Änderung müssen Sie die Zuordnungsdatei einmal neu laden. Ein Fingertipp, kein Datenverlust. |
| Marke überlebt nicht einmal a | Ernst. Dann klären wir, ob die Oberfläche woanders hin muss. |

Falls sich die **Adresse** zwischen zwei Aufrufen ändert, erklärt das einen Verlust
vollständig — deshalb bitte diese Zeile jedes Mal mitnotieren.

Wichtig zur Einordnung: Selbst im schlechtesten Fall gehen **keine** Noten,
Kontrollboards oder Einheiten verloren. Die liegen in der Google-Tabelle. Verloren geht
nur die Übersetzung Kürzel → Name, und die liegt als Datei auf Ihrem Gerät.

### Prüfung 2 — Dateidialog

Erwartung: funktioniert nicht. Dann wird der Weg über die normale Dateiauswahl gebaut,
der überall funktioniert. Kein Nachteil, nur ein Dialog mehr.

### Prüfung 3 — Download

Muss funktionieren, sonst lässt sich die Zuordnungsdatei nicht sichern und nicht auf ein
anderes Gerät übertragen.

### Prüfung 4 — Fenster

Betrifft nur eine spätere Druckansicht. Scheitert es, wird stattdessen direkt aus der
Seite gedruckt.

### Prüfung 5 — haftende Spalten

Betrifft die Bedienbarkeit der Kontrollboards. Bleibt nichts stehen, bauen wir die
Tabelle anders auf — der Fall ist eingeplant.

---

## D. Danach

Bitte melden Sie mir die Berichte. Ich werte sie aus, sage Ihnen, was daraus folgt, und
beginne dann mit Schritt 1 des Umsetzungsplans (Datenmodell und `setupSheets()`).

Das Apps-Script-Projekt `Vorabpruefung` können Sie danach löschen. Die eigentliche
Kommandozentrale bekommt ein eigenes Projekt, das an Ihre Google-Tabelle gebunden ist.
