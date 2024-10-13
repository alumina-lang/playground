FROM node:latest AS builder
ARG EXAMPLES_REV
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN EXAMPLES_REV=${EXAMPLES_REV} yarn build

FROM ubuntu:24.04 as deps
RUN apt-get update && apt-get install -y \
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
    gosu \
    curl

WORKDIR /build/nsjail
RUN git clone https://github.com/google/nsjail.git .
RUN make -j8
WORKDIR /build/libbacktrace
RUN git clone https://github.com/ianlancetaylor/libbacktrace.git .
RUN ./configure && make -j8
WORKDIR /build/minicoro
RUN curl -Ss -o minicoro.c https://raw.githubusercontent.com/edubart/minicoro/main/minicoro.h
RUN gcc -O0 -g3 -fPIE -rdynamic -DMINICORO_IMPL -DNDEBUG -c -o minicoro.o minicoro.c && \
    ar rcs libminicoro.a minicoro.o

FROM ubuntu:24.04 as combined

WORKDIR /app

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

FROM ubuntu:24.04
RUN apt-get update && \
    apt-get install -y ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    (curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg) && \
    (echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list) && \
    apt-get update && \
    apt-get install -y nodejs \
    gcc \
    libnl-3-200 \
    libnl-route-3-200 \
    libprotobuf32t64 \
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
    --cfg libbacktrace \
    --cfg coroutines \
    -Zast-only \
    -Zdump-ast=/usr/include/alumina/sysroot.ast

RUN /usr/bin/alumina-boot \
    --sysroot /usr/include/alumina \
    --debug \
    --cfg test \
    --cfg threading \
    --cfg libbacktrace \
    --cfg coroutines \
    -Zast-only \
    -Zdump-ast=/usr/include/alumina/sysroot-test.ast

COPY --from=deps /build/nsjail/nsjail /usr/bin/nsjail
COPY --from=deps /build/libbacktrace/.libs/libbacktrace.a /usr/local/lib/libbacktrace.a
COPY --from=deps /build/minicoro/libminicoro.a /usr/local/lib/libminicoro.a
COPY --from=combined /app .

RUN ranlib /usr/local/lib/libbacktrace.a && \
    ranlib /usr/local/lib/libminicoro.a

ENV NODE_ENV production
ENV CACHE_AST 1

EXPOSE 3000
CMD ["./scripts/start.sh"]
