FROM node:20-alpine
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY drizzle.config.ts ./ 
COPY openapi ./openapi
EXPOSE 3000
CMD ["npx", "tsx", "src/server.ts"]