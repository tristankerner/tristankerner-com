#!/usr/bin/env bash
# Brings up tristankerner.com on a GCP Container-Optimized OS VM: a certbot
# container that issues/renews a Let's Encrypt cert via the Cloudflare DNS-01
# challenge, and the app container consuming it. COS has no docker-compose,
# so this is the "docker-compose up -d" equivalent as a plain script - just
# `docker run` calls sharing a filesystem volume, no compose file needed.
#
# All configuration comes from environment variables (defaults below, hard
# requirements checked below that) rather than constants in this file, so
# .github/workflows/deploy.yml can drive it entirely from GitHub Actions
# variables/secrets without editing this script. Run by hand the same way:
#   DOMAIN=... LETSENCRYPT_EMAIL=... CLOUDFLARE_API_TOKEN=... ./deploy/run.sh
#
# Re-running this script is safe: it stops+recreates the app container (and
# the certbot-renew sidecar) in place, but never deletes or modifies an
# already-issued certificate under $STATE_DIR, and skips issuance entirely
# if one already exists (renewal is handled by the long-running
# certbot-renew container below, not by this script).
set -euo pipefail

# --- Configuration -------------------------------------------------------
: "${STATE_DIR:=/var/lib/tristankerner}"
: "${IMAGE_NAME:=tristankerner-com}"
: "${IMAGE_TAR:=/tmp/tristankerner-com-image.tar.gz}"
: "${CONTAINER_NAME:=tristankerner-com}"
: "${HTTP_PORT:=80}"
: "${HTTPS_PORT:=443}"
: "${CONTAINER_PORT:=80}"
: "${CONTAINER_TLS_PORT:=443}"

# DOMAIN, LETSENCRYPT_EMAIL: certbot's `-d`/`--email` for the cert.
# CLOUDFLARE_API_TOKEN: Cloudflare API Token (not the legacy Global API Key)
# scoped to "Zone:DNS:Edit" for this zone only (My Profile -> API Tokens ->
# Create Token -> "Edit zone DNS" template). Used by certbot's
# dns-cloudflare plugin for the DNS-01 challenge below.
for required in DOMAIN LETSENCRYPT_EMAIL CLOUDFLARE_API_TOKEN; do
  if [ -z "${!required:-}" ]; then
    echo "error: \$$required must be set" >&2
    exit 1
  fi
done

# COS's root filesystem is read-only; /var is the persistent, writable
# partition, so all state lives under it.
CERT_DIR="$STATE_DIR/letsencrypt"
CLOUDFLARE_INI="$STATE_DIR/cloudflare.ini"
# --------------------------------------------------------------------------

mkdir -p "$CERT_DIR"

# Cloudflare credentials live outside $CERT_DIR on purpose: $CERT_DIR is
# bind-mounted read-only into the app container so it can reach the live
# cert, and that container has no business ever seeing the API token.
umask 077
cat >"$CLOUDFLARE_INI" <<EOF
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF

# --- Load the freshly built app image -----------------------------------
# No container registry involved: the image is built in CI and shipped here
# as a plain tarball (see .github/workflows/deploy.yml).
if [ ! -f "$IMAGE_TAR" ]; then
  echo "error: image tarball not found at $IMAGE_TAR" >&2
  exit 1
fi
docker load -i "$IMAGE_TAR"

# --- Issue the initial certificate (skipped if one already exists) -----
if [ ! -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
  echo "No existing certificate for $DOMAIN, requesting one via DNS-01..."
  docker run --rm \
    -v "$CERT_DIR:/etc/letsencrypt" \
    -v "$CLOUDFLARE_INI:/etc/letsencrypt-cloudflare.ini:ro" \
    certbot/dns-cloudflare certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt-cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d "$DOMAIN" \
    --email "$LETSENCRYPT_EMAIL" \
    --agree-tos \
    --non-interactive
fi

if [ ! -f "$CERT_DIR/live/$DOMAIN/fullchain.pem" ]; then
  echo "error: certificate issuance failed, not starting the app" >&2
  exit 1
fi

# --- Renewal loop: checks twice a day, actually renews near expiry -----
# The app's cert resolver reloads from disk when the file's mtime changes
# (see src/main.rs), so a renewal here needs no restart or signal to the
# app container to take effect.
docker rm -f certbot-renew >/dev/null 2>&1 || true
docker run -d \
  --name certbot-renew \
  --restart unless-stopped \
  -v "$CERT_DIR:/etc/letsencrypt" \
  -v "$CLOUDFLARE_INI:/etc/letsencrypt-cloudflare.ini:ro" \
  --entrypoint /bin/sh \
  certbot/dns-cloudflare \
  -c 'trap exit TERM; while :; do certbot renew --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt-cloudflare.ini --dns-cloudflare-propagation-seconds 30 --non-interactive; sleep 12h & wait $!; done'

# --- App container -------------------------------------------------------
# Stops+removes whatever was previously running under this name before
# starting the new image - an in-place update, not a fresh install - and
# never touches $CERT_DIR, so already-issued certificates survive redeploys.
# HOST is deliberately not configurable: it must stay 0.0.0.0 for the -p
# port mapping below to reach the process inside the container.
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -v "$CERT_DIR:/etc/letsencrypt:ro" \
  -e HOST=0.0.0.0 \
  -e PORT="$CONTAINER_PORT" \
  -e TLS_PORT="$CONTAINER_TLS_PORT" \
  -e TLS_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -e TLS_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  -p "$HTTP_PORT:$CONTAINER_PORT" \
  -p "$HTTPS_PORT:$CONTAINER_TLS_PORT" \
  "$IMAGE_NAME:latest"

# `docker load` just repointed the "$IMAGE_NAME:latest" tag at the new
# image, leaving the previous version dangling (untagged); drop it so the
# resource-limited VM's disk doesn't grow with every deploy. This only ever
# touches dangling image layers, never $STATE_DIR.
docker image prune -f >/dev/null

echo "Up. Remember the GCP firewall must allow ingress on tcp:$HTTP_PORT and tcp:$HTTPS_PORT."
