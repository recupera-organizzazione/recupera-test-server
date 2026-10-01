#!/bin/sh
# Copia il frontend di Prenota (recupera-prenotazioni/public) in public/prenota, servito su /prenota.
# I percorsi assoluti (/api/..., /health, /client-config, /styles.css, /app.js) diventano relativi,
# così l'app funziona sotto /prenota/ con le API di src/routes/prenota.js. Nessun'altra modifica:
# rieseguire dopo ogni aggiornamento di recupera-prenotazioni (git pull lì prima).
set -e
SORGENTE="${1:-../recupera-prenotazioni/public}"
DEST="$(dirname "$0")/../public/prenota"
mkdir -p "$DEST"
for f in index.html app.js styles.css; do
  sed -e "s#\([\"'\`(]\)/api/#\1api/#g" \
      -e "s#\([\"'(]\)/health\([\"')]\)#\1health\2#g" \
      -e "s#\([\"'(]\)/client-config\([\"')]\)#\1client-config\2#g" \
      -e "s#href=\"/styles.css\"#href=\"styles.css\"#g" \
      -e "s#src=\"/app.js\"#src=\"app.js\"#g" \
      -e "s#class=\"brand\" href=\"/\"#class=\"brand\" href=\"./\"#g" \
      "$SORGENTE/$f" > "$DEST/$f"
done
echo "Frontend Prenota copiato in $DEST da $SORGENTE ($(git -C "$SORGENTE/.." log -1 --format='%h %s' 2>/dev/null))"
