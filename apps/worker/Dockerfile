FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @repo/worker bundle

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/worker/dist/index.js ./index.js
CMD ["node", "index.js"]