# Finanzpaket Phase 1 komplett

Enthalten:
- index.html
- styles.css
- app.js
- auth.js
- config.js
- apps_script/Code.gs
- GoogleSheet_Backend_Struktur.xlsx

## Stand dieses Pakets
Dieses Paket enthält Phase 1 – Schritt 1 bereits vollständig integriert:
- Login-Screen
- Nutzerwahl: Maximilian Hofer / Jana March
- Login gegen das Apps Script (Passwörter nur als Hash in den Script-Eigenschaften)
- Blaues Theme für Maximilian
- Pinkes Theme für Jana
- Logout
- created_by / updated_by / owner_user bei neuen Datensätzen vorbereitet

## Wichtige Hinweise
1. Nutzer und Passwörter werden im Google Sheet über das Menü **Security** angelegt, nie im Repo.
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

## Sicherheit
- Alle Daten nur nach Login (Session-Token, 6 h), Sperre nach 5 Fehlversuchen.
- `ping` und `users` (nur Namen) sind öffentlich, alles andere nicht.
- Lesezugriff für das PersonalAI-Backend über ein eigenes Token (Menü Security).
