# CSP patterny pro Electron

## Minimální produkční CSP

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

**Pozn.** `style-src 'unsafe-inline'` je kompromis — mnoho komponentních knihoven (Radix, Tailwind JIT) injektuje inline styly. Pokud je chceš zakázat, musíš nastavit nonce (netriviální v Electronu).

## Dev CSP (HMR povolený)

```
default-src 'self';
script-src 'self' 'unsafe-eval';
style-src 'self' 'unsafe-inline';
connect-src 'self' ws://localhost:* http://localhost:*;
img-src 'self' data:;
```

`unsafe-eval` je nutný pro Vite/webpack HMR v dev. **Nikdy** v produkci.

## Jak rozlišit dev vs prod CSP

```ts
const CSP_PROD = "default-src 'self'; script-src 'self'; ...";
const CSP_DEV  = "default-src 'self'; script-src 'self' 'unsafe-eval'; connect-src 'self' ws://localhost:* http://localhost:*; ...";

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': [app.isPackaged ? CSP_PROD : CSP_DEV],
    },
  });
});
```

## Časté mistakes

- **Chybějící CSP** — Electron bez CSP je otevřená XSS. `webSecurity: true` sama nestačí.
- **`script-src *`** nebo `'unsafe-inline'` v script-src — to defaults k tomu, že XSS spustí cokoli.
- **`connect-src *`** — umožní data exfiltration do libovolné domény.
- **Nenastavený `frame-ancestors 'none'`** — clickjacking přes `<iframe>`.

## Testování CSP

- Spusť aplikaci s otevřenými DevTools → Console.
- Pokud CSP blokuje legit resource, Chromium tam vypíše `Refused to load the … because it violates the following Content Security Policy directive: …`.
- Pro audit použij `skills/visual-audit` — kontroluje CSP violations z console automaticky.
