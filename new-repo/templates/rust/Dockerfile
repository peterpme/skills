# syntax=docker/dockerfile:1.7
# Rust service image for Railway. cargo-chef builds dependencies in their own
# layer, so a source-only change reuses it and only recompiles this crate.
# Railway rejects BuildKit cache mounts unless their id hardcodes the service
# id, so this file uses layer caching instead.
# Replace APP with the binary name and match the Rust version to
# rust-toolchain.toml.

FROM lukemathwalker/cargo-chef:latest-rust-1.99.1-trixie AS chef
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --recipe-path recipe.json
COPY . .
RUN cargo build --release --locked --bin APP

FROM debian:trixie-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app app
WORKDIR /app
COPY --from=builder /app/target/release/APP /usr/local/bin/app
USER app
ENV RUST_LOG=info
# Railway sets PORT; listen on 0.0.0.0:$PORT.
CMD ["/usr/local/bin/app"]
