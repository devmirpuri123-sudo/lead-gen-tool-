# Container image for hosting the SACVIN Global Plastics Lead Engine.
#
# Deliberately a single stage: better-sqlite3 is a native module, and copying a
# compiled native module between build stages is the usual way these images
# break. A slightly larger image is a fair trade for one that always starts.

FROM node:22-bookworm-slim

# Toolchain for building better-sqlite3 when no prebuilt binary matches the host.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so a code-only change does not reinstall everything.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# The database lives on a mounted disk, not inside the image, so it survives
# restarts and redeploys. Mount a volume at /data on the host.
ENV DATABASE_PATH=/data/app.db
VOLUME ["/data"]

EXPOSE 3000
CMD ["npm", "run", "start:hosted"]
