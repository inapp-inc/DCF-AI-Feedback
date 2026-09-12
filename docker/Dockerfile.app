# Single container: Nginx (UI on :80) + Node API (localhost:8080)
# Host maps APP_HTTP_PORT (default 4020) -> container :80

FROM node:20-alpine AS fe-build
WORKDIR /fe
RUN apk add --no-cache libc6-compat
ARG VITE_BASE_PATH=/feedback/
ARG VITE_API_BASE_URL=/feedback/v1
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY codebase/frontend/package.json codebase/frontend/package-lock.json ./
RUN npm ci
COPY codebase/frontend/index.html codebase/frontend/tsconfig.json codebase/frontend/vite.config.ts ./
COPY codebase/frontend/src ./src
RUN npm run build

FROM node:20-alpine AS be-build
RUN apk add --no-cache python3 make g++
WORKDIR /be
COPY codebase/backend/package.json codebase/backend/package-lock.json ./
RUN npm ci
COPY codebase/backend/tsconfig.json ./
COPY codebase/backend/src ./src
COPY codebase/backend/db ./db
RUN npm run build

FROM node:20-alpine
RUN apk add --no-cache python3 make g++ nginx wget
WORKDIR /app/backend
ENV NODE_ENV=production
COPY codebase/backend/package.json codebase/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=be-build /be/dist ./dist
COPY codebase/backend/db ./db
COPY --from=fe-build /fe/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx-app.conf.template /etc/nginx/nginx-app.conf.template
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh \
  && mkdir -p /etc/nginx/http.d \
  && rm -rf /etc/nginx/http.d/default.conf /etc/nginx/conf.d 2>/dev/null || true
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/v1/health || exit 1
CMD ["/start.sh"]
