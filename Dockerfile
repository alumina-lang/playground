FROM node:latest AS builder
ARG EXAMPLES_REV
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN EXAMPLES_REV=${EXAMPLES_REV} yarn build

FROM ubuntu:22.04 as deps
RUN apt update && apt install -y \
    autoconf \
    bison \
    flex \
    gcc \
    g++ \
    git \
    libprotobuf-dev \
    libnl-route-3-dev \
    libtool \
    make \
    pkg-config \
    protobuf-compiler \
    gosu

WORKDIR /build/nsjail
RUN git clone https://github.com/google/nsjail.git .
RUN make -j8
WORKDIR /build/libbacktrace
RUN git clone https://github.com/ianlancetaylor/libbacktrace.git .
RUN ./configure && make -j8

FROM ubuntu:22.04 as combined

WORKDIR /app

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

FROM ubuntu:22.04
RUN apt update && \
    apt install -y curl && \
    (curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -) && \
    apt-get install -y nodejs \
    gcc \
    libnl-3-200 \
    libnl-route-3-200 \
    libprotobuf23 \
    gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=ghcr.io/alumina-lang/alumina-boot:latest /usr/include/alumina /usr/include/alumina
COPY --from=ghcr.io/alumina-lang/alumina-boot:latest /usr/bin/alumina-boot /usr/bin/alumina-boot

# Pre-parse standard library for faster execution
RUN /usr/bin/alumina-boot \
    --sysroot /usr/include/alumina \
    --debug \
    --cfg threading \
    --cfg use_libbacktrace \
    -Zast-only \
    -Zdump-ast=/usr/include/alumina/sysroot.ast

RUN /usr/bin/alumina-boot \
    --sysroot /usr/include/alumina \
    --debug \
    --cfg test \
    --cfg threading \
    --cfg use_libbacktrace \
    -Zast-only \
    -Zdump-ast=/usr/include/alumina/sysroot-test.ast

COPY --from=deps /build/nsjail/nsjail /usr/bin/nsjail
COPY --from=deps /build/libbacktrace/.libs/libbacktrace.a /usr/local/lib/libbacktrace.a
COPY --from=combined /app .

RUN ranlib /usr/local/lib/libbacktrace.a

ENV NODE_ENV production
ENV CACHE_AST 1

EXPOSE 3000
CMD ["./scripts/start.sh"]
