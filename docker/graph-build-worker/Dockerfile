FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

COPY . .

# Remove next line for production use cases (TODO: remove for PROD build)
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN npx prisma generate

CMD ["npx", "ts-node", "docker/graph-build-worker/worker.js"]
