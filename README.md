## Online compiler playground for Alumina language

## [See it live here!](https://play.alumina-lang.net)

## Building and running it

The easiest way is with Docker. It needs to run with `--privileged` in order to setup the required cgroup for the sandbox. AWS S3-compatible storage is also required for the "Share Code" functionality.

```bash
docker build -t alumina-playground .
docker run --privileged -p 3000:3000 \
    -e AWS_ACCESS_KEY_ID=... \
    -e AWS_SECRET_ACCESS_KEY=... \
    -e AWS_REGION=... \
    -e AWS_BUCKET=... \
    alumina-playground
```

Then open http://localhost:3000. This will use the latest version of the compiler from the official Docker image.

It can also be run without Docker. It requires Node.js, a local installation of the compiler and [nsjail](https://github.com/google/nsjail).

```bash
cp .env.production .env.local  # Adjust the paths to the compiler and nsjail and add AWS credentials
yarn
yarn start
```

# Contributing

Contributions are welcome! Please open an issue or a pull request.

# License

MIT