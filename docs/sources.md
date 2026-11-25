# Quellenprüfung (Phase 0)

Stand: **25.11.2026**. Alle Angaben unten beruhen auf echten Requests von diesem Tag und auf den offiziellen Dokumentationsseiten, soweit sie lesbar waren. Was nicht geprüft werden konnte, steht ausdrücklich unter „Offen / unsicher“.

## Methode

- **CORS-Test:** `GET` mit `Origin: http://localhost:5173`, ausgewertet wird `Access-Control-Allow-Origin`. Wenn die API einen Key im Header erwartet, folgt zusätzlich ein Preflight (`OPTIONS` mit `Access-Control-Request-Headers`). Das entspricht dem, was ein Browser von einer localhost-Seite aus prüft. Ein Test in einem echten Browser folgt im MVP. Die Adapter-Fixtures werden dabei aufgezeichnet.
- **Deep-Links:** Pro Seite ein einzelner `GET` auf die öffentliche Suchseite und eine Analyse des HTML-Suchformulars (Methode GET/POST, Feldnamen). Es wurden **keine** Ergebnisseiten ausgewertet und **keine** internen Endpunkte angesprochen.
- **Hinweis:** Archivportal-D, das DDB-Portal und das EHRI-Portal beantworten Abrufe ohne Browser mit einer Bot-Challenge (Anubis). Für Menschen im Browser ist das unproblematisch, für die APIs gilt es nicht.

## Einstufung

| # | Quelle | Einstufung | Key | CORS (getestet) | Abfrage auf Personenebene | Deep-Link (vorausgefüllt) |
|---|---|---|---|---|---|---|
| 1 | NARA Catalog API v2 | **api-proxy** (vorläufig) | ja, pro Nutzer (BYOK, per E-Mail) | ❌ derzeit nicht prüfbar (siehe unten) | Volltext `q=` | `catalog.archives.gov/search?q=…` (unverifiziert, SPA) |
| 2 | Deutsche Digitale Bibliothek (API v2) | **api-browser** | nein (v2) | ✅ `*`, auch Preflight | Volltext; eigener Index `person` (GND) | `deutsche-digitale-bibliothek.de/searchresults?query=…` |
| 3 | Archivportal-D (über DDB API v2) | **api-browser** | nein | ✅ `*` | Volltext + Filter `fq=sector_fct:sec_01` | `archivportal-d.de/objekte?query=…` |
| 4 | EHRI Portal API v1 | **api-browser** | nein | ✅ `*` | Volltext; Typen `DocumentaryUnit`, `HistoricalAgent` u. a. | `portal.ehri-project.eu/search?q=…` |
| 5 | Europeana Search API | **api-browser** | ja, persönlicher Key (BYOK) | ✅ `*`, Preflight mit `x-api-key` ok | Volltext | `europeana.eu/de/search?query=…` |
| 6 | Wikidata SPARQL | **api-browser** | nein | ✅ `*`, `Api-User-Agent` erlaubt | ja (strukturiert: Name, Geburtsdatum/-ort, Stolpersteine) | `wikidata.org/w/index.php?search=…` |
| 7 | Arolsen Archives (Online-Archiv) | **deeplink-only** | – | – | nur im Portal | `collections.arolsen-archives.org/en/search?s=…` (lädt, Vorbelegung im Browser zu prüfen) |
| 8 | Bundesarchiv Gedenkbuch | **deeplink-only** | – | – | nur im Portal | ❌ nur Suchseite `apps.bundesarchiv.de/gedenkbuch/directory` (JSF-POST, nicht vorbelegbar) |
| 9 | Bundesarchiv invenio | **deeplink-only** | – | – | nur im Portal (teilweise über Archivportal-D abgedeckt) | ❌ nur Startseite; Einzelstücke per `invenio.bundesarchiv.de/invenio/direktlink/<uuid>/` |
| 10 | Yad Vashem, Central Database of Shoah Victims' Names | **deeplink-only** | – | – | nur im Portal | `collections.yadvashem.org/en/names/search-results?q=…` (SPA, Parameter unverifiziert) |
| 11 | USHMM Holocaust Survivors and Victims Database | **deeplink-only** | – | – | nur im Portal | ❌ derzeit nur Einstiegsseite (Such-URL nicht verifizierbar, Server 400/502) |
| 12 | Joods Monument | **deeplink-only** | – | – | nur im Portal | `joodsmonument.nl/en/search?q=…` (HTTP 200) |
| 13 | Mapping the Lives | **deeplink-only** | – | – | nur im Portal | ❌ nur Startseite (SPA, kein Parameter bekannt) |
| 14 | Stolpersteine-Datenbanken (lokal: Berlin, Hamburg …) | **deeplink-only** | – | – | nur im Portal | Berlin: `stolpersteine-berlin.de/de/stolpersteine-finden?name=…`; Hamburg: `stolpersteine-hamburg.de/suchergebnisse?search=…` (GET-Formular) |
| 15 | Volksbund Gräbersuche online | **deeplink-only** | – | – | nur im Portal | ❌ nur Suchseite (TYPO3-POST mit cHash, nicht vorbelegbar) |
| 16 | Deutsche Dienststelle (WASt), heute Bundesarchiv | **manual-request** | – | – | nur schriftlich | Link auf das Antragsformular/Infoseite des Bundesarchivs |

