---
description: Bezpečnostní audit projektu (Electron/TS, vanilla HTML, GRAL) s využitím Trail of Bits skills
---

Spusť komplexní bezpečnostní audit aktuálního projektu. Detekuj typ projektu a vyber správnou sadu kontrol.

## Postup

### 1. Detekce typu projektu (přečti soubory v cwd)

- **Electron/TypeScript app** → existuje `package.json` s `electron` v deps a `tsconfig.json`
- **Node/TypeScript backend** → `package.json` s TS, bez electron
- **Vanilla HTML/CSS/JS** → existuje `index.html` bez `package.json` **nebo** v CLAUDE.md je „GRÁL" / „vanilla"
- **Python** → `pyproject.toml`, `requirements.txt`, `setup.py`
- **Neznámý** → zeptej se uživatele přes `AskUserQuestion`

### 2. Nabídni scope

Přes `AskUserQuestion`:
- **Plný audit** (všechny checky, trvá déle)
- **Jen secrets + insecure defaults** (rychlý triage)
- **Jen supply chain** (jen deps)
- **Custom** (uživatel řekne co)

### 3. Načti relevantní SKILL.md a postupuj dle nich

Podle typu projektu načti (Read) a následuj pokyny z těchto skill souborů:

#### Electron/TypeScript/Node
1. `C:\Users\admin\.claude\skills\trailofbits\plugins\insecure-defaults\skills\insecure-defaults\SKILL.md`
   - Hledej: hardcoded secrets, fail-open defaults (`env.KEY || 'default'`), weak auth, permissive CORS, disabled security
   - Rozliš fail-open (kritické) vs fail-secure (bezpečné)
   - Ignoruj test/spec/example soubory

2. `C:\Users\admin\.claude\skills\trailofbits\plugins\supply-chain-risk-auditor\skills\supply-chain-risk-auditor\SKILL.md`
   - Audit `package.json` závislostí
   - Červené vlajky: unmaintained (>2 roky bez updatu), nízký download count, typosquatting, single-maintainer bez firmy

3. Pokud je nainstalován `semgrep` (ověř `semgrep --version`):
   - `C:\Users\admin\.claude\skills\trailofbits\plugins\static-analysis\skills\semgrep\SKILL.md`
   - Spusť Semgrep s `--metrics=off` a relevantními rulesety (p/typescript, p/javascript, p/nodejs-scan)
   - **DŮLEŽITÉ:** před spuštěním získej od uživatele explicit approval scan planu

#### Vanilla HTML/GRAL
1. `insecure-defaults` — hledej `innerHTML = userInput`, `eval()`, `document.write(user)`, inline event handlers na user content
2. Pokud existuje projektový GRAL audit (`./.claude/commands/audit.md` v projektu) — nabídni uživateli zkombinovat s ním
3. Semgrep pro HTML/JS pokud je dostupný

#### Všechny projekty (univerzální checky)
- **Hardcoded API klíče / tokeny** — Grep patterny: `sk-[a-zA-Z0-9]{40,}`, `ghp_[a-zA-Z0-9]{36}`, `xoxb-[0-9]+`, `AKIA[0-9A-Z]{16}`, `eyJhbGci[a-zA-Z0-9._-]{30,}` (JWT)
- **`.env` commited do gitu** — `git ls-files | grep -E '^\.env($|\.)'`
- **`node_modules/` v gitu** — `git ls-files node_modules/ | head`
- **`.git-ignored` secrets** — zkontroluj že `.env`, `credentials*`, `*.pem`, `*.key` jsou v `.gitignore`

### 4. Struktura reportu

Vypiš výsledky takto:
```
🔍 Audit projektu <cwd>

[CRITICAL] N nálezů
  - <path>:<line> — popis
  - ...

[HIGH] N nálezů
  - ...

[MEDIUM] N nálezů
  - ...

[INFO] N poznámek
  - ...

✅ Co je OK:
  - <co projekt dělá dobře>
```

Kategorizace:
- **CRITICAL** — aktivně exploitable (hardcoded secrets v HEAD, SQL injection, RCE vector)
- **HIGH** — security-relevant problém (XSS možnost, fail-open defaults v produkci)
- **MEDIUM** — best-practice porušení (missing CSP, weak defaults)
- **INFO** — observabilita, dokumentace

### 5. Navrhni další kroky

Pokud jsou nálezy, zeptej se přes `AskUserQuestion`:
- **Opravit top CRITICAL** — Claude udělá opravy
- **Uložit report do AUDIT.md** — pro pozdější řešení
- **Jen zobrazit, neřešit** — skonči

## Pravidla

- **Neskenuj `node_modules/`, `dist/`, `build/`, `.git/`, `.next/`, `.vite/`** — to jsou build artifacts
- **Nehádej** co je zranitelné — každý nález potvrď konkrétním kódem (file:line + snippet)
- **False positive check** — pokud si nejsi jistý, označ jako `[NEEDS REVIEW]` místo `[CRITICAL]`
- **Nefixuj automaticky** — uživatel rozhodne, co opravit
- Pro Semgrep: vždy `--metrics=off` (TOB doporučení)

## Dostupné externí nástroje

- **Semgrep** — `semgrep --version`. Pokud chybí: `pip install semgrep` nebo `pipx install semgrep`
- **npm audit** — pro Node projekty: `npm audit --json`
- **git-secrets** — pro commit history: volitelné

Pokud nástroj chybí a user ho chce, ukaž install command a skonči — neinstaluj sám.

## Příklad použití

```
/audit
→ Detekuju Electron/TS projekt (LevisIDE)
→ AskUserQuestion: Scope? [Plný / Rychlý / Supply chain / Custom]
→ User vybere "Plný"
→ Provádím: insecure-defaults, supply-chain, secrets scan
→ Report: 2 HIGH, 5 MEDIUM, 1 INFO
→ AskUserQuestion: Co dál? [Opravit / Save to AUDIT.md / Jen zobrazit]
```
