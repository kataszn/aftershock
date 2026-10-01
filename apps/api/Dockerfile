FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @repo/api bundle

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/apps/api/dist/index.js ./index.js
COPY --from=build /app/apps/api/src/public ./public
EXPOSE 3000
CMD ["node", "index.js"]