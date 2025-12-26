#!/bin/sh
set -e

echo "🔄 Running database migrations..."
bun run /app/scripts/migrate.js

echo "🚀 Starting application..."
exec bun run server.js
