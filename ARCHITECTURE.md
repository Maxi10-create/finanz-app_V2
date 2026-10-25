# Zielarchitektur – Finanz-App

## Zweck
Erfassung aller Haushalts-, Urlaubs- und Hausbau-Zahlungen von Maximilian und Jana.
Die Finanz-App ist das **Erfassungssystem** (System of Record) für Zahlungen.
Auswertung und Planung des Hausbaus passieren in der Hausbau-App des PersonalAI-Backends
(`localhost:8000/hausbau/`), die die Daten nur liest.

## Systemübersicht

```
┌────────────────────────┐   HTTPS (POST, Session-Token)   ┌──────────────────────┐
│ Frontend (GitHub Pages)│ ──────────────────────────────▶ │ Apps Script Web-App  │
│ index.html + assets/   │ ◀────────────────────────────── │ apps_script/*.gs     │
└────────────────────────┘          JSON                   └──────────┬───────────┘
                                                                      │ SpreadsheetApp
┌────────────────────────┐   action=getall (Service-Token, ┌──────────▼───────────┐
│ PersonalAI-Backend     │   nur lesen)                    │ Google Sheet         │
│ Hausbau-App :8000      │ ──────────────────────────────▶ │ (Datenbank)          │
└────────────────────────┘                                 └──────────────────────┘
```

| Schicht | Technik | Verantwortung |
|---|---|---|
| Frontend | statisches HTML/CSS/JS, Chart.js (CDN) | UI, Validierung, lokaler Daten-Cache |
| API | Google Apps Script Web-App | Auth, Rechte, CRUD, Caching (`CacheService`) |
| Datenhaltung | Google Sheet, ein Tab je Entität | Persistenz, Soft-Delete, Audit-Felder |
| Konsument | PersonalAI-Backend (lokal) | Hausbau-Auswertung, nur `getall` |

## Module

| Modul | Frontend | Backend | Sheets |
|---|---|---|---|
| Kern / Shell | `assets/js/shell.js`, `app.js` | `Code.gs` | – |
| Auth | `assets/js/auth.js` | `Security.gs` | Script-Eigenschaften |
| Haushalt | `app.js` | `Code.gs` | `Income`, `Household_Transactions`, `Fixed_Costs`, `Household_Tasks`, `Shopping_List` |
| Urlaub | `app.js` | `Code.gs` | `Trips`, `Trip_Expenses` |
| Kategorien | `assets/js/categories.js` | `Categories.gs` | `Categories` |
| Hausbau (nur Owner) | `hausbau.js`, `hausbau-import.js` | `Hausbau.gs` | `Build_*`, `Loans`, `Loan_Events` |

## Sicherheit
- Öffentlich nur `ping` und `users` (Namen). Alles andere per POST mit Session-Token (6 h), Sperre nach 5 Fehlversuchen.
- Passwörter nur als Hash in den Script-Eigenschaften, nie im Repo.
- Service-Token für PersonalAI: ausschließlich `getall`.
- Hausbau-Daten liefert der Server nur an den Owner (`HAUSBAU_OWNER`).

## Repo-Struktur

```
finanz-app_V2/
├─ index.html              GitHub-Pages-Einstieg
├─ assets/
│  ├─ css/styles.css
│  └─ js/                  config, auth, shell, app, categories, hausbau, hausbau-import
├─ apps_script/            Code.gs, Security.gs, Categories.gs, Hausbau.gs
├─ docs/                   Sheet-Vorlage (ohne Echtdaten)
├─ ARCHITECTURE.md
└─ README.md
```

## Konventionen
- Cache-Busting: alle Assets in `index.html` mit gemeinsamem `?v=JJJJMMTT<x>`, bei jeder Änderung hochzählen.
- Apps Script: `API_VERSION` und Cache-Schlüssel bei jeder Deploy-Änderung erhöhen.
- Keine Echtdaten, Exporte oder `.DS_Store` im Repo (`.gitignore`).
- Branches `claude/<thema>`, Merge per PR.

## Zielzustand (offene Schritte)
| # | Schritt | Nutzen |
|---|---|---|
| 1 | Repo auf **privat** stellen (enthält Namen, Firmen, Tausendstel) | Datenschutz |
| 2 | `app.js` (≈6.500 Zeilen) in ES-Module je Fachmodul zerlegen (`haushalt.js`, `urlaub.js`, `fixkosten.js`, `api.js`) | Wartbarkeit |
| 3 | `Code.gs` (≈5.000 Zeilen) analog aufteilen (`Income.gs`, `Trips.gs`, …) | Wartbarkeit |
| 4 | Apps Script per `clasp` aus dem Repo deployen statt Copy & Paste | reproduzierbare Deploys |
| 5 | Stammdaten des Hausbaus (Firmen, Tausendstel) aus `hausbau.js` ins Sheet verlagern | keine Personendaten im Code |
