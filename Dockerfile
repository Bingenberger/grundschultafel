FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS dependencies
ENV npm_config_cache=/tmp/npm-cache npm_config_devdir=/tmp/node-gyp npm_config_nodedir=/usr/local NEXT_TELEMETRY_DISABLED=1
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS builder
COPY next.config.ts tsconfig.json postcss.config.mjs ./
COPY src ./src
COPY public/timer/index.html ./public/timer/index.html
RUN npm run build -- --webpack

FROM builder AS tests
COPY scripts ./scripts
USER 10001:10001

FROM node:22.23.4-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TAFEL_DATA_DIR=/data TAFEL_ASSET_DIR=/data/assets
WORKDIR /app
COPY --from=builder /build/.next/standalone ./
COPY --from=builder /build/.next/static ./.next/static
COPY --from=builder /build/public ./public
COPY --from=dependencies /build/node_modules/bcryptjs ./node_modules/bcryptjs
COPY scripts/start.mjs scripts/migrate.mjs scripts/bootstrap.mjs ./scripts/
COPY src/lib/file-store.cjs ./src/lib/file-store.cjs
RUN groupadd --gid 10001 tafel && useradd --uid 10001 --gid 10001 --no-create-home tafel \
    && mkdir -p /data && chown 10001:10001 /data && chmod 700 /data
USER 10001:10001
EXPOSE 3000
CMD ["node", "scripts/start.mjs"]
