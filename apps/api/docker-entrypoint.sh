#!/bin/sh
# Applies pending Prisma migrations before starting the API.
# Set RUN_MIGRATIONS=false when migrations are run by a deploy job instead.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "Applying database migrations..."
  npx prisma migrate deploy
fi

exec "$@"
