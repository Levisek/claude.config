---
description: Navrhne český commit message z aktuálních změn a po potvrzení commitne
---

Vytvoř git commit s českou zprávou v duchu zvyklostí daného repozitáře.

## Postup

### 1. Shromáždi kontext (paralelně přes Bash)
- `git status` — co je staged/unstaged/untracked
- `git diff --staged` — detail staged změn
- `git diff` — detail unstaged změn
- `git log --oneline -10` — styl posledních commit messages

### 2. Analyzuj a navrhni message
- Zjisti charakter změn: `přidává X`, `opravuje Y`, `refaktoruje Z`, `mění A`, atd.
- Použij **stejný styl** jako předchozí commity v `git log` (prefix verze? emoji? plain text? jazyk?)
- Default: krátký CZ subject do ~60 znaků, případně druhý řádek s kontextem
- Pokud je repo v EN (log v angličtině) → message v EN

### 3. Zobraz návrh
Vypiš:
```
Navrhovaná zpráva:
<subject>

<body (pokud je>)

Bude commitnuto:
- soubor1 (modified)
- soubor2 (new)
- ...
```

### 4. Zeptej se přes AskUserQuestion
Otázka: "Commitnout s touto zprávou?"
Možnosti:
- **Commit** — stage vše a commitni
- **Upravit zprávu** — uživatel napíše vlastní verzi
- **Zrušit** — neprováděj nic

### 5. Provedení
- Pokud "Commit": `git add -A` na změněné tracked soubory a NEW soubory, které dávají smysl (nepřidávej `.env`, `node_modules`, `dist/` — respektuj `.gitignore`, ale buď opatrný i u věcí mimo něj). Pak `git commit -m "<message>"` přes HEREDOC pro správné formátování víceřádkových zpráv.
- Pokud "Upravit zprávu": zeptej se textově na novou verzi, pak commit.
- Pokud "Zrušit": skonči.

### 6. Report
Po úspěšném commitu vypiš: `✓ Commit <short-hash>: <subject>`. **Nepushuj** — to dělá `/push`.

## Pravidla

- **Nikdy nepřidávej Co-Authored-By, "Generated with Claude Code" ani jiné patičky.** Uživatel commituje pod svým jménem.
- **Neamenduj** předchozí commit (`--amend`). Vždy vytvoř nový commit.
- **Nepřeskakuj hooks** (`--no-verify`). Pokud hook failne, oznam a zeptej se co dál.
- Pokud není co commitnout (clean tree), řekni to a skonči bez otázek.
- Pokud jsou soubory podezřelé z obsahu secretů (`.env`, `credentials.json`, `*.key`, `*.pem`), **upozorni uživatele** a nech ho potvrdit.
