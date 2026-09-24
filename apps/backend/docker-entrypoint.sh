#!/bin/sh
set -e

# Ensure upload subdirectories exist and permissions are owned by user 'node'
mkdir -p /app/uploads/kb \
         /app/uploads/temp \
         /app/uploads/contracts \
         /app/uploads/sound \
         /app/uploads/tickets

chown -R node:node /app/uploads

# Drop root privileges and execute command as user 'node'
exec su-exec node "$@"
