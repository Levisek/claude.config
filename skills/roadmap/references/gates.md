# Gates — tvrdé zastávky ve workflow

Gate = místo kde workflow čeká na explicitní schválení usera. Neproleze se kolem gate mlčky. Buď schválení dostaneš, nebo zapíšeš skip do `.roadmap/SKIPPED.md`.

## Seznam gates

### Gate 1: PLAN approval (MEDIUM i LARGE)

**Kdy:** Po `superpowers:writing-plans` vyprodukoval `.roadmap/PLAN.md`.

**Před:** `superpowers:executing-plans`.

**Akce:**
1. Ukaž usrovi cestu k `.roadmap/PLAN.md` + 3-5řádkový souhrn co plán obsahuje (počet úkolů, odhad času).
2. Zeptej se: „Plán schvaluješ? Můžu začít exekuci?"
3. Čekej. Nezačínej execute dokud neřekne „ok" / „jo" / „pusť" / „schvaluju".

**Když user chce změny:** Vrať se do writing-plans, iteruj na plánu.

**Když user chce skip gate** („jen to udělej, nech toho"): Viz sekce *SKIPPED.md* níže.

### Gate 2: TDD setup (jen LARGE)

**Kdy:** Po schválení plánu, před `superpowers:executing-plans`.

**Akce:**
1. Zavolej `superpowers:test-driven-development`.
2. Pro každý atomický úkol z plánu musí existovat buď test, nebo explicitní důvod v `PLAN.md` proč testy nedávají smysl (např. „čistě UI scaffold, test by byl screenshot").
3. Dokud to neplatí, nespouštěj execute.

### Gate 3: Verification před „hotovo" (jen LARGE)

**Kdy:** Po `superpowers:executing-plans`, před claimem že je hotovo.

**Akce:**
1. Zavolej `superpowers:verification-before-completion`.
2. Kontroluj: testy, `tsc-verification`, `visual-audit` pokud UI, `electron-security` pokud Electron.
3. Dokud výstupy neprojdou, neřekni usrovi že je hotovo.

### Gate 4: Code review (jen LARGE)

**Kdy:** Po verification, před merge / commit s claimem že je feature hotová.

**Akce:**
1. Zavolej `superpowers:requesting-code-review`.
2. Pokud review najde issues → vrať se k fázi execute, fixuj, pak znovu verify → review.

## SKIPPED.md — co zapsat když user přeskočí gate

User má právo gate přeskočit — je to jeho projekt. Ale zapiš to pro pozdější audit a sebedisciplínu.

**Formát `.roadmap/SKIPPED.md`:**

```markdown
# Přeskočené gates

## 2026-04-18 14:23 — Gate 3 (Verification)

**Uživatel:** „nepotřebuju verify, já to vidím že to funguje"

**Skill reakce:** Zaznamenáno. Pokračuji bez verification-before-completion.

**Dopad:** Pokud se objeví bug který by verification zachytila, odkazuju zpět na tento záznam.
```

**Kdy NEsmíš gate přeskočit ani s SKIPPED.md logem:**

- Gate 1 (PLAN approval) — bez odsouhlaseného plánu nespouštěj `executing-plans`. User **musí** aspoň minimálně potvrdit „ok jdi na to". Pokud odmítá i to, zeptej se „chceš raději SMALL režim bez plánu?" a downgradeuj.

## Red flags — signály že se chystáš gate obejít

| Myšlenka | Reality |
|----------|---------|
| „Plán je triviální, nemusím ho ukazovat" | Ukaž ho. Gate je gate. |
| „User řekl 'udělej to', to je implicit approval" | Není. Zeptej se explicitně. |
| „Verifikace by stejně prošla" | Tak ji spusť. 30 sekund vs. debugging později. |
| „TDD je overkill pro tuhle feature" | To rozhodne user, ne ty. Ukaž plán, zeptej se. |
| „Skip zapíšu později" | Teď. Ne později. Ihned. |

## Co dělat při violation

Pokud zjistíš že jsi proletěl gate bez schválení a bez zápisu:

1. **Stop.** Přestaň psát / editovat.
2. Upozorni usera: „Přeskočil jsem gate X bez tvého souhlasu. Vracím se."
3. Zapiš retroaktivně do `SKIPPED.md` s poznámkou „retroactive log".
4. Dožij gate (pokud to ještě jde) nebo ho přeskoč s explicitním souhlasem.
