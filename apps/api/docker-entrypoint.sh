#!/bin/sh
# Applies pending Prisma migrations before starting the API.
# Set RUN_MIGRATIONS=false when migrations are run by a deploy job instead.
set -e

# The schema declares a directUrl so pooled deployments (Vercel + Neon) can run
# migrations over a direct connection. This image talks to PostgreSQL directly,
# so default it to the app's own connection rather than demanding a second one.
export DIRECT_URL="${DIRECT_URL:-$DATABASE_URL}"

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy
fi

exec "$@"
