# Finanzpaket Phase 1 komplett

Enthalten:
- index.html
- styles.css
- app.js
- auth.js
- config.js
- users.csv
- apps_script/Code.gs
- GoogleSheet_Backend_Struktur.xlsx

## Stand dieses Pakets
Dieses Paket enthält Phase 1 – Schritt 1 bereits vollständig integriert:
- Login-Screen
- Nutzerwahl: Maximilian Hofer / Jana March
- Passwortprüfung aus users.csv
- Blaues Theme für Maximilian
- Pinkes Theme für Jana
- Logout
- created_by / updated_by / owner_user bei neuen Datensätzen vorbereitet

## Wichtige Hinweise
1. `users.csv` kann lokal geändert werden.
2. Für Apps Script bitte `Code.gs` direkt im Google Sheet über **Erweiterungen > Apps Script** einfügen.
3. Danach als Web-App deployen.
4. In `config.js` ist die aktuell funktionierende Apps-Script-URL eingetragen.

## Projektordner
Alle Web-Dateien gehören in denselben Ordner:
- index.html
- styles.css
- app.js
- auth.js
- config.js
- users.csv
