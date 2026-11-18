# syntax=docker/dockerfile:1

# The panel ships as one image: the BFF serves /panel-api and the built SPA.

FROM node:22-alpine AS deps
WORKDIR /app
# better-sqlite3 compiles its native part when no prebuild matches the image.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8090 \
    WEB_ROOT=/app/public \
    DB_FILE=/app/data/panel.db
RUN addgroup -S panel && adduser -S panel -G panel && mkdir -p /app/data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/frontend/dist/frontend/browser ./public
RUN chown -R panel:panel /app/data
USER panel
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8090) + '/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/dist/server.js"]
