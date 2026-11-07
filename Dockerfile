# syntax=docker/dockerfile:1

# Base image pinned by digest; Dependabot keeps it current.
ARG NODE_IMAGE=node:26-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072

FROM ${NODE_IMAGE} AS build
ARG PNPM_VERSION=12.18.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g "pnpm@${PNPM_VERSION}"
WORKDIR /repo

# Install dependencies in a cacheable layer keyed only on manifests.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts=false

COPY . .
RUN pnpm build \
  && pnpm --filter @golf-sg/api deploy --prod /out \
  && cp -r apps/web/dist /out/web

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  DATABASE_PATH=/data/golf-sg.db \
  WEB_DIST_DIR=/app/web
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY --from=build --chown=root:root /out ./
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main.js"]
