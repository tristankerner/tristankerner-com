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
# which, with no REGISTRY_HOST set, runs whatever `tristankerner-com:latest`
# already resolves to locally instead of pulling.
#
# To roll back, re-run with IMAGE_REF pinned to an older tag that's still in
# the registry:
#   IMAGE_REF=<location>-docker.pkg.dev/<project>/<repo>/tristankerner-com:<sha> \
#   REGISTRY_HOST=<location>-docker.pkg.dev \
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
# IMAGE_REF: the exact image to run, normally a SHA-tagged Artifact Registry
# reference like
# us-west1-docker.pkg.dev/<project>/<repo>/tristankerner-com:<git sha>.
# IMAGE_REPO: the same reference without its tag, used only to clean up
# previously deployed tags below; defaults to IMAGE_REF's own repository.
# REGISTRY_HOST: registry to authenticate against before pulling. Leave it
# empty to skip both the login and the pull and just run whatever IMAGE_REF
# already resolves to locally - that's the path for running this script by
# hand against a locally built image.
: "${IMAGE_REF:=tristankerner-com:latest}"
: "${IMAGE_REPO:=${IMAGE_REF%:*}}"
: "${REGISTRY_HOST:=}"
: "${CONTAINER_NAME:=tristankerner-com}"
: "${HTTP_PORT:=80}"
: "${HTTPS_PORT:=443}"
: "${CONTAINER_PORT:=80}"
: "${CONTAINER_TLS_PORT:=443}"
# GA4_CREDENTIALS_STAGED: path to a staged service-account JSON key file
# (set by deploy/remote-entrypoint.sh; empty/missing means GA4 querying
# stays disabled - see the GA4 block below).
: "${GA4_CREDENTIALS_STAGED:=}"
: "${GA4_PROPERTY_ID:=}"
: "${GA4_TOP_PAGES_LIMIT:=}"
: "${VISITOR_TICK_INTERVAL_MINUTES:=}"
# Only set this to "true" once the GCP firewall also restricts inbound
# HTTP_PORT/HTTPS_PORT traffic to Cloudflare's published IP ranges
# (https://www.cloudflare.com/ips/) - see the README's "Running behind
# Cloudflare" section. This script does not (and cannot) enforce that
# firewall rule itself.
: "${TRUST_CF_CONNECTING_IP:=}"

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
GA4_CREDENTIALS_FILE="$STATE_DIR/ga4-credentials.json"
# Visitor-counter sqlite storage (see src/store.rs) - unlike the above,
# always created and mounted read-write: it's core infrastructure for the
# counter feature, not an opt-in one, and it's never touched by a redeploy
# (only ever added to, same as $CERT_DIR).
VISITOR_DATA_DIR="$STATE_DIR/data"
# --------------------------------------------------------------------------

mkdir -p "$CERT_DIR" "$VISITOR_DATA_DIR"

# Cloudflare credentials live outside $CERT_DIR on purpose: $CERT_DIR is
# bind-mounted read-only into the app container so it can reach the live
# cert, and that container has no business ever seeing the API token.
umask 077
cat >"$CLOUDFLARE_INI" <<EOF
dns_cloudflare_api_token = $CLOUDFLARE_API_TOKEN
EOF

