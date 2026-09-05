import { beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import { getDatabase, closeDatabase } from '../src/core/database/db.js';
import { seedDatabase } from '../src/core/database/seed.js';

let testDbPath: string;

beforeAll(async () => {
  const uniqueId = `${process.pid}_${Math.random().toString(36).substring(2, 8)}`;
  testDbPath = path.resolve(process.cwd(), `test-uapms-${uniqueId}.sqlite`);

  process.env.DATABASE_FILE = testDbPath;
  getDatabase(testDbPath);
  await seedDatabase(testDbPath);
});

afterAll(() => {
  closeDatabase();
  if (testDbPath && fs.existsSync(testDbPath)) {
    try {
      fs.unlinkSync(testDbPath);
    } catch {}
  }
});
