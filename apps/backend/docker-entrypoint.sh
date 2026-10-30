#!/bin/sh
set -e

# Ensure runtime and upload subdirectories exist and permissions are owned by user 'node'
mkdir -p /app/reports \
         /app/storage/nas-cache \
         /app/backups/database \
         /app/backups/files \
         /app/backups/temp \
         /app/uploads/kb \
         /app/uploads/temp \
         /app/uploads/contracts \
         /app/uploads/sounds \
         /app/uploads/sound \
         /app/uploads/tickets \
         /app/uploads/avatars \
         /app/uploads/documents

chown -R node:node /app/reports /app/storage /app/uploads /app/backups

# Drop root privileges and execute command as user 'node'
exec su-exec node "$@"
