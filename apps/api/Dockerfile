FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @erp/api...

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @erp/api... build

FROM node:22-alpine AS runner
RUN addgroup -S erp && adduser -S erp -G erp
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=erp:erp /app/node_modules ./node_modules
COPY --from=build --chown=erp:erp /app/packages ./packages
COPY --from=build --chown=erp:erp /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=erp:erp /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=erp:erp /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=erp:erp /app/apps/api/node_modules ./apps/api/node_modules
USER erp
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
