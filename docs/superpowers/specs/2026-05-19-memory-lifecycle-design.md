# Memory Lifecycle — Design Spec

**Date:** 2026-05-19
**Status:** Draft → user review pending
**Sub-projekt:** C z trojice {A: Subagent fleet ✅, B: Activation & dietetics ✅, C: Memory lifecycle}
**Cíl:** Automatizovat per-session memory lifecycle (SessionEnd log writer + PreCompact state snapshot + SessionStart pull) a přidat test-gate quality safety net na `git push`.

---

## 1. Motivace a analýza

PDF *Claude Code Native Orchestration & Automation* (Pattern C, Pattern F) popisuje memory lifecycle přes lifecycle hooks. Aktuální stav projektu (verified):

**Co už máš:**
- Anthropic auto-memory běží (default `CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`)
- Per-repo memory infra: `~/.claude/projects/<repo>/memory/{MEMORY.md, project_*.md, ...}`
- 35+ topic memory files napříč repos (ručně udržované přes `/postmortem`)
- Session-context.js (po Sub-projektu B) injektuje banner/git/sparkline source-aware
- `auto-tsc.js` PostToolUse hook po každém Write/Edit zapisuje tsc status do `~/.claude/session-env/<sessionId>/tsc-status` cache

**Co chybí:**
- SessionEnd hook neexistuje → ruční práce při psaní session summary
- PreCompact hook neexistuje → compaction discards working memory bez insurance
- SessionStart pull z minulé session log neexistuje → po `resume`/`clear` chybí context
- Žádná quality gate pro `git push` → riziko pushnout tsc-broken kód

## 2. Scope (in / out)

**In scope (C-full per user volba):**

- Win 1: SessionEnd hook → session log writer (mechanický, no LLM)
- Win 2: PreCompact hook → state snapshot do cache
- Win 3: SessionStart pull → extension session-context.js pro memory inject + compact replay
- Win 4: test-gate hook → blokuje `git push` při čerstvých tsc chybách

**Out of scope:**

- Full LLM session summary (drahé per session)
- Test-gate na `git commit` (frequent, disruptive)
- Test-gate na `npm test` nebo jiné slow test commands (auto-tsc cache je rychlejší + dostatečně silný signál)
- Transcript backup (hook nemá garantovaný přístup k raw transcriptu — backup state je praktičtější)
- Session-log archivace / vyhledávání (zatím jen append-only file)

## 3. Architektura

```
~/.claude/hooks/session-end.js          ← NEW (Win 1, hook handler)
~/.claude/hooks/pre-compact.js          ← NEW (Win 2)
~/.claude/hooks/test-gate.js            ← NEW (Win 4)
~/.claude/hooks/session-context.js      ← UPDATE (Win 1+3: write start marker, pull memory)

~/.claude/hooks/session-end.test.js     ← NEW
~/.claude/hooks/pre-compact.test.js     ← NEW
~/.claude/hooks/test-gate.test.js       ← NEW
~/.claude/hooks/session-context.test.js ← UPDATE (přidat 2 nové asserts pro pull)

~/.claude/settings.json                 ← UPDATE (přidat SessionEnd + PreCompact events;
                                                   přidat test-gate.js do existujícího Bash matcher)

Cache + memory:
~/.claude/cache/session-start-<sessionId>.json   ← Win 1 marker, write by session-context, read by session-end
~/.claude/cache/pre-compact-<sessionId>.json     ← Win 2 state snapshot
~/.claude/projects/<repo>/memory/session-log.md  ← Win 1 output (append-only per repo)
```

**Data flow:**

