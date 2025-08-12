# Base image
FROM node:22-alpine AS base

# Environment variables common to all stages
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencies stage: install production-only dependencies
FROM base AS deps

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-optional && yarn cache clean

# Builder stage: build the app
FROM deps AS builder

ENV NODE_ENV=production

WORKDIR /app
COPY . .

# Generate Prisma and build the app
# Remove next line for production use cases
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npx prisma generate
RUN yarn build

# Puppeteer stage: install chromium and puppeteer dependencies
FROM base AS puppeteer

RUN apk update && apk add --no-cache \
  chromium \
  dbus \
  dbus-glib \
  font-noto \
  freetype \
  harfbuzz \
  mesa-gl \
  nss \
  ttf-freefont \
  && rm -rf /var/cache/apk/*

# Development stage: for local development and testing
FROM puppeteer AS dev

ENV NODE_ENV=development

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client for development
# Remove next line for production use cases
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npx prisma generate

# Runner stage: production image
FROM puppeteer AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs --ingroup nodejs

# Avoid unnecessary mkdir/chown by copying the standalone folder first
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./

# DO NOT USE `yarn` here, it will break the image!
# The following line is removed to avoid duplicate installation
# RUN npm install prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["/app/entrypoint.sh"]
