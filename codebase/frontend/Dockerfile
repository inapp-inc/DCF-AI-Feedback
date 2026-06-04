# Standalone frontend image only (not used by docker-compose; production uses docker/Dockerfile.app).
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat

ARG VITE_BASE_PATH=/dcffeedback/
ARG VITE_API_BASE_URL=/dcffeedback/v1
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY nginx.conf.template ./

RUN npm run build

FROM nginx:1.27-alpine
ARG APP_BASE_PATH=/dcffeedback
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/nginx.conf.template /tmp/nginx.conf.template
RUN APP_BASE="${APP_BASE_PATH%/}" \
  && mkdir -p /etc/nginx/http.d \
  && rm -rf /etc/nginx/conf.d 2>/dev/null || true \
  && if [ -z "$APP_BASE" ] || [ "$APP_BASE" = "/" ]; then \
       sed '/location = __APP_BASE__/d' /tmp/nginx.conf.template | sed 's|__APP_BASE__||g' > /etc/nginx/http.d/default.conf; \
     else \
       sed "s|__APP_BASE__|${APP_BASE}|g" /tmp/nginx.conf.template > /etc/nginx/http.d/default.conf; \
     fi
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