Stolpersteine sind über **Wikidata** zusätzlich per API durchsuchbar: Am 25.11.2026 gab es 55.012 Einträge mit `P31 = Q26703203` (Stolperstein). Diese Abfrage läuft im Wikidata-Adapter. Die lokalen Datenbanken bleiben reine Deep-Links.

## Details pro Quelle

### 1. NARA Catalog API v2 — api-proxy (vorläufig)
- **Doku:** <https://www.archives.gov/research/catalog/help/api> (zuletzt geprüft 01.05.2026), <https://github.com/usnationalarchives/Catalog-API>. Endpunkt laut Doku: `https://catalog.archives.gov/api/v2/records/search?q=…`, Header `x-api-key`.
- **Key:** Pflicht, ein Key pro Person, Antrag per E-Mail an `Catalog_API@nara.gov`. Keys, die 12 Monate lang nicht genutzt werden, werden deaktiviert. Ausdrücklich: Den Key nicht veröffentlichen. Das passt zu BYOK.
- **Limit:** 10.000 Anfragen pro Monat und Key. Bei Überschreitung ist der Key bis zum Monatsersten gesperrt.
- **Nutzungsbedingungen (wörtlich):** „Users will not scrape data or attempt to download all data from the Catalog via the API“ · „**Please do not cache or store any content returned by the API.**“ · Pflichthinweis: „This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.“ Die Metadaten gelten als gemeinfrei.
- **Test 25.11.2026:** Alle Pfade unter `/api/v2/` (auch die Swagger-Seite `/api/v2/api-docs`) liefern mit und ohne Key-Header die HTML-Seite der Web-App (`X-Cache: Error from cloudfront`), ohne CORS-Header, und auch der Preflight bekommt keine CORS-Header. Mit einem gültigen Key ließ sich das nicht prüfen. In der Doku zeigt eine Beispielantwort vom Mai 2025 `access-control-allow-origin: *`.
- **Einstufung:** Vorerst **api-proxy**, die vorsichtige Variante. Sobald ein Test mit gültigem Key zeigt, dass der Preflight für `x-api-key` durchgeht, stufe ich auf api-browser hoch. Dein Tool *NARA Trace* weiß hier vermutlich mehr.

### 2. Deutsche Digitale Bibliothek — api-browser
- **Endpunkt:** `https://api.deutsche-digitale-bibliothek.de/2/search/index/search/select?q=…` (Solr-Syntax: `fq`, `rows`, `start`, `fl`, Facetten). Weitere Indizes: `person` (GND-Personen mit Lebensdaten), `organization`. OpenAPI-Spezifikation: `/2/q/openapi`.
- **Key:** Ohne Key getestet, die Antwort war HTTP 200. Die alten v1-Endpunkte (`/search`) liefern ohne Key `403 NotAuthorizedException`, und für v1 gibt es keine neuen Keys mehr. Laut DDB-Wiki (über die Suche gefunden, Seite nicht direkt lesbar) sind „alle Endpunkte in Version 2 ohne API-Key nutzbar“.
- **CORS:** `Access-Control-Allow-Origin: *`, Preflight ok (auch für `Authorization`).
- **Lizenz:** Pro Datensatz gibt es die Felder `metadata_rights` / `license`. Im Test-Datensatz stand CC0.
- **Datenformat:** Solr-JSON mit Feldern wie `label`, `provider`, `apd_reference_number` (Signatur), `apd_context` (Tektonik/Bestandspfad), `begin_time`/`end_time`, Link zum Original-Findmittel. Für Herkunft und Zitat ist alles Nötige vorhanden.

### 3. Archivportal-D — api-browser (über die DDB-API)
- Archivportal-D ist die Archivsparte der DDB. Der Filter `fq=sector_fct:sec_01` beschränkt die Suche auf Archivgut.
- Test „Goldberg“: 9.979 Archivtreffer. Die größten Anbieter waren Landesarchiv Berlin (3.909), Sächsisches Staatsarchiv (3.136), Archive in NRW (500) und **Bundesarchiv (373)**. Die invenio-Bestände sind also zum Teil über diesen Weg abgedeckt.
- Deep-Link zum Datensatz: `https://www.archivportal-d.de/item/<id>`.

