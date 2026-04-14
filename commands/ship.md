---
description: Commit + push jedním krokem. Navrhne zprávu, jedno potvrzení, hned pushne.
---

# /ship — commit + push v jednom

Rychlá cesta od dirty tree na remote. Jedno potvrzení, žádné zbytečné otázky. Pro případy, kdy víš, že to chceš poslat ven.

## Postup

### 1. Kontroly před commitem (paralelně, Bash)
- `git status --short` — co je dirty?
- `git rev-parse --abbrev-ref HEAD` — aktuální branch
- `git rev-parse --abbrev-ref @{u} 2>/dev/null` — má upstream?
- `git log --oneline -10` — styl předchozích commit messages
- Pokud je TS projekt (`tsconfig.json` existuje): `npx tsc --noEmit` (volitelný skip pokud trvá déle než 20 s)

### 2. Early returns

- **Čistý strom** → `✓ Nothing to ship. Pracovní strom čistý.` a konec.
- **Detached HEAD** → odmítni: `⚠ Jsi v detached HEAD. Nejdřív si vytvoř branch.` a konec.
- **TSC fail** (pokud se spustilo) → ukaž chyby v unicode boxu a zeptej se:
  - `Pokračovat přesto?` → ano / ne. Pokud ne, konec.
- **Citlivé soubory v dirty** (`.env`, `*.key`, `*.pem`, `credentials*`) → varuj a zeptej se, jestli je opravdu commitovat.

### 3. Návrh commit message
- Stejný styl jako `/commit`: česky, krátký subject (~60 znaků), případně body.
- Respektuj styl z `git log` (pokud má repo prefixy typu `feat:`, `fix:`, použij je).

### 4. Zobraz návrh + ship info

````
╭─ ship ──────────────────────────────────────╮
│  branch    <branch>                         │
│  upstream  <origin/branch> / (není!)        │
│  změny     <N> souborů                      │
│  tsc       ✓  (nebo — nebo ✗ s warningem)  │
╰─────────────────────────────────────────────╯

Navrhovaná zpráva:
<subject>

<body pokud existuje>

Bude shippnuto:
  M  soubor1
  A  soubor2
  ?? soubor3 (untracked — bude přidán)
````

### 5. Jedno potvrzení (AskUserQuestion)

Otázka: **„Commit + push?"**

Možnosti:
- **Ship** — stage, commit, push. Recommended.
- **Jen commit** — bez push.
- **Upravit zprávu** — uživatel napíše vlastní.
- **Zrušit** — nic neprovede.

### 6. Provedení

**Ship varianta:**
1. `git add -A` na tracked + nové soubory, které dávají smysl. Vynech:
   - to co je v `.gitignore`
   - podezřelé: `.env`, `*.key`, `*.pem`, `credentials*`, `*.token`, `.credentials.json`, `node_modules/`, `dist/`, `build/`, `.next/`, `coverage/` — i kdyby nebyly v .gitignore.
2. `git commit -m "<message>"` (HEREDOC pro víceřádkové zprávy, bez `--amend` a bez `--no-verify`).
3. Pokud branch nemá upstream: `git push -u origin <branch>`.
4. Jinak: `git push`.

**Jen commit:** jak `/commit`, ale bez otázky (už je potvrzeno).

**Upravit zprávu:** zeptej se textově na novou verzi, pak pokračuj krokem 6 podle původní volby (ship nebo jen commit).

**Zrušit:** konec.

### 7. Report

Po úspěšném shippu:

````
╭─ ✓ shipped ─────────────────────────────────╮
│  commit    <short-hash>                     │
│  zpráva    <subject>                        │
│  branch    <branch> → <remote/branch>       │
│  soubory   <N>                              │
╰─────────────────────────────────────────────╯
````

Pokud jen commit:

````
╭─ ✓ committed (nepushnuto) ──────────────────╮
│  commit    <short-hash>                     │
│  zpráva    <subject>                        │
│  ▸ push:   git push                         │
╰─────────────────────────────────────────────╯
````

## Pravidla

- **Nikdy Co-Authored-By, „Generated with Claude Code" ani jiné patičky.** Commit pod jménem uživatele.
- **Neamenduj** předchozí commit. Vždy nový.
- **Nepřeskakuj hooks** (`--no-verify`).
- **Force push** (`--force`, `-f`) — nikdy.
- **Push na main/master** — zeptej se extra, jestli si je user jistý (přidej varování v kroku 4 „push jde rovnou na `<branch>`").
- **Upstream bez remote tracking** → automaticky `-u origin <branch>` (jen pro push).
- Pokud `git push` selže (kvůli behind remote), **nedělej automaticky pull/rebase** — oznam uživateli:
  ```
  ⚠ Push odmítnut — remote je napřed. Udělej `git pull --rebase` a zkus znovu.
  ```
- Pokud pre-commit/pre-push hook failne, oznam výstup a skonči (bez retry).
- Česky.
