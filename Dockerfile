FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY cima-contracts ./cima-contracts
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY gateway ./gateway
COPY openapi ./openapi
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY docker-healthcheck.sh /usr/local/bin/docker-healthcheck.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh /usr/local/bin/docker-healthcheck.sh && addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["docker-healthcheck.sh"]
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "start"]