### 4. EHRI Portal API — api-browser
- **Endpunkt:** `https://portal.ehri-project.eu/api/v1/search?q=…&type=…&limit=…` (höchstens 100), JSON:API (`application/vnd.api+json`). Die Doku nennt die API selbst „an experimental web API“.
- **Key:** keiner. **CORS:** `*`. Ein Rate Limit ist nicht dokumentiert, der Adapter drosselt deshalb selbst.
- **Personenebene:** Namen tauchen vor allem in den Titeln von `DocumentaryUnit` auf, im Test z. B. „Goldberg Chaya – Goldberg Sura“ aus französischen Beständen. `HistoricalAgent` steht für Normdaten (Personen und Körperschaften).

### 5. Europeana — api-browser (BYOK)
- **Endpunkt:** `https://api.europeana.eu/record/v2/search.json?query=…`. Der Key gehört laut Doku in den Header `X-Api-Key`, der Parameter `wskey` ist „deprecated“.
- **Key:** Ein persönlicher Key ist kostenlos, setzt aber ein Europeana-Konto voraus. Der Demo-Key `api2demo` funktioniert zwar, wird aber nicht als Produktions-Key dokumentiert und wird deshalb **nicht** eingebaut.
- **CORS:** `*`, der Preflight mit `x-api-key` ist erlaubt. Response-Header im Test: `ratelimit-policy: "project";q=1000000;w=3600` (gilt für das Demo-Projekt). Die Limits für persönliche Keys wurden laut Doku „bis April 2026 schrittweise reduziert“, Zahlen nennt sie nicht.

### 6. Wikidata SPARQL — api-browser
- **Endpunkt:** `https://query.wikidata.org/sparql?format=json&query=…`. **CORS:** `*`, der Header `Api-User-Agent` ist ausdrücklich erlaubt. Den setzen wir laut User-Agent-Policy der Wikimedia Foundation, mit Projekt-URL statt persönlicher Kontaktdaten.
- **Limits:** 60 s pro Abfrage, 60 s Rechenzeit pro Minute und Client, 5 parallele Abfragen pro IP, bei Überlast HTTP 429 mit `Retry-After`.
- **Achtung:** WDQS v1 bleibt laut Doku „through June 2027“ verfügbar, ab Februar 2027 kann der Dienst schlechter werden. Der Adapter bekommt deshalb einen konfigurierbaren Endpunkt.

### 7. Arolsen Archives — deeplink-only
- Eine öffentliche, dokumentierte API gibt es nicht. Die Website nutzt interne Endpunkte, und die sind nach den harten Regeln tabu. Es bleibt bei Deep-Link und manueller Übernahme.
- `collections.arolsen-archives.org/en/search?s=<Name>` antwortet mit HTTP 200. Ob die Suche damit vorbelegt wird, prüfe ich im MVP im Browser, weil die Ergebnisse erst im Browser per JavaScript geladen werden.

### 8. Bundesarchiv Gedenkbuch — deeplink-only
- Die Seite ist umgezogen: `bundesarchiv.de/gedenkbuch` leitet auf `apps.bundesarchiv.de/gedenkbuch/` um. Die Suche ist ein JSF-Formular (POST mit `javax.faces.ViewState`), lässt sich also nicht per URL vorbelegen. Das Tool verlinkt auf die Suchseite und zeigt die Suchbegriffe zum Kopieren an.
- Die Felder dort (Nachname, Vorname, Geburtsname, Geburtsort, Wohnort, Deportation …) dienen als Vorlage für die Kopierhilfe.

### 9. Bundesarchiv invenio — deeplink-only
- Eine öffentliche API ist nicht dokumentiert, ebenso keine Such-URL mit Vorbelegung. Zu einzelnen Archivalien gibt es Direktlinks (`/invenio/direktlink/<uuid>/`). Der Inhalt ist teilweise über Archivportal-D erreichbar (siehe 3).
- Das Bundesarchiv selbst schreibt, eine namensweite Suche über das ganze Archiv sei nicht möglich. Personenanfragen laufen über einen unterschriebenen Benutzungsantrag.

### 10. Yad Vashem (Names Database) — deeplink-only
- Eine öffentliche API ist nicht dokumentiert. Die Seite ist eine SPA, deshalb ist der Parameter `q` nicht verifiziert. Die Nutzungsbedingungen (`yadvashem.org/terms-of-use.html`) waren für den Abruf gesperrt (HTTP 403) und sind **ungelesen**.

