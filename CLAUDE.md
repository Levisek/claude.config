# Globální pravidla pro Claude Code

> Zkráceno 2026-10-22. Důvody, incidenty a podrobnosti ke každému pravidlu
> jsou v `~/.claude/docs/CLAUDE-pozadi.md` — čti, když pravidlo nedává smysl
> nebo ho chceš měnit.

## Komunikace
- Mluv česky, neformálně
- Bez zbytečných otázek — když je záměr jasný, rovnou jednej
- Stručně, výstižně, žádné zbytečné shrnutí na konci

## Velikost práce rozhoduje o postupu

Postup se řídí velikostí úlohy, ne tím, jaký skill je po ruce:

- **Změna popsatelná jednou větou** → rovnou ji udělej a ověř. Bez
  brainstormingu, plánu a subagentů.
- **Víc souborů, ale jasný postup** → krátký plán v chatu (nebo plan mode),
  pak implementace v hlavním turnu. Spec se nepíše.
- **Velká nebo nejasná věc, nový projekt či subsystém** → brainstorming,
  spec, plán (superpowers), implementace v čisté session nebo přes SDD.

Při pochybnosti jdi o stupeň výš; když se práce během ní ukáže větší,
řekni to a přestup. Uživatel může velikost kdykoliv přebít.

## Práce s kódem
- Nepřepisuj celé soubory, použij Edit tool
- Před změnou přečti soubor, ať vidíš aktuální stav
- Ukazuj jen změněné části kódu
- Drž se zadání — nerozšiřuj rozsah o refaktory a „vylepšení" navíc

## Ověřování

Kontrola, která měří něco jiného, než co tvrdím, je horší než žádná.
Ověřuje se jednou, pořádně, v hlavním turnu — ne opakovaně a ne
dalším agentem „pro jistotu".

- **Ověřuj výsledek, ne cestu.** Doručení a účinek jsou dvě různá tvrzení
  (televize si CSS stáhla ≠ televize ho vykreslí).
- **Ověřovací dotaz nesmí nacházet sám sebe** — před počítáním výskytů
  odstraň komentáře, nebo hledej v tom, co doopravdy čte stroj.
- **Negativní výsledek zapiš jako negativní.** Nasazené a nezabrané
  opatření není „vyřešeno".
- **Ověřuj v prostředí, které to pak spustí** — cron má jiný PATH, jiného
  uživatele a žádného ssh-agenta.
- Na těžkou chybu, kde první pokus nezabral: `/diagnoza`.

## Commit workflow
- Commit message česky, krátký popis + případný kontext
- Žádné Co-Authored-By ani jiné patičky (vynuceno `attribution` v `settings.json`)
- **Message přes heredoc, ne `-m "..."`** — v dvojitých uvozovkách bash
  sežere zpětné uvozovky jako command substitution:

  ```bash
  git commit -F - <<'KONEC'
  Nadpis

  Tělo, kde `?.` i `@supports (x)` projdou beze změny.
  KONEC
  ```
- Pushnutý commit neopravuj `--amend` + force-push kvůli formulaci.

## Procesy a instance — DŮLEŽITÉ

- **Nikdy nezabíjej procesy brute-force** ani podle jména, když můžou patřit
  běžící session uživatele (2026-04-14 `child.kill()` shodilo jeho Chrome).
  Adresný PID ano, `/T` a kill-by-name ne — vynucuje `hooks/block-destructive.js`
  i v `bypassPermissions`.
- **Před spuštěním aplikace (Electron, dev server, prohlížeč) zjisti, jestli
  už běží.** Když ano, zastav se a zeptej — nespouštěj druhou, neshazuj první.
- **Testy a audity:** vždy izolovaná instance — vlastní `--user-data-dir`,
  port a profil; ukončení gracefully (IPC, `app.quit()`), ne SIGKILL.

## Effort a modely

- `settings.json`: `effortLevel: high`, strop `xhigh`; Opus 5.5 má přes
  `modelSettings` `medium`. `xhigh` vědomě přes `/effort xhigh` na
  konkrétní úlohu, `max` jen jednorázově (a jen po smazání stropu).
- Hlavní turn: **opus** (Opus 5.5). Fable přepíná uživatel ručně přes
  `/model`; subagentům ho nedávej (blokuje `permissions.deny`).
- Aliasy `haiku` / `sonnet` / `opus` / `fable` se mapují na nejnovější
  verze — v agent frontmatteru piš alias, ne plné ID.
