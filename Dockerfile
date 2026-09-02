# syntax=docker/dockerfile:1

FROM node:20-slim AS base
WORKDIR /app
RUN corepack enable

# --- deps: install once, cached as long as lockfiles/package.json don't change ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

# --- build: bring in source, build shared -> web -> api ---
FROM deps AS build
COPY . .
RUN pnpm run build

# --- runtime: only what's needed to run the api + serve the web build ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml* ./
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod --filter @plantapp/api...
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/data/seeds data/seeds

EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
