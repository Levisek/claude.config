---
name: obsidian-docs
description: Use when documenting a code project into the user's Obsidian vault at C:\dev\vault — triggered by the doc-check SessionStart hook offering documentation for a project with no vault note, or when the user asks to document a project / write it up in Obsidian. Also use when updating an existing project note after significant changes. Do NOT use for in-repo README/docs work that the user did not ask to put in Obsidian.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Obsidian dokumentace projektu

Vault: `C:\dev\vault` (přepíše `CLAUDE_OBSIDIAN_VAULT`). Poznámky projektů jdou
do `🚀 Projekty/`. Konvence jsou převzaté z uživatelova vaultu *Domácí server* —
drž je, ať oba vaulty vypadají a čtou se stejně.

## 1. Založ vault, pokud neexistuje

```bash
node ~/.claude/scripts/vault-init.js
```

Idempotentní — existující soubory nepřepisuje. Vytvoří složky
`🚀 Projekty`, `💡 Poučení`, `🚨 Runbooky` a rozcestník `🏠 Projekty.md`.

> [!warning] Obsidian o novém vaultu neví
> Registruje se v `%APPDATA%\obsidian\obsidian.json`, což je soubor běžící
> aplikace — **needituj ho**. Uživateli řekni, ať jednou udělá
> *Open folder as vault* → `C:\dev\vault`.

## 2. Průzkum před psaním

Nepiš z hlavy. Než sáhneš na Write, zjisti:

- **Co to dělá a proč to vzniklo** — README, package.json `description`, git log
  prvních commitů. Když to není nikde, **zeptej se uživatele**; účel projektu je
  jediná věc, kterou z kódu spolehlivě nevyčteš.
- **Stack a vstupní body** — package.json (deps, scripts), tsconfig, kde je
  `main`/`bin`/`src/index`.
- **Jak se to spouští** — scripts, dev vs. build vs. test.
- **Stav** — aktivní / hotový / opuštěný? Poslední commit, TODO, otevřené větve.
- **Netriviální rozhodnutí** — proč Electron a ne web, proč vlastní hook a ne
  knihovna. Tohle je ta nejcennější část poznámky a v kódu není.

Když projekt už má README, poznámka **není jeho kopie**. README říká *jak to
použít*, vaultová poznámka *co to je, proč to existuje a co jsi se na tom
naučil*. Duplicitní obsah nahraď odkazem do repa.

## 3. Formát poznámky

Název souboru: `<emoji> <Název projektu>.md`. Emoji vyber podle povahy projektu
(🧩 nástroj, 🌐 web, 📱 mobil, 🤖 automatizace, 🎮 hra, 📊 data, ⚙️ konfigurace).

````markdown
---
tags: [projekt, <stack-tag>]
aktualizovano: RRRR-MM-DD
---

# Název projektu

Jedna až dvě věty — co to je. Bez marketingu.

| Údaj | Hodnota |
|---|---|
| Cesta | `C:\dev\...` |
| Repo | github.com/... |
| Stack | Electron + TypeScript |
| Stav | 🟢 aktivní / 🟡 pauza / ✅ hotovo / 🪦 opuštěno |
| Spuštění | `npm run dev` |

## K čemu to je

Problém, který to řeší. Proč nestačilo hotové řešení.

## Jak to funguje

Architektura po vrstvách — jen tolik, aby se v tom šlo za půl roku zorientovat.
Odkazuj na soubory jako `src/main/index.ts`, ne bloky kódu.

## Rozhodnutí a jejich důvody

> [!note] Proč X a ne Y
> Důvod. Co to stálo. Za jakých okolností by se to přehodnotilo.

## Co dál

- [ ] Nedodělky, známé problémy

Souvisí: [[🏠 Projekty]]
````

Pravidla, na kterých vaultu záleží:

- **Česky**, neformálně, stejný tón jako zbytek vaultu.
- **Callouty** místo tučných odstavců: `> [!info]`, `> [!note]`, `> [!warning]`,
  `> [!question]`, `> [!tip]`.
- **Wikilinky** `[[🏠 Projekty]]` — s emoji, přesně jak se soubor jmenuje.
- **Tabulky** na strukturovaná data, ne odrážky `klíč: hodnota`.
- **`aktualizovano`** je dnešní datum, formát `RRRR-MM-DD`.
- Žádná hesla, tokeny ani `.env` hodnoty. Když na ně narazíš, napiš kam patří,
  ne co v nich je.

## 4. Zapiš do rozcestníku

`🏠 Projekty.md` má tabulku všech projektů. Přidej řádek:

```markdown
| [[🧩 Název]] | Jednou větou o čem to je | 🟢 aktivní |
```

## 5. Poznač stav

```bash
node ~/.claude/scripts/doc-state.js --done . "🚀 Projekty/🧩 Název.md"
```

Bez tohohle se hook zeptá znovu při příštím startu.

## Když uživatel odmítne

```bash
node ~/.claude/scripts/doc-state.js --skip .
```

Neptej se znovu a nepřemlouvej.

## Aktualizace existující poznámky

Přečti ji celou, uprav **jen dotčené sekce** přes Edit, přepiš `aktualizovano`.
Nepřepisuj celý soubor — uživatel si tam mohl dopsat vlastní poznámky.

## 💡 Poučení

Když při práci narazíš na netriviální překvapení (něco se tiše chová jinak, než
je čekatelné), patří to jako samostatná poznámka do `💡 Poučení/` — název je
tvrzení, ne otázka: „❗ Docker tiše nahradí chybějící mountpoint". Nabídni to
uživateli, nezakládej to bez ptaní.
