const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

async function start() {
  const dataDir = path.resolve(__dirname, '../data/postgres');
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: 'reachinbox',
    password: 'reachinbox_secret',
    authMethod: 'trust',
    persistent: true,
  });

  console.log('Initializing embedded Postgres...');
  try {
    await pg.initialise();
  } catch (err) {
    console.log('Postgres cluster already initialized or note:', err.message);
  }

  console.log('Starting embedded Postgres on port 5432...');
  await pg.start();
  console.log('Postgres started successfully on port 5432!');

  try {
    console.log('Creating reachinbox database...');
    await pg.createDatabase('reachinbox');
    console.log('Database reachinbox created or verified!');
  } catch (err) {
    console.log('createDatabase result:', err.message);
  }

  console.log('Embedded PostgreSQL is READY and running at postgresql://reachinbox:reachinbox_secret@localhost:5432/reachinbox');

  // Keep process alive
  setInterval(() => {}, 60000);
}

start().catch((err) => {
  console.error('Failed to start embedded postgres:', err);
  process.exit(1);
});
