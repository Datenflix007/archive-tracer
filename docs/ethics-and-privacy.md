# Ethik, Datenschutz und Recht

> Hinweis: Dieses Dokument ist keine Rechtsberatung. Stellen, an denen die Rechtslage unsicher ist, sind ausdrücklich gekennzeichnet.

## Grundsätze

1. **Respekt vor den Menschen, um die es geht.** Viele Datensätze stammen aus Verwaltung und Verfolgung, etwa Deportationslisten, Häftlingskarteien oder Vermögensakten. Das Werkzeug übernimmt die Sprache der Täter nicht als eigene. Es spricht von Menschen, nicht von Fällen.
2. **Keine automatischen Schlüsse.** Treffer gelten nicht als Belege für eine Identität. Personen werden nicht automatisch zusammengeführt. Die Entscheidung trifft ein Mensch, und die Begründung gehört in die Notiz.
3. **Herkunft immer sichtbar.** Jede Angabe trägt Institution, Bestand, Signatur, Link, Abrufdatum und Suchanfrage.
4. **Nichts spiegeln.** Es werden nur Metadaten angezeigt, die eine offizielle Schnittstelle liefert, immer mit Link zum Original. Scans und Dokumente fremder Archive werden weder gespeichert noch weitergegeben.
5. **Kein Scraping, keine internen Schnittstellen.** Quellen ohne offizielle API werden nur verlinkt.

## Datenschutz (DSGVO)

- **Kein Server, keine Telemetrie.** archive-tracer ist eine statische Website. Es gibt kein Backend, kein Tracking, keine Cookies und keine Analyse.
- **Direkte Abfragen.** Suchbegriffe gehen aus dem Browser direkt an die jeweilige Quelle. Dort gelten deren Datenschutzbestimmungen. Die angefragten Archive sehen dabei Ihre IP-Adresse und Ihren Suchbegriff.
- **Lokale Speicherung.** Die Recherchemappe liegt in der IndexedDB des Browsers, die letzte Suche im sessionStorage (gelöscht beim Schließen des Tabs). API-Keys liegen standardmäßig ebenfalls im sessionStorage und nur auf ausdrücklichen Wunsch im localStorage.
- **Lebende Personen.** Die DSGVO schützt Verstorbene nicht (Erwägungsgrund 27). Recherchen berühren aber oft **lebende Nachfahren**, etwa in Entschädigungs- oder Wiedergutmachungsakten mit Angaben zu Kindern und Enkeln. Wer Ergebnisse veröffentlicht (Website, Buch, Stolperstein-Biografie), ist selbst für den Schutz dieser Daten verantwortlich. *Unsicher:* Wie weit das postmortale Persönlichkeitsrecht in Deutschland reicht, hängt vom Einzelfall ab.
- **Gemeinsam genutzte Geräte.** Auf fremden Rechnern Keys nicht dauerhaft speichern und die Mappe nach Gebrauch exportieren und leeren.

## Schutzfristen (Bundesarchivgesetz)

Für Archivgut des Bundes gelten Schutzfristen (§ 11 BArchG). Personenbezogenes Archivgut darf grundsätzlich erst **10 Jahre nach dem Tod** der Person genutzt werden. Ist das Todesjahr unbekannt, gilt eine Frist von **100 Jahren nach der Geburt**, ist auch das Geburtsjahr unbekannt, **60 Jahre nach Entstehung** der Unterlagen. Auf Antrag ist eine Verkürzung möglich, etwa für wissenschaftliche Vorhaben oder für Angehörige. Für Landes- und Kommunalarchive gelten die jeweiligen Landesarchivgesetze mit teils abweichenden Fristen. *Bitte die aktuelle Fassung des Gesetzes und die Auskunft des Archivs prüfen.*

## Nutzungsbedingungen der Quellen

Der Stand vom 25.11.2026 mit allen offenen Punkten steht in [sources.md](sources.md). Kurz zusammengefasst:

- **NARA:** Inhalte aus der API nicht zwischenspeichern, keine Massenabfrage, Pflichthinweis „This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.“ Für NARA-Treffer speichert die Mappe deshalb nur Kennung, Link und eigene Notizen. Gilt, sobald die NARA-Schnittstelle angebunden ist.
- **Deutsche Digitale Bibliothek / Archivportal-D:** Die Attribution wird angezeigt. Die aktuellen API-Bedingungen waren zum Prüfzeitpunkt nicht abrufbar (*unsicher*).
- **EHRI:** Daten mit besonders schützenswerten personenbezogenen Angaben dürfen nur zu Forschungszwecken genutzt werden.
- **USHMM:** Inhalte dürfen ohne schriftliche Zustimmung nicht zum Training von Machine-Learning-Systemen verwendet werden. Relevant für die geplante KI-Assistenz.
- **Arolsen Archives, Yad Vashem, Joods Monument und andere:** nur Links, keine automatische Abfrage.

## NSDAP-Mitgliederkartei (NARA A3340)

- Die Karteien sind **Verwaltungsunterlagen der NSDAP**, also Täterüberlieferung. Sie sind weder vollständig noch neutral.
- Ein Treffer belegt **keine** Identität: Namensgleichheit ist häufig, und die Texterkennung ist fehlerhaft (z. B. „Mohnung“ statt „Wohnung“). Auch Ortsnamen erscheinen als Treffer (z. B. „Kr. Goldberg“).
- Ein fehlender Treffer beweist nicht, dass jemand kein Mitglied war. Die Überlieferung hat Lücken, und es werden nur ausgewählte Rollen durchsucht.
- Maßgeblich sind das Kartenbild und der archivische Zusammenhang. Weitere Unterlagen (z. B. ehemaliges Berlin Document Center, heute Bundesarchiv) können die Angaben ergänzen oder widerlegen.
- Bei Veröffentlichungen über Mitglieder sind die Persönlichkeitsrechte **lebender Angehöriger** zu beachten.

## Was das Werkzeug nicht ersetzt

Online-Datenbanken bilden nur einen kleinen Teil der Überlieferung ab. Viele Bestände sind nicht digitalisiert, nicht erschlossen oder nur vor Ort einsehbar. Eine **schriftliche Anfrage** und der **Besuch im Archiv** bleiben unverzichtbar. Vorlagen dafür bietet die Seite „Wie geht es weiter?“.

## KI-Assistenz (geplant)

Die optionale KI-Assistenz (eigener Anthropic-Key) darf nur helfen: Namensvarianten, Transliteration, Entziffern hochgeladener Scans, Übersetzung, Formulierung von Anfragen. Sie liefert keine Fakten. Ihre Ausgaben werden als KI-generiert gekennzeichnet und nie ohne Quelle als Tatsache gespeichert.
