import type { PersonQuery } from '../types';
import { fullName } from '../lib/query';
import { append, copyText, extLink, h } from './dom';
import { loadQuery } from './state';

interface Template {
  id: string;
  title: string;
  intro: string;
  link: { href: string; text: string };
  body: (q: PersonQuery) => string;
}

const person = (q: PersonQuery) =>
  [
    `Name: ${fullName(q) || '[Vorname Nachname]'}`,
    `Geburtsname: ${q.birthName || '[falls abweichend]'}`,
    `Weitere Schreibweisen: ${q.variants.join(', ') || '[falls bekannt]'}`,
    `Geburtsdatum: ${q.birthDate || (q.birthYear ? `ca. ${q.birthYear}` : '[TT.MM.JJJJ oder Jahr]')}`,
    `Geburtsort: ${q.birthPlace || '[Ort]'}`,
    `Letzter bekannter Wohnort: ${q.lastResidence || '[Ort, ggf. Adresse]'}`,
    `Eltern: ${q.parents || '[falls bekannt]'}`,
  ].join('\n');

const sign = '\n\nMit freundlichen Grüßen\n[Ihr Name]\n[Anschrift]\n[E-Mail]';

const TEMPLATES: Template[] = [
  {
    id: 'arolsen',
    title: 'Arolsen Archives',
    intro:
      'Die Arolsen Archives beantworten Anfragen von Angehörigen und Forschenden kostenlos. Die Anfrage stellen Sie am besten über das Online-Formular auf der Website.',
    link: { href: 'https://arolsen-archives.org/en/search-explore', text: 'Arolsen Archives: Suchen & Anfragen' },
    body: (q) =>
      `Sehr geehrte Damen und Herren,\n\nich suche Informationen über folgende Person, die während der Zeit des Nationalsozialismus verfolgt wurde:\n\n${person(q)}\n\nBekannt ist mir bisher: [z. B. Deportation, Lager, Zwangsarbeit, Emigration, Displaced Person].\n\nIch bin [Verwandtschaftsverhältnis, z. B. Enkelin / Forschender]. Ich bitte um Auskunft und, falls vorhanden, um Kopien der Dokumente.${sign}`,
  },
  {
    id: 'bundesarchiv',
    title: 'Bundesarchiv (Personen- und Familienforschung)',
    intro:
      'Für Auskünfte zu einer Person braucht das Bundesarchiv einen ausgefüllten und unterschriebenen Benutzungsantrag. Formular und zuständige Stellen finden Sie auf der Seite zur Personen- und Familienforschung.',
    link: {
      href: 'https://www.bundesarchiv.de/im-archiv-recherchieren/archivgut-recherchieren/personen-und-familienforschung/',
      text: 'Bundesarchiv: Personen- und Familienforschung',
    },
    body: (q) =>
      `Sehr geehrte Damen und Herren,\n\nim Rahmen einer [familiengeschichtlichen / wissenschaftlichen] Recherche bitte ich um Auskunft, ob im Bundesarchiv Unterlagen zu folgender Person vorhanden sind:\n\n${person(q)}\n\nBereits gefundene Hinweise: [z. B. Eintrag im Gedenkbuch, Signaturen aus invenio/Archivportal-D].\n\nDen unterschriebenen Benutzungsantrag füge ich bei.${sign}`,
  },
  {
    id: 'wast',
    title: 'Bundesarchiv, ehem. Deutsche Dienststelle (WASt)',
    intro:
      'Die Unterlagen der früheren Deutschen Dienststelle (WASt) zu Wehrmachtsangehörigen und Kriegsgefangenen gehören heute zum Bundesarchiv. Auskünfte gibt es nur auf schriftlichen Antrag.',
    link: {
      href: 'https://www.bundesarchiv.de/im-archiv-recherchieren/archivgut-recherchieren/personen-und-familienforschung/',
      text: 'Bundesarchiv: Hinweise und Antrag',
    },
    body: (q) =>
      `Sehr geehrte Damen und Herren,\n\nich bitte um Auskunft aus den Unterlagen der ehemaligen Deutschen Dienststelle (WASt) zu folgender Person:\n\n${person(q)}\n\nBekannte Angaben zum Militärdienst bzw. zur Gefangenschaft: [Einheit, Feldpostnummer, Dienstgrad, Ort/Datum von Tod oder Vermisstsein].\n\nMein Verwandtschaftsverhältnis: [z. B. Enkel]. Einen Nachweis lege ich bei, falls erforderlich.${sign}`,
  },
  {
    id: 'yadvashem',
    title: 'Yad Vashem – Gedenkblatt (Page of Testimony)',
    intro:
      'Mit einem Gedenkblatt können Angehörige und Bekannte an ermordete Jüdinnen und Juden erinnern. So kommen ihre Namen in die zentrale Datenbank. Prüfen Sie vorher in der Namensdatenbank, ob es schon ein Gedenkblatt gibt. Das Formular stellt Yad Vashem auf der eigenen Website bereit. Die Angaben unten helfen beim Ausfüllen.',
    link: { href: 'https://collections.yadvashem.org/en/names', text: 'Yad Vashem: Namensdatenbank' },
    body: (q) =>
      `Angaben für das Gedenkblatt (Page of Testimony):\n\n${person(q)}\nBeruf: [falls bekannt]\nEhepartner/in: [falls bekannt]\nWohnorte vor und während des Krieges: [Orte]\nUmstände und Ort des Todes: [soweit bekannt; Quelle angeben]\n\nAngaben zur ausfüllenden Person: [Name, Anschrift, Beziehung zur Person]`,
  },
];

export function renderNext(main: HTMLElement): void {
  const q = loadQuery();
  append(main, [
    h('h1', { tabindex: '-1' }, 'Wie geht es weiter?'),
    h(
      'p',
      { class: 'lead' },
      'Online-Datenbanken zeigen nur einen Teil der Überlieferung. Viele Akten sind nicht digitalisiert oder nicht im Netz erschlossen. Eine schriftliche Anfrage und ein Archivbesuch können sie nicht ersetzen.',
    ),
    h(
      'p',
      {},
      'Die Vorlagen werden mit den Angaben aus Ihrer letzten Suche gefüllt. Eckige Klammern markieren Stellen, die Sie ergänzen müssen. Bitte prüfen Sie vor dem Absenden auf den verlinkten Seiten, welche Formulare und Wege die Archive aktuell vorsehen.',
    ),
    ...TEMPLATES.map((t) => {
      const text = t.body(q);
      const area = h('textarea', { rows: 14, 'aria-label': `Vorlage ${t.title}` });
      area.value = text;
      return h(
        'section',
        { class: 'template' },
        h('h2', {}, t.title),
        h('p', {}, t.intro),
        h('p', {}, extLink(t.link.href, t.link.text)),
        area,
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => void copyText(area.value) }, 'Text kopieren')),
      );
    }),
  ]);
}
