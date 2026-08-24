FROM node:22-bookworm-slim@sha256:f32b81066cde10a75dbac96646099533316d94bac4150c55da1636e1f0ffdc46

ARG NODE_VERSION=22.14.0

ENV NODE_VERSION=${NODE_VERSION} \
    NODE_PATH=/opt/grant-info-collector/node_modules

WORKDIR /opt/grant-info-collector
COPY package.json package-lock.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force \
    && useradd --create-home --uid 10001 --shell /usr/sbin/nologin collector \
    && mkdir -p /workspace \
    && chown -R collector:collector /opt/grant-info-collector /workspace

COPY --chown=collector:collector src ./src

USER collector:collector
WORKDIR /workspace

CMD ["node", "/opt/grant-info-collector/src/cli.js", "--config", "/workspace/config/sources.json", "--output", "/workspace/reports/latest"]
