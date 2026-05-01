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

## Installation (Ubuntu-Server)

### 1. Voraussetzungen

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx

# Node.js 22 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 22
```

### 2. Code holen

```bash
git clone https://github.com/DEIN-USERNAME/TafelPopafel.git /var/www/tafelpopafel
cd /var/www/tafelpopafel
```

### 3. Abhängigkeiten & Build

```bash
npm ci
npm run build
```

### 4. Umgebungsvariablen

```bash
nano /var/www/tafelpopafel/.env.local
```

```env
SESSION_SECRET=<zufälliger-64-Zeichen-String>
YOUTUBE_API_KEY=<Google-API-Key>
```

`SESSION_SECRET` generieren:
```bash
openssl rand -hex 32
```

Der `YOUTUBE_API_KEY` ist optional. Ohne ihn können Videos nur per direktem Link eingefügt werden, nicht per Suche.

### 5. Datenverzeichnis anlegen

```bash
mkdir -p /var/www/tafelpopafel/data/admin
mkdir -p /var/www/tafelpopafel/public/assets/uploads
chmod -R 755 /var/www/tafelpopafel/data
chmod -R 755 /var/www/tafelpopafel/public/assets/uploads
```

### 6. Systemd-Dienst

```bash
sudo nano /etc/systemd/system/tafelpopafel.service
```

```ini
[Unit]
Description=TafelPopafel
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/tafelpopafel
ExecStart=/usr/bin/node_modules/.bin/next start -p 3000
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

> Pfad zu `next` ggf. anpassen: `which next` oder `/var/www/tafelpopafel/node_modules/.bin/next`

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tafelpopafel
```

### 7. Nginx als Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/tafelpopafel
```

```nginx
server {
    listen 80;
    server_name tafel.meineschule.de;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/tafelpopafel /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8. HTTPS (empfohlen)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tafel.meineschule.de
```

---

## Erster Start

Beim ersten Start wird automatisch ein Admin-Konto angelegt:

- **Benutzername:** `admin`
- **PIN:** `123456`

Das System erzwingt beim ersten Login eine Änderung der PIN.

Weitere Lehrerkonten können über `/admin` angelegt werden.

---

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Die App ist dann unter [http://localhost:3000](http://localhost:3000) erreichbar.

---

## Datensicherung

Die gesamten Nutzerdaten (Notizbücher, Accounts) liegen in `data/` und sollten regelmäßig gesichert werden:

```bash
rsync -av /var/www/tafelpopafel/data/ /backup/tafelpopafel/data/
rsync -av /var/www/tafelpopafel/public/assets/uploads/ /backup/tafelpopafel/uploads/
```

---

## Lizenz

Schulinternes Projekt der Emrichschule. Nicht zur Weitergabe bestimmt.
