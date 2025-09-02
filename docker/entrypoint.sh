#!/bin/sh

set -e
DATABASE_URL=$MIGRATION_DATABASE_URL npm run prisma migrate deploy
node server.js
