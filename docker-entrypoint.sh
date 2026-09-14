#!/bin/sh
set -e

echo "Waiting for PostgreSQL database..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready!"

echo "Syncing database schema with Prisma..."
npx prisma db push --url "$DATABASE_URL" --accept-data-loss

echo "Checking database..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT count(*) FROM users', (err, res) => {
  pool.end();
  if (!err && res && parseInt(res.rows[0].count, 10) > 0) {
    console.log('Database already initialized, skipping seed.');
  } else {
    console.log('Database is empty, seeding...');
    require('child_process').execSync('node prisma/seed.js', { stdio: 'inherit' });
  }
});
" || true

echo "Starting Next.js server..."
exec "$@"
