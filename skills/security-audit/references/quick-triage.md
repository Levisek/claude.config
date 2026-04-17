# Quick security triage — inline checklist

Když user ukáže kus kódu nebo se ptá „je to bezpečné?", projeď tyhle body. Nálezy hlas `file:line` + severity.

## Hardcoded secrets (CRITICAL)

Viz `secret-patterns.md` pro regex patterny. Nejběžnější:
- API klíče (OpenAI `sk-…`, GitHub `ghp_…`, Slack `xoxb-…`, AWS `AKIA…`)
- JWT tokeny (`eyJhbGci…`)
- Connection stringy s heslem (`postgres://user:pass@host`)
- Private keys (`-----BEGIN … PRIVATE KEY-----`)

## Injection vectors (CRITICAL / HIGH)

| Pattern | Riziko | Fix |
|---------|--------|-----|
| `innerHTML = userInput` | XSS | `textContent` nebo sanitizer (DOMPurify) |
| `eval(userInput)` | RCE | nikdy neuživatelský input → eval |
| `new Function(userInput)` | RCE | stejně jako eval |
| `document.write(userInput)` | XSS | použij DOM API |
| SQL `query(\`SELECT * FROM t WHERE id=${id}\`)` | SQLi | parametrizované query |
| `exec(userInput)` / `spawn(shell=true, userInput)` | Command injection | `spawn` s args array, ne shell |
| `fs.readFile(userInput)` | Path traversal | `path.resolve` + whitelisting |

## Fail-open defaults (HIGH)

Zrádné: fallback na permissive hodnotu při chybějící konfiguraci.

```js
// ŠPATNĚ — když ADMIN_TOKEN chybí, každý je admin
if (token === process.env.ADMIN_TOKEN) grantAdmin();

// LEPŠÍ
if (!process.env.ADMIN_TOKEN) throw new Error('ADMIN_TOKEN required');
if (token === process.env.ADMIN_TOKEN) grantAdmin();
```

Rozlišuj:
- **fail-open** pro auth/authz/crypto = vždy CRITICAL
- **fail-open** pro logger prefix / feature flag default = OK

## CORS / CSP (MEDIUM / HIGH)

- `Access-Control-Allow-Origin: *` na authenticated endpoint = HIGH
- `Content-Security-Policy: unsafe-inline unsafe-eval *` = HIGH
- Chybějící CSP v Electron app = HIGH (viz `skills/electron-security`)

## Auth patterns (HIGH)

- Password v plain textu v DB = CRITICAL
- MD5 / SHA1 na passwordy = CRITICAL (použij bcrypt/argon2)
- JWT bez podpisu verifikace (`jwt.decode` místo `jwt.verify`) = CRITICAL
- Session cookies bez `HttpOnly`, `Secure`, `SameSite` = HIGH

## Git / dependency hygiene (HIGH / MEDIUM)

- `.env` v git historii = CRITICAL (nejen `git ls-files`, ale i `git log --all -- .env`)
- `node_modules/` v commitu = MEDIUM (výkon, ne security, ale naznačuje sloppy ops)
- `package-lock.json` chybí u veřejných závislostí = MEDIUM (reproducibility)
- Dependency s >2 roky bez updatu + 1 maintainer = MEDIUM (supply chain)

## Electron-specific

Delegovat na `skills/electron-security` pokud jde o Electron projekt. Klíčové:
- `contextIsolation: false` nebo `nodeIntegration: true` = CRITICAL
- CSP v mainWindow chybí = HIGH
- Free-form IPC `ipcRenderer.invoke(channel, ...)` bez whitelistu = HIGH

## File upload / download

- Accept bez whitelist (`<input type="file">` bez `accept`) + server-side trust = HIGH
- Content-Disposition `inline` pro user-upload = HIGH (XSS via HTML upload)
- Path traversal při ukládání (`${uploadDir}/${req.body.filename}`) = CRITICAL

## Když chceš hloubkový scan

Nedělej full audit inline — navrhni user spuštění `/audit` (projde Trail of Bits plugins, Semgrep, deps audit).
