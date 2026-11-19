FROM node:26.12.1-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
WORKDIR /app

ARG SITE_URL=https://itart.studio
ARG BASE_PATH=/
ARG VCS_REF=unknown
ARG TREE_SHA
ARG BUILD_RUN_ID
ARG BUILD_ATTEMPT
ARG PUBLICATION_DATE
ARG RELEASE_VARIANT
ARG RELEASE_CONFIGURATION

COPY package.json package-lock.json ./
RUN npm ci && npm audit --audit-level=moderate

COPY astro.config.mjs tsconfig.json ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src

RUN SITE_URL="${SITE_URL}" BASE_PATH="${BASE_PATH}" npm run build \
  && if [ -n "$RELEASE_CONFIGURATION" ]; then node scripts/qa/release-candidate.mjs metadata; fi

FROM golang:1.27.4-alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS caddy-build
WORKDIR /src

RUN apk add --no-cache ca-certificates git
RUN CGO_ENABLED=0 go install -trimpath -ldflags="-s -w -X github.com/caddyserver/caddy/v2.CustomVersion=v2.11.4" github.com/caddyserver/caddy/v2/cmd/caddy@v2.11.4

FROM alpine:3.24@sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf
WORKDIR /srv

ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="IT Art Studio" \
  org.opencontainers.image.description="Static Astro showcase for itart.studio" \
  org.opencontainers.image.source="https://github.com/amineamanzou/ItArtStudio" \
  org.opencontainers.image.url="https://itart.studio" \
  org.opencontainers.image.revision="${VCS_REF}"

RUN apk add --no-cache ca-certificates mailcap tzdata \
  && addgroup -S caddy \
  && adduser -S -D -H -h /srv -s /sbin/nologin -G caddy caddy \
  && mkdir -p /config /data /etc/caddy /srv \
  && chown -R caddy:caddy /config /data /etc/caddy /srv

COPY --from=caddy-build /go/bin/caddy /usr/bin/caddy
COPY ops/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv

ENV XDG_CONFIG_HOME=/config \
  XDG_DATA_HOME=/data

USER caddy
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
