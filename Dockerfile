# Container image for hosting the SACVIN Global Plastics Lead Engine.
#
# Three deliberate choices, all favouring a build that always succeeds over a
# smaller image:
#
#  * No VOLUME instruction. Railway rejects a Dockerfile that declares one —
#    it manages persistent disks itself, and the image must not claim one.
#    The disk is attached in the host's own settings, mounted at /data.
#  * The full node image, not -slim. It already carries python3, make and g++,
#    which better-sqlite3 needs when no prebuilt binary matches the host. That
#    removes an apt-get step, and with it a call out to the Debian mirrors that
#    can fail inside a build sandbox for reasons nothing to do with this app.
#  * A single stage. better-sqlite3 is a native module, and copying a compiled
#    native module between build stages is the usual way these images break.

FROM node:22-bookworm

WORKDIR /app

# No telemetry call during the build, and no audit/fund chatter, so the build
# depends on the npm registry and nothing else.
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies first, so a code-only change does not reinstall everything.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build

# Set only after the build. Next already builds in production mode on its own,
# and setting it before the install changes how npm treats devDependencies.
ENV NODE_ENV=production

# Where the database lives. This path is a mount point for the host's disk, so
# the data survives restarts and redeploys. The directory is created here only
# so the app still starts (against a throwaway database) if the disk is missing
# — which shows up as an empty Markets page rather than a crash loop.
ENV DATABASE_PATH=/data/app.db
RUN mkdir -p /data

EXPOSE 3000
CMD ["npm", "run", "start:hosted"]
