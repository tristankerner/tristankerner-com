# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM rust:1.96.0-slim-bookworm AS server-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=server-builder /app/target/release/tristankerner-com ./tristankerner-com
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# No TLS termination in the actix server itself (see src/main.rs); 443 is
# exposed for a fronting reverse proxy, only 80 is actually served.
ENV HOST=0.0.0.0
ENV PORT=80
EXPOSE 80 443

ENTRYPOINT ["./tristankerner-com"]
