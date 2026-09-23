ARG alpineVersion=latest
FROM alpine:${alpineVersion} AS builder

RUN apk add --no-cache --virtual .buildDeps \
    build-base \
    libusb-dev \
    openssl-dev \
    librtlsdr-dev \
    cmake \
    git

WORKDIR /build

# Clone rtl_433 inside the Dockerfile for better layer caching
# The cache key is based on the ARG values, not file timestamps
# rtl433GitSha is used to bust cache when branch HEAD changes (e.g., master)
ARG rtl433GitVersion=master
ARG rtl433GitSha=latest
RUN git clone --depth 1 --branch ${rtl433GitVersion} https://github.com/merbanan/rtl_433 ./rtl_433 \
    && echo "Built from ${rtl433GitVersion} @ ${rtl433GitSha}"

WORKDIR ./rtl_433/build
RUN cmake -DCMAKE_POLICY_VERSION_MINIMUM=3.5 -DENABLE_OPENSSL=ON ..
RUN make
WORKDIR /build/root
WORKDIR /build/rtl_433/build
RUN make DESTDIR=/build/root/ install
RUN ls -lah /build/root

ARG alpineVersion=latest
FROM alpine:${alpineVersion}

RUN apk add --no-cache libusb librtlsdr tzdata openssl
WORKDIR /root
COPY --from=builder /build/root/ /

ENTRYPOINT ["/usr/local/bin/rtl_433"]

# Keep the LABEL last. rtl433GitSha changes on every upstream master commit, and
# BuildKit invalidates the cache from an ARG's first *use* onwards - so keeping
# the only use down here leaves the apk install above it cached.
ARG rtl433GitVersion=master
ARG rtl433GitSha=latest
LABEL org.opencontainers.image.title="rtl_433" \
    org.opencontainers.image.description="rtl_433 on Alpine - a generic data receiver for ISM band devices using RTL-SDR" \
    org.opencontainers.image.authors="hertzg" \
    org.opencontainers.image.url="https://github.com/hertzg/rtl_433_docker" \
    org.opencontainers.image.source="https://github.com/hertzg/rtl_433_docker" \
    org.opencontainers.image.licenses="GPL-2.0-or-later" \
    org.opencontainers.image.version="${rtl433GitVersion}" \
    org.opencontainers.image.revision="${rtl433GitSha}"
