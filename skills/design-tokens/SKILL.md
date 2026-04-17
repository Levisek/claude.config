---
name: design-tokens
description: Use when editing CSS, SCSS, styled-components, Tailwind configs, or any styling code in a project that already has a design-token system — CSS custom properties, Tailwind theme extension, or exported token object. Enforces "no hardcoded colors, font-sizes, border-radius, z-index, spacing" — values must come from tokens. Do NOT use for third-party libraries consumed as-is, for initial token-scheme design (when you're writing the tokens themselves), or for one-off throwaway prototypes.
allowed-tools: Read, Edit, Grep, Glob
---

# Design Tokens Discipline

## Pravidlo

Žádné magic numbers / magic colors v komponentových stylech. Všechno přes tokeny.

## Co je token a co ne

Token = pojmenovaná hodnota ve **sdíleném** zdroji (CSS variables v `:root`, Tailwind `theme.extend.*`, ts/js export). Token = jednotné místo změny.

Ne-token = literální hodnota přímo v komponentě.

## Zakázané hardcoded hodnoty

| Kategorie | Příklad zakázaného | Místo toho |
|-----------|---------------------|------------|
| **Barvy** | `color: #1a1a1a` | `color: var(--color-text-primary)` |
| **Font-size** | `font-size: 14px` | `font-size: var(--font-size-sm)` |
| **Border-radius** | `border-radius: 8px` | `border-radius: var(--radius-md)` |
| **z-index** | `z-index: 9999` | `z-index: var(--z-modal)` |
| **Spacing** | `padding: 16px` | `padding: var(--space-4)` |
| **Line-height** | `line-height: 1.5` | `line-height: var(--line-height-normal)` |
| **Shadow** | `box-shadow: 0 2px 4px rgba(0,0,0,.1)` | `box-shadow: var(--shadow-sm)` |

## Povolené literály

- `0`, `100%`, `auto`, `inherit`, `none`, `transparent`
- Zlomky v grid: `1fr`, `minmax(0, 1fr)`
- `currentColor`
- Aspect ratios: `aspect-ratio: 16 / 9`
- Numerical `line-height` bez jednotky **pouze** pokud odráží intentional typografický rytmus + je doložené v komentáři

## Když token chybí

Neshazuj na hardcoded. Postup:
1. Zjisti, jestli je podobný token v catalogu (`references/token-catalog.md`).
2. Pokud není: doplň token do zdroje (`tokens.css`, `theme.ts`, whatever).
3. Teprve pak použij v komponentě.
4. Nahlas uživateli co jsi přidal + proč (ať to může schválit v review).

## Když nejde zjistit, kde jsou tokeny

Grep nalezne obvykle: `:root {`, `--color-`, `theme.extend`, `tokens/`, `design-tokens/`.

Pokud **opravdu** neexistuje žádný token system → **skill se nepoužije**. Projekt ho nemá, není tvoje práce ho založit bez žádosti.

## Při review

Hardcoded hodnoty v komponentách hlaš `file:line` + konkrétní navržený token. Nefixuj mlčky.
