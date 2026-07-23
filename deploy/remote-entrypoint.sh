#!/usr/bin/env bash
# Run as root on the VM (via `gcloud compute ssh ... --command`) by
# .github/workflows/deploy.yml, after it stages image.tar.gz, run.sh,
# deploy.env, and ga4-credentials.json into $STAGE_DIR. Wires those staged
# files into what run.sh expects, then always deletes the staged copies on
# exit - including deploy.env (Cloudflare API token) and
# ga4-credentials.json (GA4 service-account key) - whether the deploy
# succeeds or fails partway. Never touches $STATE_DIR (the cert/GA4-key
# volume run.sh copies its own persistent version of these into).
set -euo pipefail

STAGE_DIR=/tmp/tristankerner-deploy
cleanup() {
  rm -rf "$STAGE_DIR"
}
trap cleanup EXIT

chmod 600 "$STAGE_DIR/deploy.env"
set -a
# shellcheck disable=SC1091
source "$STAGE_DIR/deploy.env"
set +a

export IMAGE_TAR="$STAGE_DIR/image.tar.gz"
export GA4_CREDENTIALS_STAGED="$STAGE_DIR/ga4-credentials.json"

# Run via `bash` rather than executing directly: Container-Optimized OS
# mounts /tmp noexec, so a direct exec() of a staged file here always
# fails with "Permission denied" (126) regardless of its permission bits.
bash "$STAGE_DIR/run.sh"
