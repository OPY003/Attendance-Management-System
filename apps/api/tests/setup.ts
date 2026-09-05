import fs from 'fs';
import path from 'path';
import { closeDatabase, getDatabase } from '../src/core/database/db.js';
import { seedDatabase } from '../src/core/database/seed.js';

const testDbPath = path.resolve(process.cwd(), `test-uapms-${process.pid}-${Math.random().toString(36).substring(2, 8)}.sqlite`);
process.env.DATABASE_FILE = testDbPath;

getDatabase(testDbPath);
await seedDatabase(testDbPath);

const cleanup = () => {
  closeDatabase();
  if (fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {}
  }
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
