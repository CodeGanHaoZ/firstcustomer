FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Web：Next.js standalone 输出。
FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
CMD ["node", "server.js"]

# Worker 和数据库迁移：直接用 tsx 运行源码，并带上 Playwright 需要的 Chromium。
FROM node:24-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx playwright install --with-deps chromium && chown -R node:node /ms-playwright
USER node
CMD ["npx", "tsx", "src/worker/index.ts"]
