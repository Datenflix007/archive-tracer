# archive-tracer

Ein quelloffenes Recherche-Werkzeug für Angehörige und Forschende. Es hilft, Dokumente zu Personen aus der Zeit des Zweiten Weltkriegs und der Shoah über mehrere Archive hinweg zu finden.

**Online:** <https://datenflix007.github.io/archive-tracer/> (läuft auch offline als installierbare Web-App)

## Was es tut

- **Gemeinsame Suche** in mehreren Archiven und Datenbanken, die eine öffentliche Schnittstelle anbieten.
- **Direkte Links** zu allen weiteren wichtigen Quellen, deren Suche Sie dort selbst ausführen (z. B. Arolsen Archives, Yad Vashem, Gedenkbuch des Bundesarchivs).
- **Recherchemappe** im Browser: Funde übernehmen, eigene Notizen ergänzen, Export als JSON, CSV oder GEDCOM (für Ahnenforschungsprogramme).
- **Herkunft bei jeder Angabe:** Institution, Bestand, Signatur, Link, Abrufdatum und Suchanfrage, dazu ein Zitiervorschlag.
- **„Wie geht es weiter?“**: Vorlagen für schriftliche Anfragen an Arolsen Archives, das Bundesarchiv, die ehemalige WASt und Yad Vashem (Gedenkblätter).

## Grenzen

- Ein Treffer heißt **nicht**, dass es um die gesuchte Person geht. Das Werkzeug führt keine Personen automatisch zusammen. Die Entscheidung treffen Sie.
- Angezeigt werden nur Metadaten, die die Archive selbst über ihre Schnittstellen bereitstellen. Scans oder Dokumente werden weder kopiert noch gespeichert.
- Viele Unterlagen sind nicht online erschlossen. Das Werkzeug ersetzt **keinen Archivbesuch und keine schriftliche Anfrage**.
- Archive ohne offizielle Schnittstelle werden nicht automatisch abgefragt (kein Scraping).

## Quellen

| Quelle | Zugang |
|---|---|
| Archivportal-D (über die API der Deutschen Digitalen Bibliothek) | direkt durchsucht |
| Deutsche Digitale Bibliothek | direkt durchsucht |
| EHRI-Portal | direkt durchsucht |
| Wikidata (Personen und Stolpersteine) | direkt durchsucht |
| Europeana | direkt durchsucht, **eigener API-Key nötig** |
| National Archives (USA), Katalog | Link (Schnittstelle folgt, braucht Proxy und eigenen Key) |
| Arolsen Archives | Link |
| Yad Vashem, zentrale Namensdatenbank | Link |
| Bundesarchiv, Gedenkbuch | Link |
| Bundesarchiv, invenio | Link |
| USHMM Holocaust Survivors and Victims Database | Link |
| Joods Monument | Link |
| Mapping the Lives | Link |
| Stolpersteine Berlin / Hamburg | Link |
| Volksbund, Gräbersuche | Link |
| Bundesarchiv, ehem. Deutsche Dienststelle (WASt) | schriftliche Anfrage |

Die ausführliche Prüfung jeder Quelle (Schnittstelle, Browser-Zugriff, Nutzungsbedingungen, offene Fragen) steht in [docs/sources.md](docs/sources.md).

## Eigene API-Keys (BYOK)

Manche Quellen verlangen einen persönlichen, kostenlosen Schlüssel. Derzeit betrifft das nur **Europeana**:

1. Bei Europeana ein Konto anlegen und unter <https://pro.europeana.eu/page/get-api> einen persönlichen API-Key beantragen.
2. In archive-tracer unter **Einstellungen** eintragen.
3. Der Key gilt standardmäßig nur für den aktuellen Tab. Nur wenn Sie „Auf diesem Gerät merken“ ankreuzen, bleibt er im Browser gespeichert. Oben rechts gibt es jederzeit **„Keys löschen“**.

Keys werden nur an die jeweilige Quelle geschickt, nie an einen anderen Server.

## Datenschutz

Es gibt keinen eigenen Server, kein Tracking und keine Analyse. Suchanfragen gehen direkt aus Ihrem Browser an die Archive. Mappe und Einstellungen liegen nur in Ihrem Browser. Mehr dazu in [docs/ethics-and-privacy.md](docs/ethics-and-privacy.md).

## Entwicklung

```bash
npm install
npm run dev        # lokaler Server
npm test           # Unit-Tests (mit aufgezeichneten Antworten, keine Live-Abfragen)
npm run lint
npm run build      # statischer Build nach dist/
```

Technik: Vanilla TypeScript und Vite, ohne UI-Framework. Die App besteht aus wenigen, überschaubaren Seiten. Ohne Framework bleibt sie klein, schnell und langfristig wartbar, und es gibt keine Laufzeitabhängigkeiten. Pro Quelle gibt es einen Adapter in `src/adapters/` mit einheitlicher Schnittstelle (`search`, `buildDeepLink`, `meta`).

### Veröffentlichung auf GitHub Pages

Bei jedem Push auf `main` prüft und baut die GitHub Action (`.github/workflows/deploy.yml`) die App und veröffentlicht sie. Einmalig nötig: im Repository unter **Settings → Pages → Build and deployment → Source** die Option **„GitHub Actions“** wählen.

## Geplant

Phonetische Namenssuche (Daitch-Mokotoff, Beider-Morse) und transparenter Abgleich der Treffer · optionaler, selbst betriebener Proxy für NARA · optionale KI-Assistenz (Namensvarianten, Transliteration, Entziffern, Übersetzung) mit eigenem Key · Feinschliff für den Offline-Betrieb.

## Lizenz

Vorschlag: **AGPL-3.0**. Wer das Werkzeug verändert und als Webdienst anbietet, muss den geänderten Quellcode ebenfalls offenlegen. Bei einem Werkzeug, das mit sensiblen Daten über Verfolgte arbeitet, bleibt so nachprüfbar, was eine abgewandelte Fassung mit den Daten macht. Wer stattdessen eine möglichst freie Weiterverwendung will, nimmt MIT. Die Entscheidung steht noch aus, eine `LICENSE`-Datei folgt.
