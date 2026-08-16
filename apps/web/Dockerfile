FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @erp/web...

FROM deps AS build
COPY packages packages
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @erp/web... build

FROM node:22-alpine AS runner
RUN addgroup -S erp && adduser -S erp -G erp
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=erp:erp /app/apps/web/.next/standalone ./
COPY --from=build --chown=erp:erp /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=erp:erp /app/apps/web/public ./apps/web/public
USER erp
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
