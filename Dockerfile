# syntax=docker/dockerfile:1

# The frontend (frontend/build/) and the server release binary
# (target/release/tristankerner-com) are built on the GitHub Actions runner,
# not here (see .github/workflows/deploy.yml) - that's where dependency
# caching and the 90%+ test coverage gate live. This Dockerfile only
# assembles the runtime image from those already-built artifacts, so
# `docker build .` requires both to already exist in the build context.
#
# Distroless: no shell, package manager, or other OS tooling - just glibc +
# libgcc (this binary's only two dynamic deps, confirmed via ldd) to run it
# alongside the static frontend build. Root, not :nonroot, since
# deploy/run.sh binds this container to 80/443 directly, which needs
# CAP_NET_BIND_SERVICE that uid 65532 wouldn't have.
FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY target/release/tristankerner-com ./tristankerner-com
COPY frontend/build ./frontend/build

ENV HOST=0.0.0.0
ENV PORT=80

# TLS is opt-in (see src/main.rs): set TLS_CERT_PATH/TLS_KEY_PATH to a
# certbot-managed fullchain.pem/privkey.pem to have this process terminate
# HTTPS itself and redirect plain HTTP to it. e.g., with a certbot container
# (dns-cloudflare plugin) writing into a shared volume:
#
#   docker run \
#     -v certbot-etc:/etc/letsencrypt:ro \
#     -e TLS_CERT_PATH=/etc/letsencrypt/live/<domain>/fullchain.pem \
#     -e TLS_KEY_PATH=/etc/letsencrypt/live/<domain>/privkey.pem \
#     -p 80:80 -p 443:443 tristankerner-com
#
# The cert/key are re-read on their mtime changing, so certbot's renewal
# doesn't require restarting this container. Leave both env vars unset to
# serve plain HTTP only (e.g. behind an external TLS-terminating proxy).
EXPOSE 80 443

ENTRYPOINT ["./tristankerner-com"]
