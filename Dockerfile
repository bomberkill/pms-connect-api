# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app
# pnpm-lock.yaml is lockfileVersion 9 (pnpm 9.x) — pin via corepack so the
# install is reproducible regardless of whatever pnpm ships in the base image.
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./

# ---- Dependencies ----
FROM base AS dependencies
RUN pnpm install --frozen-lockfile

# ---- Build Stage ----
FROM dependencies AS build
COPY . .
RUN pnpm build

# ---- Production Stage ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app
RUN corepack enable && corepack prepare pnpm@9 --activate

# Install curl for healthchecks
RUN apk add --no-cache curl

# Installer uniquement les dépendances prod. --ignore-scripts: postinstall
# runs `prisma generate`, but `prisma` (the CLI) is a devDependency and
# isn't installed here — harmless to skip since the generated client is
# already compiled into ./dist below (copied from the build stage, which
# did run postinstall with devDependencies present).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copier le build
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/src/main"]
