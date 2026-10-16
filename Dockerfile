# syntax=docker/dockerfile:1

# Production image for Gamebook Engine: a Nuxt (Nitro node-server) build served by Node.
#   docker build -t gamebook-engine .
#   docker run --rm -p 3000:3000 -v ./my-books:/books:ro gamebook-engine
#
# Book packs are read at runtime from BOOKS_DIR (/books): mount a folder of packs there. Without a
# volume the image serves the demo book. Adding or changing a book needs only a restart.

ARG NODE_VERSION=24
# The runtime copies Node's binary onto plain Alpine: both stages must use the same Alpine release
ARG ALPINE_VERSION=3.24

# ---- Build -------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build
WORKDIR /app

# Dependencies first, so source edits do not invalidate this layer.
# Scripts are skipped here: postinstall runs `nuxt prepare`, which needs the sources copied below.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund

COPY . .
# @nuxt/fonts downloads the web fonts during the build, so this step needs network access
RUN npm run build

# ---- Runtime -----------------------------------------------------------------
# Only the Node binary is taken from the official image: no npm, yarn or corepack in production,
# which roughly halves the image and removes their CVEs from it
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS node

FROM alpine:${ALPINE_VERSION} AS runtime

# Node's shared libraries; tini forwards signals, so `docker stop` shuts the server down cleanly
RUN apk add --no-cache libstdc++ libgcc tini \
 && addgroup -g 1000 node \
 && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=node /usr/local/bin/node /usr/local/bin/node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    BOOKS_DIR=/books

WORKDIR /app
# .output is self-contained: server code, its node_modules, the bundled sections and the
# precompressed public assets. Nothing else from the repository is needed at runtime.
# Owned by root and read-only for the server user: the app never writes to disk
COPY --from=build /app/.output ./.output
# The demo book, shown until a folder of packs is mounted over /books
COPY --from=build /app/examples/books /books

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", ".output/server/index.mjs"]
