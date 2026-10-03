import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { openDb } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { buildApp } from '../../src/app.js';
import { config } from '../../src/config.js';

// Har bir test fayli uchun: vaqtinchalik baza + izolyatsiyalangan server.
export async function startTestServer({ ttlSec = 3600 } = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ecom-test-'));
  const dbPath = path.join(dir, 'test.db');
  const db = openDb(dbPath);
  migrate(db);

  const prevTtl = config.reservationTtlSec;
  config.reservationTtlSec = ttlSec;

  const app = buildApp(db);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  async function close() {
    config.reservationTtlSec = prevTtl;
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }

  return { db, dbPath, baseUrl, close };
}
