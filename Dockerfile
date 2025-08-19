# ---- Base Stage ----
FROM node:20-alpine AS base
WORKDIR /usr/src/app
COPY package.json yarn.lock ./

# ---- Dependencies ----
FROM base AS dependencies
RUN yarn install --frozen-lockfile --production=false

# ---- Build Stage ----
FROM dependencies AS build
COPY . .
RUN yarn build

# ---- Production Stage ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Installer uniquement les dépendances prod
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true

# Copier le build
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
