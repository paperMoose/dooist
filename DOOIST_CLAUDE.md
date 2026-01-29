# Task Management (Dooist)

You have access to Dooist, an MCP task manager. Use it to maintain context across sessions.

## When to Check Tasks
- At the start of any work session involving a project
- When the conversation involves project work, planning, or "what should I work on"
- Run `today` to see due and overdue tasks
- Don't check on trivial or one-off questions

## When to Create Tasks (Be Proactive)
**Create tasks automatically** — don't ask for permission when:
- The user mentions future work or deferred items
- You discover bugs or issues while working on something else
- A task naturally splits into multiple steps that won't all finish this session
- Work is completed that should be documented for context

**Do ask first** when:
- It's unclear whether the user wants the item tracked
- The task seems trivial or one-off

Create tasks for:
- Work that won't happen this session
- Bugs or issues discovered while working
- Follow-ups from completed work
- Multi-step plans (use subtasks — see below)
- Anything the user says to remind them about

## Organizing with Labels
Use labels to categorize and filter tasks:
- `@bug`, `@feature`, `@refactor` — work type
- `@blocked`, `@waiting` — status
- `@high-priority` — urgency
- Project-specific labels: `@auth`, `@api`, `@frontend`

Create labels as needed. Filter tasks by label when reviewing specific areas.

## Using Subtasks for Multi-Step Work
For ordered, dependent work, use subtasks via `parentId`:

```
# Create parent task
create_task "Implement user authentication"

# Create ordered subtasks
create_task "Set up auth middleware" with parentId: <parent-id>
create_task "Add login endpoint" with parentId: <parent-id>
create_task "Add logout endpoint" with parentId: <parent-id>
create_task "Write auth tests" with parentId: <parent-id>
```

Subtasks:
- Appear indented under their parent when listing
- Can be completed independently
- Are deleted if the parent is deleted (cascade)
- Use `list_tasks` with `parentId` to see subtasks of a specific task

When to use subtasks vs separate tasks:
- **Subtasks**: Steps that must happen in order, or are part of a larger deliverable
- **Separate tasks**: Independent work items that happen to be related

## How to Create Good Tasks
Context is tokens. Use the minimum needed for a cold agent to pick up the task and execute without asking questions. No prose, no filler — just the facts it needs.

Include:
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
- **Update task context with progress and decisions as you go** — use `add_task_update` for activity tracking
- If the session ends before completion, update context with current state so the next session can pick up seamlessly

## When to Complete Tasks
- **Proactively complete tasks when work is done.** Don't wait to be asked.
- After finishing work that corresponds to a Dooist task, mark it complete immediately
- If no Dooist task exists for completed work, create one and mark it complete to persist the context
- If unsure whether a task is fully done, ask the user before marking complete

## Scanning TODOs
- When starting on a new/unfamiliar codebase, suggest: "Want me to scan for TODOs?"
- When the user asks what needs work in a repo
