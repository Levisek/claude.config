---
name: i18n-texts
description: Use when editing UI components (JSX/TSX, Vue/Svelte templates) in projects with i18n infrastructure — detected by `i18next`, `react-i18next`, `vue-i18n`, `react-intl`, or `next-intl` in dependencies, or by presence of `locales/`, `lang/`, or `translations/` directories. All user-facing texts must live in language files; never hardcoded strings in components. Do NOT use for backend code, CLI output, logging, error messages in pure-logic modules, or projects without any i18n setup.
allowed-tools: Read, Edit, Grep, Glob
---

# i18n Text Discipline

## Pravidlo

Žádné user-facing texty jako string literály v komponentách. Vše jde přes i18n lookup.

## Jak poznat user-facing text

- Vše v JSX children: `<button>Uložit</button>` → `<button>{t('actions.save')}</button>`
- Props jako `placeholder`, `aria-label`, `title`, `alt` když obsahují lidskou řeč
- Toast/alert messages: `toast.success('Uloženo')` → `toast.success(t('save.success'))`

## Kde je to OK ponechat natvrdo

- Logovací stringy (`console.log`, `logger.info`)
- Error messages v `throw new Error(...)` — tyhle čte dev, ne user
- Debug stringy (`data-testid`, `data-cy`)
- Klíče samotné (`t('foo.bar')` — `'foo.bar'` je klíč, ne text)

## Přidání nového textu

1. Zjisti namespace / konvenci klíče — viz `references/conventions.md`.
2. Přidej klíč **do všech** existujících jazykových souborů (i s placeholder hodnotou jako `"TODO: translate"` pokud překlad ještě není).
3. V kódu použij `t('nový.klíč')`.
4. Ověř, že fallback jazyk (obvykle `en`) má reálnou hodnotu, ne placeholder.

## Při review

Pokud narazíš na hardcoded text v komponentě:
- Nefixuj mlčky — řekni uživateli `file:line` + navrhni klíč.
- Při batch refaktoru: nejdřív doplň klíče do language files, až pak edit komponent.

## Detekce projektu bez i18n

Pokud `package.json` nemá žádnou i18n lib **a** neexistuje `locales/`/`lang/`/`translations/` — **skill se nepoužije**. User zjevně i18n nepoužívá. Nevkládej novou infrastrukturu bez explicitní žádosti.
