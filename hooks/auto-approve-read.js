#!/usr/bin/env node
// PreToolUse (Read/Glob/Grep): auto-approve, žádné permission prompty.

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => input += c);
process.stdin.on('end', () => {
  // Read-only operace — vždy povolit.
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Read-only operace, auto-approved'
    }
  }));
  process.exit(0);
});
