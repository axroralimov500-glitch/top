import { config } from './config.js';
import { openDb } from './db/connection.js';
import { migrate } from './db/migrate.js';
import { buildApp } from './app.js';
import { startSweeper } from './sweeper.js';

const db = openDb();
migrate(db);

const app = buildApp(db);

const stopSweeper = startSweeper(db, config.sweepIntervalSec, (released) => {
  if (released > 0) console.log(`[sweeper] ${released} ta buyurtma muddati tugadi, qoldiq qaytarildi`);
});

const server = app.listen(config.port, () => {
  console.log(`Sayt : http://localhost:${config.port}/`);
  console.log(`API  : http://localhost:${config.port}/api/health`);
});

function shutdown() {
  console.log('Yopilmoqda...');
  stopSweeper();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
