# syntax=docker/dockerfile:1

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm/bin:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0
RUN corepack enable
WORKDIR /app


FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @mindness/api...

COPY apps/api apps/api
COPY scripts scripts

RUN pnpm --filter @mindness/api exec prisma generate \
 && pnpm --filter @mindness/api build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --legacy --filter @mindness/api --prod --ignore-scripts /prod/api

RUN rm -rf /prod/api/node_modules/.pnpm/prisma@* /prod/api/node_modules/.pnpm/typescript@* \
 && node scripts/prune-runtime-store.mjs /prod/api

RUN find /prod/api/node_modules -type f \( -name ffmpeg -o -name ffprobe \) -exec chmod +x {} +


FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3333
WORKDIR /app

COPY --from=build --chown=node:node /prod/api ./

USER node
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/main.js"]
