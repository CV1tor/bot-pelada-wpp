FROM node:22-alpine AS dependencias
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencias AS construcao
COPY tsconfig.json tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src
RUN pnpm prisma:generate && pnpm build && pnpm prune --prod

FROM node:22-alpine AS producao
WORKDIR /app
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml ./
COPY --from=construcao /app/node_modules ./node_modules
COPY --from=construcao /app/dist ./dist
COPY prisma ./prisma
USER node
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
