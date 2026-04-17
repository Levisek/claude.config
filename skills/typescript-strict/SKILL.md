---
name: typescript-strict
description: Use when editing `.ts` or `.tsx` files in a project with tsconfig.json. Enforces "`any` only with explanatory comment explaining why a more precise type cannot be used" and preference for `unknown` over `any`. Do NOT use for plain `.js` files, `.d.ts` declaration-only files, or projects without tsconfig.json.
allowed-tools: Read, Edit, Grep
---

# TypeScript Strict Discipline

Pravidla, která platí vždy při editaci TS kódu. Nejsou o stylu — jsou o safety.

## `any` jen s odůvodněním

- Každý výskyt `any` (včetně implicitního) vyžaduje komentář `// any: <důvod>` nad/u deklarace.
- Bez komentáře = bug.

Příklady přijatelných důvodů:
- `// any: externí lib má broken types (@types/foo@1.2.3), upstream issue #…`
- `// any: recursive JSON parser, přesný typ by byl rekurzivní union`

Rozhodovací strom `any` vs `unknown` vs type guard: `references/any-decision-tree.md`.

## Preferuj `unknown` před `any`

`unknown` je safe default pro „neznámý typ". Compiler tě donutí narrow-nout před použitím.

```ts
// ŠPATNĚ
function parse(s: string): any { return JSON.parse(s); }

// LEPŠÍ
function parse(s: string): unknown { return JSON.parse(s); }
```

## Type assertions (`as Foo`)

- `as Foo` bez runtime check je stejné riziko jako `any`. Preferuj type guard nebo Zod/Valibot parse.
- Výjimka: `as const`, `as Foo satisfies Bar` patterny — ty jsou bezpečné.

## Readonly

- `readonly` u polí a arrays tam, kde není mutace zamýšlená.
- `as const` pro literal tuples.

## Non-null assertion (`!`)

- `foo!` je stejné riziko jako `any` — compiler ti věří, že to není null, runtime se to může vysypat.
- Preferuj explicit narrow (`if (!foo) throw`) nebo optional chaining + fallback.

## Při review cizího kódu

Pokud narazíš na `any` bez komentáře, `as Foo` bez guardu, nebo `!` v rizikovém místě — **nefixuj mlčky**. Nahlas uživateli `file:line` a navrhni konkrétní fix.
