#!/usr/bin/env bash
# Brings up tristankerner.com on a GCP Container-Optimized OS VM: a certbot
# container that issues/renews a Let's Encrypt cert via the Cloudflare DNS-01
# challenge, and the app container consuming it. COS has no docker-compose,
# so this is the "docker-compose up -d" equivalent as a plain script - just
# `docker run` calls sharing a filesystem volume, no compose file needed.
#
# Re-running this script is safe: it recreates both containers and skips
# certificate issuance if a cert already exists (renewal is handled by the
# long-running certbot-renew container below, not by this script).
set -euo pipefail

# --- Configuration -----------------------------------------------------
DOMAIN="tristankerner.com"
LETSENCRYPT_EMAIL="REPLACE_ME_WITH_YOUR_EMAIL@example.com"

# Cloudflare API token, scoped to Zone:DNS:Edit for this zone only
# (My Profile -> API Tokens -> Create Token -> "Edit zone DNS" template).
CLOUDFLARE_API_TOKEN="REPLACE_ME_WITH_CLOUDFLARE_API_TOKEN"

# Where the app image is pulled from, e.g. a GCP Artifact Registry repo:
#   us-docker.pkg.dev/PROJECT_ID/REPO/tristankerner-com:latest
# If pulling from Artifact Registry/GCR, the VM's service account needs
# Artifact Registry Reader, and `docker-credential-gcr configure-docker`
# (already set up on COS images that include the GCR credential helper).
APP_IMAGE="REPLACE_ME_WITH_APP_IMAGE_REF"

# COS's root filesystem is read-only; /var is the persistent, writable
# partition, so all state lives under it.
STATE_DIR="/var/lib/tristankerner"
CERT_DIR="$STATE_DIR/letsencrypt"
CLOUDFLARE_INI="$STATE_DIR/cloudflare.ini"
# ------------------------------------------------------------------------

for placeholder in "$LETSENCRYPT_EMAIL" "$CLOUDFLARE_API_TOKEN" "$APP_IMAGE"; do
  if [[ "$placeholder" == REPLACE_ME* ]]; then
    echo "error: edit the placeholders at the top of $0 before running it" >&2
    exit 1
  fi
done

mkdir -p "$CERT_DIR"

# Cloudflare credentials live outside $CERT_DIR on purpose: $CERT_DIR is
# bind-mounted read-only into the app container so it can reach the live
# cert, and that container has no business ever seeing the API token.
umask 077
cat >"$CLOUDFLARE_INI" <<EOF
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF

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
docker pull "$APP_IMAGE"
docker rm -f tristankerner-com >/dev/null 2>&1 || true
docker run -d \
  --name tristankerner-com \
  --restart unless-stopped \
  -v "$CERT_DIR:/etc/letsencrypt:ro" \
  -e TLS_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -e TLS_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  -p 80:80 -p 443:443 \
  "$APP_IMAGE"

echo "Up. Remember the GCP firewall must allow ingress on tcp:80 and tcp:443."
