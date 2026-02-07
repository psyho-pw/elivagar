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
RUN pnpm proto:generate && pnpm build:notification
RUN pnpm prune --prod

FROM base AS production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist/apps/notification ./dist/apps/notification
COPY package.json ./

ENV NODE_ENV=production
ENV SERVICE_NAME=notification
ENV TZ=utc

EXPOSE 4100 5001
CMD ["node", "dist/apps/notification/main.js"]
