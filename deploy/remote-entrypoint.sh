#!/usr/bin/env bash
# Run as root on the VM (via `gcloud compute ssh ... --command`) by
# .github/workflows/deploy.yml, after it stages image.tar.gz, run.sh, and
# deploy.env into $STAGE_DIR. Wires those staged files into what run.sh
# expects, then always deletes the staged copies on exit - including
# deploy.env, which holds the Cloudflare API token - whether the deploy
# succeeds or fails partway. Never touches $STATE_DIR (the cert volume).
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
chmod +x "$STAGE_DIR/run.sh"
"$STAGE_DIR/run.sh"
