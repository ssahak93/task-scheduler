#!/bin/sh

set -e

DB_HOST=${DB_HOST:-mysql}
DB_USERNAME=${DB_USERNAME:-root}
DB_PASSWORD=${DB_PASSWORD:-root}

echo "========================================="
echo "Starting backend container..."
echo "========================================="

# Verify npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "WARNING: node_modules not found. Installing dependencies..."
    npm install --legacy-peer-deps
else
    echo "✓ Dependencies already installed"
fi

echo "Waiting for database to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if nc -z $DB_HOST 3306 > /dev/null 2>&1; then
    echo "✓ Database is ready!"
    break
  fi
  echo "Waiting for database... ($i/10)"
  sleep 2
  
  if [ $i -eq 10 ]; then
    echo "ERROR: Database not available after 20 seconds"
    exit 1
  fi
done

echo "========================================="
echo "Running database migrations..."
echo "========================================="
npm run migration:run
if [ $? -eq 0 ]; then
    echo "✓ Migrations completed successfully"
else
    echo "ERROR: Migrations failed"
    exit 1
fi

echo "========================================="
echo "Running database seeders..."
echo "========================================="
npm run seed
if [ $? -eq 0 ]; then
    echo "✓ Seeders completed successfully"
else
    echo "ERROR: Seeders failed"
    exit 1
fi

echo "========================================="
echo "Starting application..."
echo "========================================="
exec node dist/main
