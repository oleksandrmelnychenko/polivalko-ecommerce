FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/shop/package.json apps/shop/
COPY apps/console/package.json apps/console/
COPY packages/shared/package.json packages/shared/
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app ./
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
COPY --from=build /app/apps/console/dist /srv
EXPOSE 3000

FROM node:24-alpine AS shop
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/shop/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/shop/.next/static ./apps/shop/.next/static
WORKDIR /app/apps/shop
USER node
EXPOSE 3000
CMD ["node", "server.js"]
