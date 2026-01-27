# Todoist Clone

Open-source Todoist clone with MCP integration for Claude Code sessions. Runs locally with SQLite.

## Features

- **MCP Server**: Full integration with Claude Code for task management via natural language
- **Natural Language Dates**: "tomorrow", "next monday", "every friday" parsed automatically
- **Priority Levels**: P1 (urgent) through P4 (low)
- **Labels**: Organize tasks with custom labels
- **Projects**: Group tasks into projects (Inbox is created by default)
- **Today/Upcoming Views**: Quick access to due tasks

## Installation

```bash
npm install
npm run build
```

## Usage with Claude Code

Add to your `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/path/to/todoistclone/dist/mcp-stdio.js"]
    }
  }
}
```

Then restart Claude Code. You can now manage tasks with natural language:

- "What are my tasks for today?"
- "Create a task to review PR #123 due tomorrow with priority 2"
- "Complete task [id]"
- "Show my upcoming tasks for the next 7 days"

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `create_task` | Create a new task with optional project, priority, due date, labels |
| `list_tasks` | List tasks with optional project/label filters |
| `complete_task` | Mark a task as completed |
| `reopen_task` | Reopen a completed task |
| `update_task` | Update task content, priority, due date, or labels |
| `delete_task` | Delete a task permanently |
| `today` | Get all tasks due today (including overdue) |
| `upcoming` | Get tasks due in the next N days |
| `list_projects` | List all projects |
| `create_project` | Create a new project |
| `list_labels` | List all labels |
| `create_label` | Create a new label |

## Due Date Examples

The following natural language formats are supported:

- `today`, `tomorrow`, `yesterday`
- `next monday`, `this friday`
- `in 3 days`, `in 2 weeks`
- `March 15`, `2024-03-15`
- `every monday` (recurring)
- `daily`, `weekly`, `monthly`

## Development

```bash
# Install dependencies
npm install

# Run TypeScript compiler in watch mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run typecheck
```

## Project Structure

```
src/
├── config/          # Environment configuration
├── db/              # Database factory and migrations
│   └── migrations/  # Kysely migrations
├── mcp/             # MCP server and tools
├── services/        # Business logic (tasks, projects, labels)
├── types/           # TypeScript type definitions
├── __tests__/       # Test files
└── mcp-stdio.ts     # Entry point
```

## Database

Data is stored in SQLite at `./data/todoist.db`. The database is created automatically on first run.

### Schema

- **projects**: id, name, color, order, is_inbox, is_archived
- **tasks**: id, project_id, content, description, priority, due_*, is_completed
- **labels**: id, name, color, order
- **task_labels**: task_id, label_id (join table)
- **sections**: id, project_id, name, order

## License

MIT
