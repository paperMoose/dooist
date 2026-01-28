import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

export interface FoundTodo {
  type: 'TODO' | 'FIXME' | 'HACK' | 'XXX';
  content: string;
  file: string;
  line: number;
}

// File extensions to scan
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.php', '.swift', '.m', '.mm',
  '.sh', '.bash', '.zsh',
  '.yaml', '.yml', '.json', '.toml',
  '.md', '.txt',
  '.css', '.scss', '.less',
  '.html', '.vue', '.svelte',
  '.sql',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
  'target', 'vendor', '.idea', '.vscode',
  'coverage', '.nyc_output',
]);

// Regex to match TODO comments
const TODO_REGEX = /\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.+?)(?:\*\/|-->|$)/gi;

export class TodoScanner {
  async scan(directory: string): Promise<FoundTodo[]> {
    const todos: FoundTodo[] = [];
    await this.scanDirectory(directory, todos);
    return todos;
  }

  private async scanDirectory(dir: string, todos: FoundTodo[]): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      // Can't read directory, skip
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await this.scanDirectory(fullPath, todos);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          await this.scanFile(fullPath, todos);
        }
      }
    }
  }

  private async scanFile(filePath: string, todos: FoundTodo[]): Promise<void> {
    try {
      // Skip large files (> 1MB)
      const stats = await stat(filePath);
      if (stats.size > 1024 * 1024) return;

      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        // Reset regex state
        TODO_REGEX.lastIndex = 0;

        while ((match = TODO_REGEX.exec(line)) !== null) {
          const type = match[1].toUpperCase() as FoundTodo['type'];
          const todoContent = match[2].trim();

          if (todoContent) {
            todos.push({
              type,
              content: todoContent,
              file: filePath,
              line: i + 1,
            });
          }
        }
      }
    } catch {
      // Can't read file, skip
    }
  }
}
