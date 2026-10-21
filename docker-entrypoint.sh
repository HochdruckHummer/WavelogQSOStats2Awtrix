#!/bin/sh
set -e

# Older docker-compose files mount ./config.json directly to /app/config.json –
# keep using that file so existing setups don't lose their configuration.
if [ -f /app/config.json ] && [ ! -e "$CONFIG_FILE" ]; then
  echo "[Entrypoint] Using legacy config mount /app/config.json – consider mounting a folder to /app/data instead (see README)"
  export CONFIG_FILE=/app/config.json
elif [ -d /app/config.json ]; then
  # Docker creates a directory when the mounted host file does not exist
  echo "[Entrypoint] Warning: /app/config.json is a directory (host file missing?) – using $CONFIG_FILE instead." \
       "Mount a folder to /app/data, otherwise the configuration is lost when the container is recreated (see README)"
fi

# Started as root: make the config location writable for the unprivileged
# "node" user (bind-mounted folders are created by Docker as root), then drop
# privileges before starting the app.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data
  chown node:node /app/data || echo "[Entrypoint] Warning: could not chown /app/data"
  if [ -f "$CONFIG_FILE" ]; then
    chown node:node "$CONFIG_FILE" || echo "[Entrypoint] Warning: could not chown $CONFIG_FILE"
  fi
  exec su-exec node "$@"
fi

exec "$@"
