# ── WavelogQSOStats2Awtrix ─────────────────────────────────────────────────────
FROM node:20-alpine

# Set working directory inside the container
WORKDIR /app

# Copy dependency manifest first (better layer caching)
COPY package.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application
COPY . .

# The web UI runs on port 3000
EXPOSE 3000

# Start the application
CMD ["node", "WavelogQSOStats2Awtrix.js"]
