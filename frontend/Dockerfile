# syntax=docker/dockerfile:1

# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build-time constant: empty => same-origin relative /api requests (served by nginx).
ENV VITE_API_URL=""
RUN npm run build

# --- serve stage ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
