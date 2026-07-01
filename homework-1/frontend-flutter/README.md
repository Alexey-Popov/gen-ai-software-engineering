# 📱 Banking client — Flutter Web

A **Flutter Web** client for the Banking Transactions API (Dart + Material 3). It talks to the
same API on **port 3000**, so it works with **any** backend (Java / Go / FastAPI / .NET).

## Prerequisites

- **Flutter SDK 3.4+** with web enabled (`flutter config --enable-web`), and Chrome
- A backend running on **http://localhost:3000**

## Run

```bash
cd homework-1/frontend-flutter
flutter pub get
# --disable-web-security lets the browser call :3000 without CORS (dev only):
flutter run -d chrome --web-browser-flag "--disable-web-security"
```

If Flutter reports missing platform files, generate them once (keep the provided
`lib/main.dart` — restore it from git if the command overwrites it):

```bash
flutter create . --platforms=web
```

Build a static bundle:

```bash
flutter build web
```

## Features

Transactions list with filters (account / type / date range) and CSV export; a create form that
maps the backend's `400 details[]` to per-field errors; account tools (balance, summary, simple
interest); a live API-status chip (`/actuator/health`); and a light/dark theme toggle
(Material 3, brand-blue seed color).

## Notes on CORS

Browsers enforce CORS, and the backends don't send CORS headers. For local development this app
is launched with Chrome's web security disabled (flag above). The production-correct alternative
is to enable CORS on the backend. `dart:html` is used to trigger the CSV download, so this
target is **web-only**.

> Not runnable in the generation environment (no Flutter SDK there). Run it locally with the
> commands above.
