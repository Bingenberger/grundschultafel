# Standalone-Betrieb und Plattformvertrag

## Lokaler Containerstart

Node 22.23.4 (Basisimage mit Digest), Next 16.1.6, amd64. Installation aus
package-lock.json, Next standalone, UID/GID 10001, schreibgeschütztes Root-Dateisystem.
Der lokale Entwicklungstag ersetzt noch kein signiertes Registry-Release.

Im Checkout ausführen:

~~~sh
node scripts/prepare-secret.mjs
export TAFEL_SECRET_FILE="$PWD/.private/session-key"
export BASE_URL="http://localhost:3000"
docker compose build
docker compose run --rm --no-deps app node scripts/migrate.mjs
docker compose up -d --no-build
docker compose exec app node scripts/bootstrap.mjs PERSOENLICHER_NAME
~~~

Das Setup-Skript legt ausschließlich die private Schlüsseldatei an, ohne ihren Inhalt
auszugeben oder eine vorhandene Datei zu ersetzen. SESSION_SECRET_FILE wird erst im
Startprozess gelesen; der Schlüssel steht nicht in Docker.Config.Env.
Für den Schulbetrieb HTTPS am eigenen Reverse Proxy und BASE_URL als exakte
öffentliche Origin konfigurieren. Backend standardmäßig nur 127.0.0.1:3000.
TAFEL_PORT ändert den lokalen Hostport. BASE_URL erzeugt QR-Links zur Laufzeit;
ein Domainwechsel braucht einen Containerneustart, keinen Frontend-Rebuild.

Der Bootstrap-Code erscheint nur auf dem kontrollierenden Terminal, gilt 15 Minuten
und erlaubt eine Anmeldung. Danach unter „Erstzugang mit Einmalcode“ eine persönliche
sechsstellige PIN setzen. Kein gemeinsames Gerätekonto. Kein HTTP-Aufruf erzeugt
Konten. Nach Verlust/Verbrauch ohne PIN-Wechsel ist lokale administrative
Wiederherstellung nötig. Vorhandene Nutzer werden niemals durch Bootstrap ersetzt.
Alte Standardkonten müssen Betreiber individuell prüfen.

## Persistenz und Migration

/data (10001:10001, Verzeichnisse 0700, Dateien 0600) enthält users.json,
schema.json (Version 1), login-attempts.json, verbrauchte Bootstrap-Marker,
Sitzungsdatensätze, Uploadtickets, UUID-Notizbuchverzeichnisse und assets/.
TAFEL_DATA_DIR und TAFEL_ASSET_DIR erlauben andere Pfade; beide vollständig sichern.
Migration ist ein expliziter exklusiver Job. Start führt weder Migration noch
Kontenerstellung aus. /health/live braucht keine Daten; /health/ready verlangt
lesbare gültige Nutzerdaten und Schema 1. Externe Dienste sind dafür nicht erforderlich.

Nutzeränderungen halten eine prozessübergreifende Sperre über Lesen, bcrypt und
atomaren Austausch. Notizbücher werden ebenfalls gesperrt und atomar ersetzt;
PUT höchstens 20 MiB, Konfliktsemantik bleibt letzter erfolgreicher Schreibzugriff.
Keine Versionszusammenführung gleichzeitig bearbeiteter Inhalte. Sperren toter
Prozesse werden anhand PID freigegeben; bei PID-Wiederverwendung kann lokale
Wiederherstellung nötig sein.

Für eine vorhandene Installation zuerst alle Schreiber stoppen und private Kopie
von Daten, Medien und Schlüssel anlegen. Alte users.json und Benutzer-UUID-Verzeichnisse
unter TAFEL_DATA_DIR übernehmen. Optionale eigene alte public/assets-Dateien mit
~~~sh
node scripts/migrate.mjs --import-assets /PFAD/ZUR/EIGENEN/ALTEN/ASSETKOPIE
~~~
importieren (im Container die Kopie eigens schreibgeschützt einbinden).
Identische Dateien bleiben bestehen; Konflikte, Links, Spezialdateien und fremde
Schema-Versionen brechen ab. IDs und Notizbuchinhalt werden nicht umgeschrieben.
Alte flache mobile Uploads ohne verlässliche Eigentümerzuordnung werden erhalten,
aber nicht automatisch öffentlich oder einer Lehrkraft zugänglich gemacht.