1. SessionStart (`startup`): session-context.js zapíše start marker (timestamp, head SHA, branch). Memory pull čte nejnovější entry z `session-log.md` a injektuje.
2. Během session: auto-tsc.js (existing) píše tsc-status. Agent dispatches loguje track-agents.js → `logs/agent-durations.jsonl`.
3. PreCompact: pre-compact.js sebere git status + posledních 5 commits + posledních 5 agent dispatches, uloží snapshot.
4. SessionStart (`compact`): session-context.js čte snapshot, replay do additionalContext.
5. PreToolUse Bash (`git push ...`): test-gate.js čte tsc-status cache, exit 2 pokud `ok: false` (a není SKIP_TEST_GATE=1).
6. SessionEnd: session-end.js čte start marker, dopočítá deltu (commits od start SHA, duration), appendne entry do session-log.md.

## 4. Win 1 — SessionEnd session log writer

### 4.1 Komponenty

**4.1.1 SessionStart marker write (v session-context.js)**

V existujícím `session-context.js`, na začátku `process.stdin.on('end', ...)`, přidat zápis start markeru:

```javascript
// Write SessionStart marker pro pozdější SessionEnd hook
const sessionId = data?.session_id || '';
if (sessionId && source === 'startup') {
  const marker = {
    ts: Date.now(),
    branch: git.branch || null,
    headSha: git.recentCommits?.[0]?.hash || null,
    cwd: cwd,
  };
  const markerPath = path.join(os.homedir(), '.claude', 'cache', `session-start-${sessionId}.json`);
  try { fs.writeFileSync(markerPath, JSON.stringify(marker)); } catch {}
}
```

Marker se píše JEN na `source === 'startup'` (ne na resume/clear/compact — ty pokračují v existující session).

**4.1.2 SessionEnd hook (nový soubor)**

`~/.claude/hooks/session-end.js`:
- Čte JSON ze stdin (obsahuje `session_id`, `cwd`, `reason` apod.)
- Načte start marker z cache. Pokud chybí, použije nejnovější agent-durations entry jako fallback start time.
- Dopočítá:
  - `duration_min` = (now - start_ts) / 60000
  - `commits` = git log start_sha..HEAD --oneline (count + first..last range)
  - `branch` = current branch
  - `agents` = count agent-durations entries v window [start_ts, now], group by model
  - `dirty_count` = git status --short | wc -l
- Resolve repo name přes `lib/repo-name.js`
- Append do `~/.claude/projects/<repo>/memory/session-log.md`

**4.1.3 Output formát**

```markdown
## 2026-05-19 14:23–14:51 (28 min)
- branch: master
- commits: 7 (0146ccd..fcf9606)
- agents: 18 dispatches (12 haiku, 4 sonnet, 2 opus)
- exit: clean (0 uncommitted)
```

Pokud žádné commits ani agents → minimal entry (jen branch + exit state).

### 4.2 Edge cases

| Case | Behavior |
|---|---|
| Start marker chybí | Use earliest agent-durations entry time as fallback. Pokud žádné, skip entry. |
| Repo není git | Skip session-log write (žádný repo memory dir). |
| session-log.md neexistuje | Vytvoř s header `# Session log\n\n`. |
| Concurrent SessionEnd (multiple sessions) | Hook je idempotent — duplikát timestamp = jiná session, appendne se zvlášť. |
| Cache adresář neexistuje | mkdir -p při zápisu start markeru. |

## 5. Win 2 — PreCompact state snapshot

### 5.1 Hook design

`~/.claude/hooks/pre-compact.js`:
- Čte JSON ze stdin (obsahuje `session_id`, případně transcript metadata)
- Zachytí:
  - Current git status `--short` (max 20 lines)
  - Posledních 5 commits (hash + subject)
  - Posledních 5 agent dispatches z `agent-durations.jsonl` (model + role + start time)
- Zapíše do `~/.claude/cache/pre-compact-<sessionId>.json` jako:
  ```json
  {
    "ts": 1715683200000,
    "git_status": [{"status": "M", "path": "..."}],
    "recent_commits": [{"hash": "...", "subject": "..."}],
    "recent_agents": [{"model": "...", "role": "...", "ts_start": ...}]
  }
  ```