### 11. USHMM HSV — deeplink-only
- `ushmm.org/online/hsv/…` antwortete mit 400 bzw. 502, `collections.ushmm.org/search/` mit 404 bzw. Verbindungsabbruch. Lesbar war die Infoseite der Datenbank (Suchmodi: Exakt, Fuzzy, D-M-Soundex). Eine API gibt es nicht.
- **Nutzungsbedingungen (Stand 09.05.2025, wörtlich):** „Without the Museum's written consent, you may not use any of the Museum's Content to train, fine-tune, or otherwise develop any machine learning …“. Für die KI-Assistenz ist das relevant, siehe unten.

### 12. Joods Monument — deeplink-only
- Eine API gibt es nicht. Laut Disclaimer wird die Datenbank auf Anfrage an Forschende und Institutionen weitergegeben. Das wäre ein möglicher späterer Kooperationsweg, aber nicht Teil dieses Tools. „All rights reserved“.

### 13. Mapping the Lives — deeplink-only
- Die Seite ist eine SPA. Ein Suchparameter, eine API oder Nutzungsbedingungen waren nicht ermittelbar. Das Tool verlinkt auf die Startseite.

### 14. Stolpersteine-Datenbanken — deeplink-only (zusätzlich über Wikidata per API)
- Berlin: Listensuche mit den Parametern `name`, `street`, `district` (aus den Links der Seite abgelesen, 11.160 Einträge). Eine Open-Data-Lizenz ist nicht angegeben.
- Hamburg: GET-Formular `suchergebnisse?search=…`.
- Weitere Städte können später als reine Linkliste dazukommen.

### 15. Volksbund Gräbersuche — deeplink-only
- Das Formular ist ein TYPO3-POST mit cHash, eine Vorbelegung ist nicht möglich. Felder: Vorname, Nachname, Geburtsdatum, Geburtsort, Todes-/Vermisstendatum. Eine API gibt es nicht. Stand laut Seite: 5.428.995 Einträge.

### 16. WASt / Deutsche Dienststelle — manual-request
- Seit 2019 im Bundesarchiv (Abteilung PA). Es gibt keine Online-Suche, Auskunft nur auf schriftlichen Antrag. Eine Vorlage kommt auf die Seite „Wie geht es weiter?“.

## Offen / unsicher (ausdrücklich nicht geraten)

1. **NARA:** CORS-Verhalten mit gültigem Key ungetestet, die API wirkte am 25.11.2026 nicht erreichbar (CloudFront-Fehlerseite). Außerdem steht **„do not cache or store any content returned by the API“** im Widerspruch zu einer Recherchemappe, die Metadaten speichert. Vorschlag: Für NARA-Treffer speichert die Mappe nur NAID, Link, Abrufdatum, Abfrage und die eigenen Notizen der Nutzenden. Der Titel wird bei Bedarf neu geladen. → **Deine Entscheidung.**
2. **DDB-Nutzungsbedingungen:** Die API-Terms (`/content/terms/api`) sind derzeit nicht erreichbar (404), das Wiki ist zu Atlassian umgezogen. Ältere Fassungen verlangten einen Key und ein „Powered by Deutsche Digitale Bibliothek“-Logo. Die Attribution baue ich vorsorglich ein, die Rechtslage bleibt unbestätigt. Eine kurze Nachfrage bei `service@deutsche-digitale-bibliothek.de` wäre sinnvoll.
3. **EHRI-Nutzungsbedingungen:** Die Seite war durch die Bot-Challenge nicht lesbar. Laut Data-Policy-Hinweis dürfen Daten mit besonderen Kategorien personenbezogener Daten nur zu Forschungszwecken genutzt werden.
4. **Yad Vashem / Arolsen / Joods Monument / Mapping the Lives:** Deep-Link-Parameter muss ich im MVP im echten Browser prüfen. Die Nutzungsbedingungen von Yad Vashem sind ungelesen.
5. **USHMM und KI:** Die Bedingungen verbieten, Inhalte des Museums zum Training von ML zu nutzen. Wenn Nutzende USHMM-Text an die Claude-API schicken, ist das nach meiner Einschätzung kein Training (die Anthropic API trainiert standardmäßig nicht auf API-Eingaben). Rechtlich gesichert ist das nicht. Vorschlag: ein Hinweis in der UI.
6. **Wikidata WDQS v1:** Einschränkungen ab Februar 2027, Abschaltung ab Juli 2027 angekündigt. Der Endpunkt wird deshalb konfigurierbar.
