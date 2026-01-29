# Task Management (Dooist)

You have access to Dooist, an MCP task manager. Use it to maintain context across sessions.

## When to Check Tasks
- When the conversation involves project work, planning, or "what should I work on"
- Run `today` to see due and overdue tasks
- Don't check on trivial or one-off questions

## When to Suggest Creating Tasks
When the user mentions future work, deferred items, or multi-step plans that won't finish this session, ask: "Want me to track that in Dooist?"

Create tasks for:
- Work that won't happen this session
- Bugs or issues discovered while working
- Follow-ups from completed work
- Anything the user says to remind them about

## How to Create Good Tasks
Context is tokens. Use the minimum needed for a cold agent to pick up the task and execute without asking questions. No prose, no filler — just the facts it needs.

Include in `context`:
- Repo/project
- Intent (one line — why this matters)
- Done state (how to verify it's finished)
- Key file paths or decisions

Example:
```
create_task "Fix auth redirect bug" with context:
  Repo: paperMoose/dooist
  Intent: Unauthenticated /today shows blank page instead of redirect
  Done: /today without auth → 302 to /login
  Files: web/src/middleware.ts, web/src/lib/supabase/middleware.ts
```

## When Working on a Task
- Update task context with progress and decisions as you go
- If the session ends before completion, update context with current state so the next session can pick up seamlessly

## When to Complete Tasks
- Only after the work is verified done
- Ask the user before marking complete if there's any ambiguity

## Scanning TODOs
- When starting on a new/unfamiliar codebase, suggest: "Want me to scan for TODOs?"
- When the user asks what needs work in a repo
