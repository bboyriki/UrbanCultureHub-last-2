# ─────────────────────────────────────────────────────────────
# Stage 1 — Builder
# Installs ALL deps, compiles the React frontend (Vite) and
# the Express server (esbuild), then prunes dev-only packages.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Build-time tools: python3/make/g++ for native addons (e.g. bufferutil),
# plus ffmpeg for fluent-ffmpeg media processing.
RUN apk add --no-cache python3 make g++ ffmpeg

WORKDIR /app

# Copy package manifests first — Docker layer-caches node_modules install
# and only re-runs npm ci when package-lock.json changes.
COPY package.json package-lock.json* ./
# scripts/ must arrive before npm install so the postinstall hook can run
COPY scripts/ ./scripts/

RUN npm install --legacy-peer-deps

# Copy the full source tree
COPY . .

# ── VITE_* build-time variables ───────────────────────────────
# These are baked into the frontend bundle at build time.
# Pass them on Railway via: Settings → Variables → Build Variables
# (or expose them as normal env vars in the railway.json build section).
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_STRIPE_PUBLIC_KEY

ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY \
    VITE_STRIPE_PUBLIC_KEY=$VITE_STRIPE_PUBLIC_KEY

# Build frontend (Vite → dist/public) + server (esbuild → dist/index.js)
# prebuild script writes .env.production from the VITE_* ARGs above.
RUN npm run build

# Remove dev dependencies — keeps the node_modules we copy to the next stage lean.
RUN npm prune --omit=dev --legacy-peer-deps


# ─────────────────────────────────────────────────────────────
# Stage 2 — Production image
# Minimal Alpine image with only runtime dependencies.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Only the runtime binary is needed (no build tools)
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Bring in pruned node_modules from the builder (native binaries already
# compiled for Alpine musl libc — no recompilation needed).
COPY --from=builder /app/node_modules ./node_modules

# Bring in compiled output
COPY --from=builder /app/dist ./dist

# Minimal package.json so Node can resolve the "type": "module" field
COPY package.json ./

# Drop privileges — never run as root in production
RUN addgroup -g 1001 -S nodejs \
 && adduser  -u 1001 -S nodejs -G nodejs
USER nodejs

# Railway injects PORT at runtime; the app already reads process.env.PORT.
EXPOSE 5000

ENV NODE_ENV=production

# Healthcheck mirrors the /health endpoint registered first in server/index.ts
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-5000}/health || exit 1

CMD ["node", "dist/index.js"]
