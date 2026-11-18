# One image serves the API, the WebSocket server and the built React app
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
# Optional PostHog key, baked into the web bundle at build time (it's a public key)
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/dist ./apps/web/dist
WORKDIR /app/apps/server
# The app only needs to read its files and talk to the network, so it does not run as root
USER node
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
