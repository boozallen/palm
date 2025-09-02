# Getting Started

**1.** Generate `.env.local` file and fill in the values

```bash
cp .env.local.sample .env.local
```

**2.** Start the app and DB services with docker compose

```bash
docker compose up -d
```

**3.** Initialize the DB

```bash
docker exec -it frontend yarn prisma migrate deploy
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Prisma

### Re-seeding the database

```bash
docker exec -it frontend yarn prisma migrate reset
```

### Generating migrations

```bash
yarn prisma migrate dev
```

### Starting Prisma studio

```bash
docker compose exec -it frontend yarn prisma studio
```

Open [http://localhost:5555](http://localhost:5555) to access the database GUI

## API Routes

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Build and Run Production Docker Containers Locally

When making changes to docker-related files, it will be necessary to build and test a production image locally. To build an image tagged as `myimg`, run the following:

```bash
docker build -t myimg .
```

Or, to build the hardened chainguard image, run:

```bash
docker build -f Dockerfile.chainguard -t myimg .
```

To run `myimg` locally:

- Have docker compose already up
- Bind to a port *other* than 3000 (used by the dev container), e.g. 3001
- Include the network docker compose created so the container will have access to the DB service
- Pass in the contents of your .env.local
- Override the NEXTAUTH_URL environment variable to reflect the bind port (3001 in this example)

```bash
docker run -it --rm --env-file .env.local -e NEXTAUTH_URL=http://localhost:3001 -p 3001:3000 --network palm-net myimg
```

If Docker reports `palm-net` is not a known network, docker compose may have used a different prefix, run `docker network list` to find the correct name for your machine- it'll be in the form `palm-net`.

## ESLint configuration

`.eslintrc.json` rules are derived from [https://eslint.org/docs/latest/rules](https://eslint.org/docs/latest/rules)

To check for any linter errors and warnings, run this command:

```bash
docker exec -it frontend yarn lint
```

To automatically resolve any errors or warnings identified by ESLint, use the following command:

```bash
docker exec -it frontend yarn lint:fix
```

**Note:** Not all linting issues can be automatically fixed. Some may require manual intervention.

## Run a Yarn Build

Run a local build via yarn to check for failing type errors or dependencies

```bash
docker exec -it -e NODE_ENV=production frontend yarn build
```

## Run Unit Tests Locally

Check for failing tests locally. Write unit tests for any changes you make and for related parts of the application that do not already have tests.

```bash
docker exec -it frontend yarn test
```
