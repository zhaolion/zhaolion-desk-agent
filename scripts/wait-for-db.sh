#!/bin/bash
# scripts/wait-for-db.sh

set -e

echo "Waiting for PostgreSQL..."
until PGPASSWORD=test psql -h localhost -p 5433 -U test -d desk_agent_test -c '\q' 2>/dev/null; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done
echo "PostgreSQL is ready!"

echo "Waiting for Redis..."
until redis-cli -h localhost -p 6380 ping 2>/dev/null; do
  echo "Redis is unavailable - sleeping"
  sleep 1
done
echo "Redis is ready!"

echo "All services are ready!"
