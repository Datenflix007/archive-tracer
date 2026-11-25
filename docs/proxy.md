# Eigenen Proxy einrichten (für NARA)

Einige NARA-Daten lassen sich nicht direkt aus dem Browser abrufen, weil der Server keine Browser-Freigabe (CORS) sendet:

- **NSDAP-Mitgliederkartei (A3340):** offener Datensatz im S3-Bucket `nara-nsdap`. Die Dateien sind öffentlich, aber ohne CORS-Header (getestet am 25.11.2026: Preflight `403`).
- **NARA Catalog API v2:** braucht einen persönlichen Key und lieferte zum Prüfzeitpunkt keine CORS-Header.

Dafür gibt es in `proxy/` einen sehr kleinen **Cloudflare Worker**, den jede Person **selbst** einrichtet. archive-tracer selbst hat keinen Server.

## Was der Proxy tut und was nicht

- Er leitet **nur GET-Anfragen** weiter, und zwar **nur** an diese Ziele (`proxy/allowlist.js`):
  - `https://nara-nsdap.s3.us-east-2.amazonaws.com/A3340-…/….json` (Roll-Dateien der Kartei)
  - `https://catalog.archives.gov/api/v2/records/search` (Katalogsuche)
- Er nimmt nur Anfragen von den Websites in `ALLOWED_ORIGINS` an (standardmäßig `https://datenflix007.github.io` und `localhost`).
- Den NARA-Key reicht er nur an `catalog.archives.gov` weiter.
- Er **speichert nichts, cacht nichts und protokolliert nichts**: kein `console.log`, kein Speicher, `Cache-Control: no-store`, Observability in `wrangler.jsonc` ausgeschaltet.
- Weiterleitungen (Redirects) folgt er nicht, damit keine Anfrage bei einem anderen Host landet.

## Einrichtung (ca. 10 Minuten, kostenlos)

Voraussetzungen: [Node.js](https://nodejs.org/) und ein kostenloses [Cloudflare-Konto](https://dash.cloudflare.com/sign-up).

```bash
git clone https://github.com/Datenflix007/archive-tracer.git
cd archive-tracer/proxy
npx wrangler login      # öffnet den Browser zur Anmeldung bei Cloudflare
npx wrangler deploy     # veröffentlicht den Worker
```

Am Ende zeigt `wrangler` die Adresse an, z. B. `https://archive-tracer-proxy.<ihr-name>.workers.dev`.

1. In archive-tracer **Einstellungen → Eigener Proxy** öffnen.
2. Die Adresse eintragen, **Speichern** und **Verbindung testen** klicken.
3. Für den gesamten NARA-Katalog zusätzlich unter **API-Keys** den eigenen NARA-Key eintragen. Den Key gibt es kostenlos per E-Mail an `Catalog_API@nara.gov`. Für die NSDAP-Kartei ist **kein** Key nötig.

### Eigene Domain oder Fork

Wenn Sie archive-tracer unter einer anderen Adresse betreiben, tragen Sie diese in `proxy/wrangler.jsonc` bei `ALLOWED_ORIGINS` ein (kommagetrennt, ohne Schrägstrich am Ende) und führen Sie `npx wrangler deploy` erneut aus.

## Kosten und Grenzen

- Der kostenlose Cloudflare-Tarif erlaubt derzeit 100.000 Anfragen pro Tag. Das reicht für die persönliche Recherche bei Weitem. *Bitte die aktuellen Bedingungen bei Cloudflare prüfen.*
- Eine Suche in der NSDAP-Kartei lädt 2 bis 6 Roll-Dateien zu je etwa 2 bis 3 MB (Rolle mit dem Namen plus Nachbarrollen, Zentral- und Ortsgruppenkartei).
- Die NARA-Katalogsuche zählt gegen das Monatslimit Ihres NARA-Keys (standardmäßig 10.000 Anfragen pro Monat).

## Sicherheit

Teilen Sie die Proxy-Adresse nicht öffentlich. Missbrauch ist durch Allowlist und Origin-Prüfung zwar stark eingeschränkt, aber jede Anfrage zählt gegen Ihr Cloudflare-Kontingent. Den Worker löschen Sie jederzeit im Cloudflare-Dashboard unter *Workers & Pages* oder mit `npx wrangler delete`.
