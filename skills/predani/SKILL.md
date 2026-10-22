---
name: predani
description: Shrne rozdělanou práci do předávacího dokumentu pro další session (jiný stroj, jiný účet, čistý kontext). Spouští se ručně přes /predani, volitelně s tím, na co bude další session.
disable-model-invocation: true
argument-hint: "Na co bude další session"
---

# Předání

Převzato z `mattpocock/skills` (`handoff`, MIT), upraveno.

Napiš předávací dokument, ze kterého čistá session naváže bez této
konverzace. Ulož ho do `/tmp/claude-1000/predani-<YYYY-MM-DD-HHMM>.md`
(na stanici do `%TEMP%`), ne do pracovního stromu, a cestu vypiš.

Když má práce pokračovat **na jiném stroji**, `/tmp` nestačí: dokument patří
do repa jako `.claude/doc-pending.md`-styl souboru nebo do trezoru — zeptej
se jednou větou, kam.

## Obsah

1. **Cíl** — co se má dosáhnout, jednou dvěma větami, slovy uživatele.
2. **Stav** — co je hotové a **ověřené** (čím), co je hotové a neověřené,
   co rozdělané. Negativní výsledky zapiš jako negativní.
3. **Kde to leží** — repa, větve, poslední commity (hash), nenasazené změny
   (`/opt/stacks` není git — řekni, co se nasadilo a co ne).
4. **Další krok** — konkrétní první akce, ne seznam možností.
5. **Rozhodnutí čekající na uživatele** a root příkazy, které ještě neběžely.
6. **Doporučené skilly** — které má další session načíst přes Skill.

## Pravidla

- **Neduplikuj, odkazuj.** Co už je ve specu, plánu, ADR, issue, commitu,
  TODO nebo trezoru, uveď cestou nebo hashem.
- **Bez tajemství.** Žádné klíče, hesla, tokeny, adresy domu ani osobní
  údaje — `<REDACTED>` nebo odkaz na soubor, odkud se čte.
- Když uživatel předal argument, přizpůsob dokument tomu, na co další
  session bude.
