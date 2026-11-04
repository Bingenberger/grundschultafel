# TafelPopafel

Digitale Tafelsoftware für die Grundschule — entwickelt für die **Emrichschule**. Läuft im Browser, optimiert für Touchscreens und Android-Tablets, keine Cloud-Abhängigkeit.

<!-- schulplattform:installation -->
## Installation

### Im Rahmen der Schulplattform

Empfohlen für den Schulserver: Die [Schulplattform](https://github.com/Bingenberger/schulplattform) installiert diese App zusammen mit den
anderen Schul-Apps auf einem leeren Ubuntu-24.04-Server, mit eigener Subdomain, TLS-Zertifikat, Mailversand,
Sicherung und Dashboard. Sie verwendet das signierte Release-Image `ghcr.io/bingenberger/grundschultafel`
und die unveränderte `docker-compose.yml` dieses Repositorys plus eine Override-Datei.

1. In der Plattformkonfiguration (`./install.sh configure` bzw. `/etc/schulplattform/platform.toml`)
   unter `[apps.grundschultafel]` `enabled = true` und den Hostnamen setzen, z. B. `tafel.ihre-schule.de`,
   und beim DNS-Provider einen A-Eintrag auf den Server anlegen.
2. `./install.sh apply …` installiert die App. Migration, Proxy, Zertifikat und Sicherung übernimmt die Plattform.
3. `./install.sh app-setup grundschultafel` legt eine Lehrkraft mit persönlichem Erstzugang an (`node scripts/bootstrap.mjs NAME`); das Kennwort wird beim ersten Login geändert.
4. Daten vom bisherigen Server übernehmen: `./install.sh import grundschultafel …` nach dem
   [Umzugs-Runbook](https://github.com/Bingenberger/schulplattform/blob/main/docs/betrieb/umzug.md).

### Standalone mit Docker Compose

Ohne Plattform, z. B. zum Ausprobieren oder für einen eigenen Server mit eigenem Proxy.
Benötigt Docker Engine mit Compose v2 (amd64). Die App lauscht danach nur auf `http://127.0.0.1:3000`.

```sh
node scripts/prepare-secret.mjs            # benötigt Node.js ≥ 22 auf dem Host
export TAFEL_SECRET_FILE="$PWD/.private/session-key"
export BASE_URL="http://localhost:3000"
docker compose build
docker compose run --rm --no-deps app node scripts/migrate.mjs
docker compose up -d --no-build
docker compose exec app node scripts/bootstrap.mjs PERSOENLICHER_NAME
```

Statt selbst zu bauen, kann das veröffentlichte Image verwendet werden (dann `docker compose build` weglassen):

```sh
docker pull ghcr.io/bingenberger/grundschultafel:0.1.0 && docker tag ghcr.io/bingenberger/grundschultafel:0.1.0 grundschultafel:0.1.0-dev
```
<!-- /schulplattform:installation -->

## Features

### Zeichenwerkzeuge
- **Stift** — Freihandzeichnen mit einstellbarer Farbe und Stärke, inkl. Geradeziehen (Lineal-Snap)
- **Textmarker** — Freihandzeichnen mit 50 % Transparenz und einstellbarer Breite
- **Radierer** — Pixelgenauer Radierer mit Größenanzeige (gestrichelter Kreis), optimiert für schwache Android-SoCs
- **Text** — Textfelder einfügen und bearbeiten
- **Füllwerkzeug** — Flächen mit Farbe füllen
- **Formen** — Rechteck, Kreis, Dreieck, Linie mit einstellbarer Strich- und Füllfarbe
- **Lineal** — Interaktives Lineal zum Ziehen gerader Linien
- **RS-Stift** — Stift-Modus für Rechtschreib-Symbole (Mitsprechwort, Baustein, Ableitung, Verlängerung, Merkwort, Großschreibung, Kürzezeichen)

### Inhalte einfügen
- **Bilder** — Upload vom lokalen Rechner oder per QR-Code vom Smartphone
- **YouTube-Videos** — Suche oder direktes Einfügen per Link, Wiedergabe inline auf der Tafel
- **Timer** — Sanduhr und digitaler Countdown als verschiebbare Widgets
- **Hintergründe** — Farbhintergründe und Vorlagen (z. B. Lineatur 1)

### Seitenmanagement
- Mehrere Seiten pro Notizbuch, beliebig hinzufügen, löschen, umschalten
- Notizbücher speichern, laden, umbenennen und löschen
- Journal-Seitenleiste mit vorgefertigten Tagesstruktur-Bildern

### Benutzerverwaltung
- Mehrere Lehrerkonten mit PIN-Login (keine Passworteingabe, nur Tastenfeld)
- Login-Seite zeigt alle Accounts als Schaltflächen — Lehrkraft wählt sich selbst aus
- Admin-Konto für Nutzerverwaltung
- Erzwungener Passwortwechsel beim ersten Login
- Brute-Force-Schutz (5 Fehlversuche → 15 Minuten Sperre)
- JWT-Sessions, serverseitig signiert

---

## Technologie

| Schicht | Technologie |
|---------|-------------|
| Framework | Next.js 16 (App Router) |
| Canvas | Fabric.js 7 |
| State | Zustand |
| Auth | jose (JWT) + bcryptjs |
| Styling | Tailwind CSS 4 + CSS-Variablen |
| Laufzeit | Node.js 22 |

Nutzerdaten und Notizbücher werden als JSON-Dateien im `data/`-Verzeichnis gespeichert — keine Datenbank nötig.

---

## Installation und Betrieb

Die eigenständige Compose-Installation, Migration, persönliche Erstzugänge,
Sitzungswiderruf und Sicherung sind in [PLATFORM.md](PLATFORM.md) beschrieben.
Es gibt kein automatisch angelegtes Standardkonto.

## Lizenz

Schulinternes Projekt der Emrichschule. Nicht zur Weitergabe bestimmt.