**Není to transcript backup** — captures only data co survive compactu a má hodnotu pro replay.

### 5.2 Cleanup

Při zápisu pre-compact souboru, mazat všechny `pre-compact-*.json` starší než 7 dní (mtime check). Drží cache slim.

## 6. Win 3 — SessionStart memory pull + compact replay

### 6.1 Extension session-context.js

Po existujícím banner+git+sparkline rendering, přidat conditional inject:

**A. Memory pull (pro startup a compact):**

```javascript
const shouldPullMemory = source === 'startup' || source === 'compact';
if (shouldPullMemory && git.inRepo) {
  const memoryPath = path.join(os.homedir(), '.claude', 'projects', encodeRepoPath(cwd), 'memory', 'session-log.md');
  try {
    const log = fs.readFileSync(memoryPath, 'utf8');
    const lastEntry = extractLastEntry(log); // function returns last `## ...` block
    if (lastEntry) {
      parts.push('\n**Previous session:**\n' + lastEntry.slice(0, 500)); // hard cap 500 chars
    }
  } catch {}
}
```

`encodeRepoPath(cwd)` = nahradí `/`, `:`, `\` za `-` (matches Anthropic's directory naming convention pro `projects/`).

**B. Compact replay (jen pro compact):**

```javascript
if (source === 'compact' && sessionId) {
  const snapshotPath = path.join(os.homedir(), '.claude', 'cache', `pre-compact-${sessionId}.json`);
  try {
    const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    const lines = [
      `**Pre-compact state** (compacted at ${new Date(snap.ts).toISOString()}):`,
      ...snap.recent_commits.slice(0, 3).map(c => `- ${c.hash} ${c.subject}`),
      `- ${snap.git_status.length} dirty files, ${snap.recent_agents.length} recent agents`,
    ];
    parts.push('\n' + lines.join('\n'));
  } catch {}
}
```

### 6.2 Updated source matrix

| source | banner | sparkline | tip | memory pull | compact replay |
|---|---|---|---|---|---|
| startup | ✅ | ✅ | ✅ | ✅ last 1 entry | ❌ |
| resume | ❌ | ❌ | ❌ | ❌ | ❌ |
| clear | ❌ | ❌ | ❌ | ❌ | ❌ |
| compact | ❌ | ✅ | ❌ | ✅ last 1 entry | ✅ |

## 7. Win 4 — Test-gate na git push

### 7.1 Hook design

`~/.claude/hooks/test-gate.js`:
- Čte JSON ze stdin (obsahuje `tool_input.command`, `session_id`)
- Pokud command nezačíná `git push`, exit 0 (no-op)
- Pokud `SKIP_TEST_GATE=1` v env, exit 0 + audit log to `logs/test-gate-bypass.jsonl`
- Read `~/.claude/session-env/<sessionId>/tsc-status` cache
- Pokud soubor neexistuje (non-TS projekt) → exit 0
- Pokud `status.ok === false`:
  - Check TTL: pokud `status.timestamp` starší než 10 min (cache stale), exit 0 (don't false-block on outdated info)
  - Else: write `BLOCKED: tsc errors from last edit (...) — run /tsc to inspect, or set SKIP_TEST_GATE=1 to bypass.` to stderr, exit 2

### 7.2 Settings.json integration

Existující Bash matcher má jen `block-destructive.js`. Přidat druhý hook entry:

```json
{
  "matcher": "Bash",
  "hooks": [
    { "type": "command", "command": "node C:/Users/admin/.claude/hooks/block-destructive.js" },
    { "type": "command", "command": "node C:/Users/admin/.claude/hooks/test-gate.js" }
  ]
}
```

Hooks se spouštějí v pořadí. block-destructive vyloučí dangerous commands FIRST, pak test-gate vyhodnotí git push.

### 7.3 Audit log

Bypass přes `SKIP_TEST_GATE=1` log:

```jsonl
{"ts":"2026-05-19T14:00:00Z","sessionId":"abc","cwd":"...","command":"git push origin master","reason":"SKIP_TEST_GATE=1"}
```

User může pravidelně checknout audit log a verify že bypass nepoužívá příliš často (signál že test-gate je flaky).

## 8. Verifikace

### 8.1 Per-hook unit tests

- `session-end.test.js` — spustí session-end.js se fake JSON inputem (sessionId, cwd), ověří že:
  - Marker scenario: existující start marker → entry s commits+duration
  - Missing marker: fallback na earliest agent-durations entry
  - Non-git repo: skip log write
- `pre-compact.test.js` — spustí pre-compact.js, ověří snapshot JSON struktura
- `test-gate.test.js` — 4 cases: tsc clean → allow; tsc errors recent → block; tsc errors stale → allow; SKIP env → allow
- `session-context.test.js` — rozšířit o:
  - source=startup: memory pull se objeví v output (pokud session-log existuje)
  - source=compact: compact replay se objeví (pokud cache snapshot existuje)

### 8.2 Integration test

Manuální flow:
1. Spustit fresh session ve `~/.claude` → start marker se píše
2. Udělat 1 commit + 1 agent dispatch → cache zaznamenává
3. Killnout session (Ctrl-D / window close) → SessionEnd fires → session-log entry vznikne
4. Otevřít novou session → memory pull entry by se měl objevit v additionalContext

### 8.3 Negative test

- Pokusit se `git push` po Edit který způsobil tsc error → test-gate musí blokovat
- Po opravě Edit → push prochází

## 9. Rollback

Plně additive (4 nové hooks + 1 settings.json update + 1 session-context.js update):

- `rm ~/.claude/hooks/session-end.js ~/.claude/hooks/pre-compact.js ~/.claude/hooks/test-gate.js`
- `git revert` na session-context.js update + settings.json update
- Volitelně `rm -rf ~/.claude/cache/{session-start,pre-compact}-*.json` (state cleanup)

Existující memory soubory (`projects/*/memory/session-log.md`) zůstanou — nevadí, jen append-only logy.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| SessionEnd hook nedostane data o session (sessionId chybí) | session-end.js exitne 0 ticho — žádný log entry. Existující memory files netknuté. |
| Test-gate false-block (auto-tsc cache stale po dlouhé pauze) | TTL check 10 min na `status.timestamp`. Stale → allow. |
| Pre-compact-replay přeplní context | Cap 500 chars na entry + 3 bullet limit na recent_commits. |
| Memory log se rozrůstá > 100 KB | Future work: rotate při > 100 KB (mimo C scope). Aktuálně Append-only. |
| Concurrent sessions zapisují stejný session-log.md souběžně | Append je atomic na úrovni OS (append-only flag). Žádné lock potřeba pro line-based formát. |
| `SKIP_TEST_GATE=1` nikdo nezruší → tichá test-gate disabled | Bypass logging do `test-gate-bypass.jsonl`. User si jednou za týden checkne. |
| PreCompact event nemusí být v aktuální Claude Code verzi documented | Pokud event nefiruje, hook nikdy nezavolá — žádná škoda. Verify v `code.claude.com/docs/en/whats-new` před commit. |

## 11. Success kritéria

- ✅ 4 hooks shipnuté (session-end, pre-compact, test-gate, session-context update)
- ✅ All tests zelené (4 nové + 1 rozšířený)
- ✅ Žádná regrese v existujících testech (agent-stats, validate-agents, detect-triggers, current session-context)
- ✅ Mid-conversation smoke: po SessionEnd existuje nová entry v `projects/<repo>/memory/session-log.md`
- ✅ Test-gate negative test: `git push` blokuje při čerstvých tsc chybách
- Měření delayed (2 týdny): session-log entry count ≈ session count; test-gate bypass count < 5% pushes

---

## Implementation plan

Bude vytvořen samostatně skillem `writing-plans` po schválení tohoto specu.
