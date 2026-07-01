# 🖥️ Banking client — Electron (desktop)

A native-feel **desktop** client for the Banking Transactions API, built with **Electron**
(Chromium + Node). It reuses the same Microsoft Fluent look and talks to the same API on
**port 3000**, so it works with **any** of the backends (Java / Go / FastAPI / .NET).

## Prerequisites

- **Node.js 18+**
- A backend running on **http://localhost:3000** (e.g. via `../run.sh`, or any backend)

## Run

```bash
cd homework-1/frontend-electron
npm install        # downloads the Electron runtime (needs internet)
npm start          # opens the desktop window
```

## Features

Transactions list with filters (account / type / date range) and CSV export; create form with
inline validation (maps the backend's `400 details[]` to per-field messages); account tools
(balance, summary, simple interest); a live API-status chip (polls `/actuator/health`); and a
light/dark theme toggle.

## Notes

- The renderer calls `http://localhost:3000` directly. Because the backends don't send CORS
  headers, the window is created with `webSecurity: false` (see `main.js`) — acceptable for a
  local desktop demo; don't do this in a production app.
- Structure: `main.js` (main process → `BrowserWindow`), `renderer/` (`index.html`, `styles.css`,
  `app.js` — plain HTML/CSS/JS, no framework).

> Not runnable in the generation environment (Electron needs a GUI). Run `npm start` locally.