# --- Pull the freshly built app image ------------------------------------
# The image is built and pushed to Artifact Registry by CI (see
# .github/workflows/deploy.yml); this pulls it over Google's own network
# rather than having CI push a tarball down the IAP tunnel.
#
# Authentication uses a short-lived access token from the instance metadata
# server rather than any stored credential, so nothing secret is staged on
# this VM for the pull. That token is scoped by the VM's own service
# account, which needs roles/artifactregistry.reader on the repository plus
# the devstorage.read_only scope. Doing it this way rather than relying on
# docker-credential-gcr keeps this working regardless of how the COS image
# happens to have Docker's credential helpers preconfigured.
if [ -n "$REGISTRY_HOST" ]; then
  # `docker login` writes the credential it just accepted to
  # $DOCKER_CONFIG/config.json, defaulting to /root/.docker - which it can't
  # even create here, because COS mounts / read-only (the same reason
  # $STATE_DIR lives under /var). Left at the default this fails the deploy
  # outright with "Error saving credentials: mkdir /root/.docker: read-only
  # file system". Point it at a throwaway directory under /tmp instead,
  # which is a writable tmpfs on COS - the same place remote-entrypoint.sh
  # stages into. Removing that directory on exit is also what retires the
  # token, so no `docker logout` is needed.
  DOCKER_CONFIG=$(mktemp -d)
  export DOCKER_CONFIG
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT

  # `|| true` so a curl failure falls through to the explicit check below
  # rather than tripping `set -e` and exiting with no explanation. No jq on
  # COS, hence the sed extraction from the single-line JSON response.
  ACCESS_TOKEN=$(curl -sf -H "Metadata-Flavor: Google" \
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token" \
    | sed -n 's/.*"access_token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p') || true
  if [ -z "$ACCESS_TOKEN" ]; then
    echo "error: could not obtain an Artifact Registry access token from the" >&2
    echo "metadata server. Check that this VM has a service account attached" >&2
    echo "with the devstorage.read_only scope." >&2
    exit 1
  fi
  printf '%s' "$ACCESS_TOKEN" \
    | docker login -u oauth2accesstoken --password-stdin "https://$REGISTRY_HOST"
  unset ACCESS_TOKEN
  docker pull "$IMAGE_REF"
fi

if ! docker image inspect "$IMAGE_REF" >/dev/null 2>&1; then
  echo "error: image $IMAGE_REF is not available locally" >&2
  exit 1
fi

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
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  --entrypoint /bin/sh \
  certbot/dns-cloudflare \
  -c 'trap exit TERM; while :; do certbot renew --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt-cloudflare.ini --dns-cloudflare-propagation-seconds 30 --non-interactive; sleep 12h & wait $!; done'

# --- GA4 service-account credentials (optional) ---------------------------
# Mirrors the TLS cert handling above: copied into persistent storage under
# $STATE_DIR (not left in the staged copy under /tmp, which
# remote-entrypoint.sh deletes right after this script exits) so it
# survives container restarts without CI having to run again. Only mounted
# into the app container when both a real staged key and GA4_PROPERTY_ID are
# present; the app itself already treats a missing/blank
# GOOGLE_APPLICATION_CREDENTIALS or GA4_PROPERTY_ID as "GA4 querying
# disabled" (see src/ga4.rs), so leaving either unset here is safe, not
# fatal.
GA4_DOCKER_ARGS=()
if [ -n "$GA4_CREDENTIALS_STAGED" ] && [ -s "$GA4_CREDENTIALS_STAGED" ] && [ -n "$GA4_PROPERTY_ID" ]; then
  install -m 600 "$GA4_CREDENTIALS_STAGED" "$GA4_CREDENTIALS_FILE"
  GA4_DOCKER_ARGS+=(
    -v "$GA4_CREDENTIALS_FILE:/etc/ga4/credentials.json:ro"
    -e GOOGLE_APPLICATION_CREDENTIALS=/etc/ga4/credentials.json
    -e GA4_PROPERTY_ID="$GA4_PROPERTY_ID"
  )
  # Only passed through when set - src/ga4.rs already defaults to 50
  # top pages on its own if this is left unset.
  if [ -n "$GA4_TOP_PAGES_LIMIT" ]; then
    GA4_DOCKER_ARGS+=(-e GA4_TOP_PAGES_LIMIT="$GA4_TOP_PAGES_LIMIT")
  fi
fi

# Independent of the GA4 block above: these apply regardless of whether
# GA4 is configured. Both only passed through when set - the app already
# defaults to VISITOR_TICK_INTERVAL_MINUTES=1 and TRUST_CF_CONNECTING_IP
# unset (untrusted) on its own.
MISC_DOCKER_ARGS=()
if [ -n "$VISITOR_TICK_INTERVAL_MINUTES" ]; then
  MISC_DOCKER_ARGS+=(-e VISITOR_TICK_INTERVAL_MINUTES="$VISITOR_TICK_INTERVAL_MINUTES")
fi
if [ -n "$TRUST_CF_CONNECTING_IP" ]; then
  MISC_DOCKER_ARGS+=(-e TRUST_CF_CONNECTING_IP="$TRUST_CF_CONNECTING_IP")
fi

# --- App container -------------------------------------------------------
# Stops+removes whatever was previously running under this name before
# starting the new image - an in-place update, not a fresh install - and
# never touches $CERT_DIR or $VISITOR_DATA_DIR, so already-issued
# certificates and visitor counts survive redeploys. HOST is deliberately
# not configurable: it must stay 0.0.0.0 for the -p port mapping below to
# reach the process inside the container. $VISITOR_DATA_DIR is mounted
# read-write and as a *directory* (not the single .db file) - sqlite's WAL
# mode writes `-wal`/`-shm` sidecar files alongside the main one, and a
# single-file mount would leave those non-persistent (see src/store.rs and
# the Dockerfile's VISITOR_DB_PATH comment). --log-opt caps the default
# json-file driver's growth (10MB * 3 files) so now that access logs are on
# (see src/main.rs's Logger middleware), stdout/stderr can't fill this
# resource-limited VM's disk unbounded; same cap applied to certbot-renew
# below.
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -v "$CERT_DIR:/etc/letsencrypt:ro" \
  -v "$VISITOR_DATA_DIR:/data" \
  --log-opt max-size=10m \
  --log-opt max-file=3 \
  -e HOST=0.0.0.0 \
  -e PORT="$CONTAINER_PORT" \
  -e TLS_PORT="$CONTAINER_TLS_PORT" \
  -e TLS_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem" \
  -e TLS_KEY_PATH="/etc/letsencrypt/live/$DOMAIN/privkey.pem" \
  "${GA4_DOCKER_ARGS[@]}" \
  "${MISC_DOCKER_ARGS[@]}" \
  -p "$HTTP_PORT:$CONTAINER_PORT" \
  -p "$HTTPS_PORT:$CONTAINER_TLS_PORT" \
  "$IMAGE_REF"

# Every deploy pulls a new SHA-tagged image, so unlike the old `docker load`
# of a single :latest tag, the previously deployed image stays *tagged* on
# this VM and would never be reclaimed by a dangling-only prune. Drop every
# tag under this repository except the one just deployed, so the
# resource-limited VM's disk doesn't grow by ~11MB on every deploy. Scoped
# to $IMAGE_REPO, so the certbot image is never a candidate, and this only
# ever touches images, never $STATE_DIR.
docker images "$IMAGE_REPO" --format '{{.Repository}}:{{.Tag}}' \
  | grep -vxF "$IMAGE_REF" \
  | xargs -r docker rmi -f >/dev/null 2>&1 || true

# Then the usual sweep for layers left untagged by the above.
docker image prune -f >/dev/null

echo "Up. Remember the GCP firewall must allow ingress on tcp:$HTTP_PORT and tcp:$HTTPS_PORT."
