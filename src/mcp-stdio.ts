#!/usr/bin/env node

import { initializeDatabase } from './db/index.js';
import { runStdioServer } from './mcp/server.js';

async function main(): Promise<void> {
  try {
    const db = await initializeDatabase();
    await runStdioServer(db);
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();
