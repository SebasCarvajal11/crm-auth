FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
RUN pnpm install --prod --frozen-lockfile
COPY src ./src
COPY drizzle.config.ts ./ 
COPY openapi ./openapi
EXPOSE 3000
CMD ["pnpm", "start"]
