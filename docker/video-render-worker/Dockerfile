FROM node:22-bookworm-slim

WORKDIR /app

# Install browser runtime dependencies required by Remotion/Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
  fonts-noto \
  fonts-freefont-ttf \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libglib2.0-0 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpango-1.0-0 \
  libcairo2 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

COPY . .

# Remove next line for production use cases (TODO: remove for PROD build)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npx prisma generate

# Pre-download Remotion's headless browser at build time so the first render job is not slow
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN node -e "require('@remotion/renderer').ensureBrowser().then(() => { console.log('Remotion browser ready'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"

CMD ["npx", "ts-node", "docker/video-render-worker/worker.js"]