- Fallback je jen `claude-sonnet-5-5` — pád na Haiku je tichý propad kvality.

## Subagent budget

Subagent se vyplatí na **větší samostatný kus práce** nebo průzkum, jehož
výpisy nechceš v hlavním kontextu. Každý dispatch si kontext staví znovu,
takže na drobnost je dražší než to udělat sám — a Opus 5.x deleguje
ochotněji, než je zdrávo.

**Nedeleguj**, když to zvládneš pár tool cally, když jde o ověření vlastní
práce, nebo když bys jeden malý úkol krájel mezi víc agentů.

Když deleguješ, routing (definice v `~/.claude/agents/<name>.md`, dispatch
přes `subagent_type`):

| úloha | agent | model |
|---|---|---|
| mechanická změna v 1–2 souborech podle jasného zadání | `implementer-mech` | haiku |
| změna přes 3+ souborů, integrace, refaktor přes hranice | `implementer-multi` | sonnet |
| review hotové větve (bugy, bezpečnost, smells) | `code-reviewer` | sonnet |
| ověření, že implementace sedí na spec | `spec-reviewer` | sonnet |
| nepoužité exporty a importy po refaktoru | `dead-code-scanner` | haiku |
| návrhové rozhodnutí, kde si předpoklady odporují | `architect` | opus |

- **Eskalace:** `BLOCKED` / `NEEDS_CONTEXT` → o úroveň výš (haiku → sonnet
  → opus). Opus je strop.
- Výstup subagenta nepřepočítávej a jeho práci nedělej znovu.
- Před dispatchem 2+ subagentů invokuj skill `token-aware`.

### SDD (superpowers) — naše úprava

- **Review jednou na konci větve** (`code-reviewer`, u specu i
  `spec-reviewer`), ne dvojice reviewerů po každém úkolu. Review po úkolu
  jen u rizikových úkolů (bezpečnost, data, migrace, sdílené rozhraní).
- **Paralelně jen nezávislé tracky** — úkoly, které nesdílí soubor ani
  rozhraní, max ~3 naráz. Jinak sériově. Nested dispatch ne.
- Fan-out přes desítky agentů → Workflow, jen na výslovné přání uživatele.

## Dokumentace projektů → Obsidian

Dva vaulty, nemíchají se — o výběru rozhoduje umístění projektu:

| Projekt leží | scope | vault | env override |
|---|---|---|---|
| pod `C:\dev\Work\` | `work` | `C:\dev\Work\Obsidian` | `CLAUDE_OBSIDIAN_VAULT_WORK` |
| kdekoli jinde | `personal` | `C:\dev\vault` | `CLAUDE_OBSIDIAN_VAULT` |

Osobní projekt na pracovním stroji se nedokumentuje — vznikne
`.claude/doc-pending.md`, commitne se a doma ho `doc-check` nabídne.

Hook `doc-check.js` při startu u projektu bez poznámky v `🚀 Projekty/`
přidá pokyn **nabídnout dokumentaci** jednou větou. Odpověď zapiš, jinak se
ptá znovu:

```bash
node ~/.claude/scripts/doc-state.js --skip .           # nechce
node ~/.claude/scripts/doc-state.js --done . "<nota>"  # hotovo (smaže i marker)
node ~/.claude/scripts/doc-state.js --defer .          # odlož, zapíšu doma
node ~/.claude/scripts/doc-state.js --status .         # scope, vault, stav
```

Psaní poznámky řeší skill `obsidian-docs`.

## Odhady

Planning prompty můžou dostat blok „Historical signals" (trvání dispatchů
per repo, `cache/duration-stats.json`). **Ber ho jako prior; P90 je
realistická horní mez** — když intuice říká „jednoduché", zkontroluj, jestli
P90 nesouhlasí.

## Skills

- `token-aware` — routing modelů a snapshot pro status panel
- `electron-security`, `typescript-strict`, `i18n-texts`, `design-tokens`,
  `tsc-verification` — tech pravidla podle projektu
- `/diagnoza` — těžké chyby (smyčka, která zčervená, pak hypotézy)
- `/predani` — předávací dokument pro další session

## Pravidla toho stroje

Co platí jen tady (OS, cesty, rizika) je v `CLAUDE.stroj.md`, který **není
v gitu** — každý stroj má svůj.

@CLAUDE.stroj.md
