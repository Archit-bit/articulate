# Articulate — app + Vertex AI relay, for Google Cloud Run.
# Stage 1: build the web app
FROM node:22-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN npm run build

# Stage 2: small runtime with the server
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server
COPY --from=web /app/dist ./dist
EXPOSE 8080
CMD ["node", "server/index.mjs"]
