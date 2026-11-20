# Gyro MCP uzak uç (https://mcp.gyrohosting.com). Derleme: docker build -f deploy/Dockerfile -t registry.ist.gyrohosting.com/gyro/mcp:<sürüm> .
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Çalışma imajı: yalnız alpine + nodejs (npm/yarn yok) → küçük
FROM alpine:3.22@sha256:49340b346798875b5592e5d420241f2f9cfba5f47e62ebb1446a1b34734e898f
RUN apk add --no-cache nodejs tini && addgroup -g 1000 app && adduser -D -H -u 1000 -G app app
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json LICENSE ./
COPY bin ./bin
COPY src ./src
ENV NODE_ENV=production
# 0.14.1: IPv4 önce, happy-eyeballs kapalı (pod'larda IPv6 yok; 250 ms deneme sınırı yeni bağlantıları ETIMEDOUT yapıyordu). Kod da aynısını yapar (src/net.js).
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["/sbin/tini", "--", "node", "--disable-proto=throw", "bin/gyro-mcp.js"]
CMD ["--http", "--host", "0.0.0.0", "--port", "8080", "--trust-proxy"]
