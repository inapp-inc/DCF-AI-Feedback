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
ENV NODE_ENV=production \
    PORT=8080 \
    APP_BASE_PATH=/feedback \
    DATABASE_URL=sqlite://./data/feedback.db \
    CORS_ORIGIN=* \
    PUBLIC_SURVEY_BASE_URL=/feedback/survey \
    DEMO_FAST_TRIGGERS=true \
    LLM_PROVIDER=huggingface \
    HF_MODEL=Qwen/Qwen2.5-7B-Instruct:featherless-ai \
    HF_API_BASE=https://router.huggingface.co/v1 \
    LLM_REQUEST_TIMEOUT_MS=600000 \
    LLM_MAX_RETRIES=2 \
    LLM_RETRY_BASE_DELAY_MS=1200
LABEL org.opencontainers.image.title="DCF Feedback Analytics" \
      org.opencontainers.image.description="Demo UI+API. In Podman Desktop: publish 4020:80, volume /app/backend/data, open /feedback/." \
      io.podman.desktop.name="DCF Feedback"
COPY codebase/backend/package.json codebase/backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=be-build /be/dist ./dist
COPY codebase/backend/db ./db
COPY --from=fe-build /fe/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx-app.conf.template /etc/nginx/nginx-app.conf.template
COPY docker/start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh \
  && chmod +x /start.sh \
  && mkdir -p /etc/nginx/http.d \
  && rm -rf /etc/nginx/http.d/default.conf /etc/nginx/conf.d 2>/dev/null || true
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/v1/health || exit 1
# Invoke via /bin/sh so Windows CRLF shebangs cannot break Alpine, and so
# the node image entrypoint is not used (Desktop "Command: ./start.sh" would miss /app/backend).
ENTRYPOINT ["/bin/sh", "/start.sh"]
CMD []