Das Image enthält keine ungeklärten Unterrichtsbilder, Logos oder Schriftdateien;
Systemschrift und der vorhandene HTML-Timer funktionieren ohne Schrift-CDN.
Eigene Hintergründe/Journal/RS/Galeriebilder werden in den jeweiligen assets-Unterordnern
durch den Betreiber bereitgestellt. Lizenzentscheidung für App und Medien bleibt nötig;
das Original-README untersagt Weitergabe.

## Sitzungen und Uploads

Acht Stunden lokale Sitzung: signiertes JWT plus zufälliges HttpOnly-Gerätecookie und
serverseitiger Datensatz mit gehashten Kennungen. Beide Cookies sind SameSite=Strict,
unter HTTPS Secure. Ein kopiertes JWT allein reicht nicht. Dies ist keine
Hardwarebindung: ein Angreifer mit beiden Cookies kann die Sitzung übernehmen.
Reset der PIN, Löschung und Abmeldung widerrufen die betroffenen Sitzungen.
Alte JWTs ohne Datensatz verlangen neue Anmeldung. Höchstens zehn Sitzungen pro Konto.
Fünf fehlgeschlagene Anmeldungen sperren den Kontonamen 15 Minuten; Sperre bleibt beim
Neustart. Unbekannte Namen teilen einen begrenzten Fehlversuchseintrag.

Angemeldete Lehrkraft stellt ein 15-Minuten-Ticket für den Smartphone-QR-Link aus.
Das Telefon braucht kein SSO und keine Fachsitzung. Nur ausgestellte Tickets erlauben
einmaligen Upload; Polling und gespeicherte Datei sind ausschließlich für den
Eigentümer zugänglich. PNG/JPEG/WebP mit Dateisignatur, höchstens 5 MiB, zufälliger
Dateiname, keine ausführbaren Uploadpfade. Keine vollständige Bilddecoder-Prüfung.
Maximal 20 offene Tickets pro Lehrkraft, global 2000; 200 Dateien / 100 MiB je
Lehrkraft. Verbrauchte Bilddateien verbleiben für Referenzen, keine automatische
Löschung alter Unterrichtsdateien. QR-Zugänge gehören nicht hinter zusätzliche Anmeldung.

GALLERY_ORIGIN ist standardmäßig leer; externe Galerie dann 503. Bei expliziter
Aktivierung nur die konfigurierte Origin, keine Redirects, Zeit-/Größenlimits.
YouTube-Suche benötigt TAFEL_YOUTUBE_ENABLED=1 und YOUTUBE_API_KEY; sonst 503.
Direkt eingefügte Video-URLs können weiterhin externe Browserabrufe verursachen.
Keine externe SMTP-Verbindung.

## Sicherung, Wiederherstellung und Prüfung

Alle Schreiber stoppen, dann vollständige deklarierte Daten-/Assetpfade samt
Schema, Benutzern, Verbrauchsmarkern und separat Schlüssel sichern. Erst in leeres,
isoliertes Ziel mit gleicher UID/GID und vertrauenswürdigem Prüfsummenmanifest
zurückspielen. Danach Schema, UUIDs, Eigentümerschaft und verweigerte Zugriffe prüfen.
Ein Restore kann alte Sitzungs-/Bootstrapzustände zurückbringen: für Produktion
Widerruf und Schlüsselwechsel als eigenen Wiederherstellungsschritt planen.
Image-Rollback ersetzt keinen Daten-Rollback. Offsite-Verschlüsselung und Rotation
werden durch dieses App-Compose nicht bereitgestellt.

~~~sh
node scripts/test-users.cjs
node scripts/test-runtime.cjs
node node_modules/typescript/bin/tsc --noEmit
~~~

Die Plattform legt ein eigenes Override darüber. Standalone bleibt unabhängig;
OIDC ist für diese App nicht vorgesehen.
