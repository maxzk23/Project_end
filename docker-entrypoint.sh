#!/bin/sh
set -e

echo "Waiting for PostgreSQL database..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is ready!"

echo "Syncing database schema with Prisma..."
npx prisma db push --url "$DATABASE_URL" --accept-data-loss

echo "Seeding database..."
node prisma/seed.js || true

echo "Starting Next.js server..."
exec "$@"
