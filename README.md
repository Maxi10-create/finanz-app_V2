# Finanz-App

Erfassung von Haushalts-, Urlaubs- und Hausbau-Zahlungen. Frontend auf GitHub Pages, Backend als Google-Apps-Script-Web-App, Daten im Google Sheet. Architektur: [ARCHITECTURE.md](ARCHITECTURE.md).

## Struktur
| Pfad | Inhalt |
|---|---|
| `index.html` | Einstieg (GitHub Pages) |
| `assets/css/`, `assets/js/` | Frontend |
| `apps_script/` | Backend (`Code.gs`, `Security.gs`, `Categories.gs`, `Hausbau.gs`) |
| `docs/` | Sheet-Vorlage ohne Echtdaten |

## Setup
1. Google Sheet anlegen (Vorlage: `docs/GoogleSheet_Backend_Struktur.xlsx`).
2. Inhalte von `apps_script/` unter **Erweiterungen › Apps Script** einfügen, als Web-App deployen.
3. Web-App-URL in `assets/js/config.js` (`API_BASE_URLS`) eintragen.
4. Nutzer und Passwörter im Sheet-Menü **Security** anlegen – nie im Repo.

## Sicherheit
- Daten nur nach Login (Session-Token 6 h, Sperre nach 5 Fehlversuchen).
- Öffentlich nur `ping` und `users` (Namen).
- PersonalAI-Backend liest per eigenem Service-Token (nur `getall`).

## Release
Bei Frontend-Änderungen `?v=` in `index.html` hochzählen, bei Backend-Änderungen `API_VERSION` in `Code.gs`.
