#!/bin/sh
#
# hochladen.sh — holt den neuesten Stand und spielt ihn in die Tabelle ein.
#
# Ersetzt das Kopieren jeder einzelnen Datei von Hand in den Apps-Script-
# Editor. Drei Schritte stecken darin:
#
#   1. den neuesten Stand von GitHub holen (git pull)
#   2. die .gs-Dateien ins Apps-Script-Projekt schieben (clasp push)
#   3. eine neue Version veroeffentlichen (clasp deploy)
#
# Schritt 3 ist noetig, weil sich beim Hochladen allein noch nichts an der
# laufenden Web-App aendert: die /exec-Adresse liefert weiterhin die zuletzt
# VEROEFFENTLICHTE Fassung aus. Erst eine neue Version derselben
# Bereitstellung schaltet den neuen Stand scharf — und behaelt dabei die
# Adresse, sodass in der Oberflaeche nichts umgestellt werden muss.
#
# Einmalige Einrichtung siehe EINSPIELEN.md im Wurzelverzeichnis.
#
#   ./hochladen.sh                 (nimmt die Kennung aus .bereitstellung)
#   ./hochladen.sh AKfycb…         (oder ausdruecklich mitgegeben)
#
# Die geschweiften Klammern sind Absicht: sie zwingen die Shell, die ganze
# Datei zu lesen, bevor sie etwas ausfuehrt. Ohne sie koennte `git pull`
# dieses Skript mitten im eigenen Lauf unter den Fuessen austauschen.
{
set -e
cd "$(dirname "$0")"

if ! command -v clasp >/dev/null 2>&1; then
  echo ""
  echo "  clasp ist nicht installiert."
  echo "  Bitte einmalig ausfuehren:  npm install -g @google/clasp@2.4.2"
  echo ""
  exit 1
fi

if [ ! -f .clasp.json ]; then
  echo ""
  echo "  Hier fehlt die Datei .clasp.json — die Verbindung zu deinem"
  echo "  Apps-Script-Projekt. Siehe EINSPIELEN.md, Abschnitt"
  echo "  \"Einmalige Einrichtung\", Schritt \"Verbindungsdatei anlegen\"."
  echo ""
  exit 1
fi

# --- 1. Neuesten Stand holen ------------------------------------------------
if [ -d ../.git ]; then
  echo "[1/3] Neuesten Stand von GitHub holen …"
  if ! git pull --ff-only; then
    echo ""
    echo "  Der neueste Stand liess sich nicht holen."
    echo ""
    echo "  Haeufigste Ursache: auf diesem PC wurde eine Datei veraendert."
    echo "  Wenn du diese Aenderungen NICHT brauchst, verwirf sie mit:"
    echo ""
    echo "      git checkout -- ."
    echo ""
    echo "  und starte danach ./hochladen.sh erneut. Bist du dir unsicher,"
    echo "  frag lieber nach — der Befehl wirft lokale Aenderungen weg."
    echo ""
    exit 1
  fi
else
  echo "[1/3] Kein Git-Verzeichnis gefunden — ueberspringe das Holen."
fi

# --- 2. Dateien hochladen ---------------------------------------------------
echo ""
echo "[2/3] Dateien ins Apps-Script-Projekt hochladen …"
clasp push --force

# --- 3. Veroeffentlichen ----------------------------------------------------
# Die Kennung der Bereitstellung steht in einer eigenen, nicht eingecheckten
# Datei: sie gehoert zur persoenlichen Tabelle, nicht zum geteilten Code.
kennung="$1"
if [ -z "$kennung" ] && [ -f .bereitstellung ]; then
  kennung=$(tr -d ' \t\r\n' < .bereitstellung)
fi

if [ -z "$kennung" ]; then
  echo ""
  echo "[3/3] UEBERSPRUNGEN — hochgeladen, aber noch nicht scharfgeschaltet."
  echo ""
  echo "  Es ist keine Bereitstellung hinterlegt. Einmalig anlegen:"
  echo "  die Bereitstellungs-ID (beginnt mit AKfycb) aus dem Editor unter"
  echo "  \"Bereitstellen -> Bereitstellungen verwalten\" kopieren, dann:"
  echo ""
  echo "      echo AKfycb… > .bereitstellung"
  echo ""
  exit 0
fi

echo ""
echo "[3/3] Neue Version veroeffentlichen …"
clasp deploy -i "$kennung" -d "Stand $(date '+%Y-%m-%d %H:%M')"

echo ""
echo "  Fertig. Die /exec-Adresse liefert jetzt den neuen Stand."
echo "  In der Oberflaeche muss nichts umgestellt werden."
echo ""
exit 0
}
