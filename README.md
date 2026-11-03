# TafelPopafel

Digitale Tafelsoftware für die Grundschule — entwickelt für die **Emrichschule**. Läuft im Browser, optimiert für Touchscreens und Android-Tablets, keine Cloud-Abhängigkeit.

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
