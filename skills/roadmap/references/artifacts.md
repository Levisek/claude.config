# `.roadmap/` artefakty — šablony

Všechny soubory se zakládají ve workdiru projektu. Při recovery (crash session, restart) čti `STATUS.md` jako první, pak navazuj.

## `SCOPE.md`

Detekovaný rozsah a proč. Zakládá se hned na začátku.

```markdown
# SCOPE

**Rozsah:** MEDIUM
**Datum:** 2026-04-18
**Zadání:** Přidat do existující todo appky kategorie pro úkoly.

## Proč MEDIUM

- Nová feature v existujícím projektu (ne nová appka).
- Odhad 4-6 souborů (model, UI list, UI detail, store).
- Stack (React + Zustand) je daný, nerozhoduje se o něm.
- Odhad 1-2 h práce.

## Heuristika

Viz `skills/roadmap/references/scope-detection.md`.

## Re-scope log

- *(prázdné dokud se nepřepne SMALL↔MEDIUM↔LARGE)*
```

## `BRAINSTORM.md`

Výstup z `superpowers:brainstorming`. Zakládá se na konci brainstorm fáze.

```markdown
# BRAINSTORM

**Datum:** 2026-04-18

## Problem statement

Uživatel chce třídit úkoly do kategorií (práce / osobní / nákupy).

## Otázky a odpovědi

1. **Claude:** Budou kategorie předdefinované nebo uživatelem vytvořené?
   **User:** Uživatelem vytvořené, max 10.

2. **Claude:** Má mít úkol právě jednu kategorii, nebo více?
   **User:** Právě jednu, zjednodušeně.

3. **Claude:** Chceš UI pro správu kategorií (edit / delete), nebo stačí create?
   **User:** Pro první verzi stačí create a použití. Edit/delete později.

## Constraints

- Žádná migrace existujících úkolů (mají mít nullable `categoryId`).
- Kategorie persist v localStorage jako todos.

## Acceptance criteria

- Given: appka s existujícími úkoly
  When: uživatel vytvoří kategorii „Práce" a přiřadí ji úkolu
  Then: úkol se zobrazí pod filtrem „Práce"
```

## `PLAN.md`

Výstup z `superpowers:writing-plans`. Atomické úkoly, 2-5 min každý.

```markdown
# PLAN

**Datum:** 2026-04-18
**Scope:** MEDIUM
**Odhad:** 8 úkolů, ~90 min

## Úkoly

### 1. Category model + store
- [ ] Přidat `Category` type do `src/types.ts`
- [ ] Rozšířit Zustand store o `categories: Category[]` + `addCategory(name)`
- [ ] Rozšířit `Todo` type o `categoryId: string | null`

### 2. Category UI — create
- [ ] Komponenta `CategoryForm` (input + submit)
- [ ] Napojení na store

### 3. Category UI — filter
- [ ] Dropdown filter v todo listu
- [ ] Filter logika v list selektoru

### 4. Napojení na todo
- [ ] V `TodoForm` dropdown pro výběr kategorie (volitelný)
- [ ] V `TodoItem` badge s názvem kategorie

### 5. Persistence
- [ ] Rozšířit persist middleware o `categories` klíč

## Gates

- [ ] **Gate 1:** User schvaluje plán → **ČEKÁ**
- [ ] **Gate 3:** Verification (pokud LARGE, u MEDIUM vynechat) — N/A
```

## `STATUS.md`

Tracking aktuální pozice. Aktualizuje se po každé fázi.

```markdown
# STATUS

**Naposled aktualizováno:** 2026-04-18 14:23

## Fáze

- [x] Scope detection → SCOPE.md *(14:05)*
- [x] Brainstorm → BRAINSTORM.md *(14:12)*
- [x] Writing plan → PLAN.md *(14:20)*
- [ ] **→ AKTUÁLNÍ: Gate 1 — čekám na schválení plánu**
- [ ] Execute → PLAN.md checklisty
- [ ] *(MEDIUM: verify/review fáze vynechány)*

## Další krok

User se musí podívat na `.roadmap/PLAN.md` a potvrdit „ok". Pak spouštím `superpowers:executing-plans`.

## Recovery info

Pokud session spadne:
1. Přečti tento soubor.
2. Pokračuj od „AKTUÁLNÍ" bodu.
3. Při pochybnostech se zeptej usera kde jsme skončili.
```

## `SKIPPED.md`

Log přeskočených gates. Zakládá se teprve když dojde k prvnímu skipu.

Formát viz `references/gates.md`.

## `.gitignore` pravidlo

Skill přidává `.roadmap/` do projektového `.gitignore` automaticky. Pokud user výslovně chce artefakty commitnout (např. pro sdílení s týmem), řekne to a skill `.gitignore` nepřidává.
