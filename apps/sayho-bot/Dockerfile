FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm proto:generate && pnpm build:sayho-bot
RUN pnpm prune --prod

FROM base AS production

RUN groupadd -r appuser && useradd -r -g appuser -d /app appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist/apps/sayho-bot ./dist/apps/sayho-bot
COPY --chown=appuser:appuser package.json ./

USER appuser

ENV NODE_ENV=production
ENV SERVICE_NAME=sayho-bot
ENV TZ=utc

EXPOSE 4200 8000
CMD ["node", "dist/apps/sayho-bot/main.js"]
