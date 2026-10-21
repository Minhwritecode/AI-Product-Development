#!/bin/sh
set -eu

npm run db:migrate

if [ "${LUMINEX_SEED_ON_START:-false}" = "true" ]; then
  npm run db:seed
fi

exec npm run start
