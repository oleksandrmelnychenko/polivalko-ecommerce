FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/shop/package.json apps/shop/
COPY apps/console/package.json apps/console/
COPY packages/shared/package.json packages/shared/
ARG APP=shop
# Install only this application and shared code, preserving downloads across retries.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --workspace="$APP" --workspace=@polivalko/shared --include-workspace-root --prefer-offline --no-audit --no-fund --loglevel=http \
      --maxsockets=5 --fetch-retries=2 --fetch-timeout=60000 \
      --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000

FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
ARG APP=shop
ARG SITE_URL="http://localhost:8080"
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ARG NEXT_PUBLIC_GSC_VERIFICATION=""
ENV SITE_URL=$SITE_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_PUBLIC_GSC_VERIFICATION=$NEXT_PUBLIC_GSC_VERIFICATION
RUN npm run build -w $APP

FROM caddy:2-alpine AS console
COPY apps/console/serve.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/console/out /srv
EXPOSE 3000

FROM node:24-alpine AS shop
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/shop/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/shop/.next/static ./apps/shop/.next/static
COPY --from=build --chown=node:node /app/apps/shop/public ./apps/shop/public
WORKDIR /app/apps/shop
USER node
EXPOSE 3000
CMD ["node", "server.js"]
