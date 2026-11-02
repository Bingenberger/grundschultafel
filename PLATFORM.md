# Lokaler Erstzugang

Ein HTTP-Aufruf legt keinen Standardadministrator mehr an. Auf einer neuen
Installation lokal `node scripts/bootstrap.mjs PERSOENLICHER_NAME` ausführen.
Der zufällige Code erscheint ausschließlich auf dem kontrollierenden Terminal,
gilt 15 Minuten und kann nur für eine erfolgreiche Anmeldung verwendet werden.
Die normale Anmeldung bietet dafür „Erstzugang mit Einmalcode“. Beim anschließenden
PIN-Wechsel denselben Code unter dieser Option eingeben und eine eigene PIN setzen.

Bestehende Nutzerdateien werden nicht überschrieben. Nach Verbrauch/Verlust des
Codes ohne abgeschlossenen PIN-Wechsel ist eine lokale administrative Wiederherstellung
erforderlich; es gibt keinen offenen HTTP-Neustart des Bootstrapverfahrens.
Vorhandene Konten und Daten-IDs bleiben erhalten. Bereits vorhandene alte Standardkonten
werden nicht automatisch gelöscht oder verändert; sie müssen individuell geprüft werden.

`users.json` wird mit privaten Rechten atomar ersetzt. Das verhindert halbe Dateien,
ersetzt aber noch keine Transaktion für konkurrierende vollständige Nutzerlisten.
Die Gerätebindung der 30-Tage-Sitzung ist noch nicht umgesetzt.

Tests: `node scripts/test-users.cjs`; `node node_modules/typescript/bin/tsc --noEmit`.
