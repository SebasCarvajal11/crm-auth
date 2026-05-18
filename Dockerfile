FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY drizzle.config.ts ./ 
COPY openapi ./openapi
EXPOSE 3000
CMD ["pnpm", "start"]
