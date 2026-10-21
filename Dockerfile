# ── WavelogQSOStats2Awtrix ─────────────────────────────────────────────────────
FROM node:24-alpine

# su-exec lets the entrypoint drop root privileges after fixing volume permissions
RUN apk add --no-cache su-exec

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifests first (better layer caching)
COPY package.json package-lock.json ./

# Install exactly the locked production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy the rest of the application
COPY . .

# Configuration lives in /app/data – mount a folder there to persist it
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data && chown node:node /app/data
ENV NODE_ENV=production \
    CONFIG_FILE=/app/data/config.json

# The web UI runs on port 3000
EXPOSE 3000

# Start the application (as user "node", see docker-entrypoint.sh)
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "WavelogQSOStats2Awtrix.js"]
