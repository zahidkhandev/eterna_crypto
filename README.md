# Eterna DEX Order Execution Engine

A high-performance, event-driven order execution engine simulating decentralized exchange (DEX) routing. This system processes market orders, simulates routing between Raydium and Meteora, and streams real-time updates to clients via WebSockets.

## Architecture

The project is structured as a **Monorepo** using **Turborepo** to ensure strict separation of concerns and type safety across services.

### Core Services (Apps)

- **`apps/api` (Fastify Server)**:
  - **Role**: The entry point for the system.
  - **Function**: Accepts HTTP POST requests for new orders, validates payloads using shared Zod schemas, and establishes WebSocket connections to stream order status updates to clients.
  - **Tech**: Node.js, Fastify, `@fastify/websocket`, BullMQ (Producer).
- **`apps/worker` (Order Processor)**:
  - **Role**: The background processing engine.
  - **Function**: Consumes jobs from the Redis queue, executes the "routing logic" (querying the Mock Router), simulates transaction execution, and updates the database.
  - **Tech**: Node.js, BullMQ (Worker), Redis.

### Shared Libraries (Packages)

- **`packages/database`**:
  - Singleton connection for **Prisma (PostgreSQL)** and **Redis**.
  - Centralized `prisma.schema` managing the `Order` model.
  - Uses **Prisma v7** with the Rust-free `prisma-client` and `@prisma/adapter-pg`.
- **`packages/mock-router`**:
  - Simulated logic for querying prices from DEXs (Raydium/Meteora) with artificial network delays and price slippage.
- **`packages/types`**:
  - Shared **Zod** validation schemas (`OrderSchema`) and TypeScript interfaces to ensure the API and Worker always agree on data structures.

---

## Getting Started

### Prerequisites

- **Node.js**: v18 or higher.
- **Container Runtime**: Docker Desktop OR Podman.
- **Package Manager**: npm (v10+).

### 1. Environment Configuration

Create a `.env` file in the root directory. This configures both the infrastructure (Docker/Podman) and the applications.

```bash
# --- Docker / Podman Configuration ---
# Use 'localhost/' for Podman to force using local images and avoid registry lookup errors.
# Use 'docker.io/' if using standard Docker.
IMAGE_REGISTRY=localhost/

# 'never' prevents attempting to contact docker.io (bypassing proxy/network issues).
# 'missing' is standard for Docker.
PULL_POLICY=never

# --- Database Config ---
DB_USER=user
DB_PASSWORD=password
DB_NAME=dex_engine
DB_PORT=5432
# Prisma Connection String used by the app to connect to the container
DATABASE_URL="postgresql://user:password@localhost:5432/dex_engine?schema=public"

# --- Redis Config ---
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=dex123

# --- App Config ---
NODE_ENV=development
API_PORT=3000
```

### 2\. Start Infrastructure

We use a unified `docker-compose.yml` that works for both Docker and Podman. It spins up **PostgreSQL 17 (pgvector)** and **Redis 8**.

**For Docker Users:**

```bash
npm run docker:up
```

**For Podman Users:**

```bash
# This uses 'podman-compose' and respects the .env settings for local images
npm run podman:up
```

_Verify health:_

```bash
npm run podman:health
# OR
npm run docker:health
```

### 3\. Install & Sync Database

Install dependencies and push the Prisma schema to your running database container.

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client (artifacts created in `packages/database/src/generated`)
npm run db:generate

# 3. Push Schema to DB (Creates tables in Postgres)
npm run db:push
```

### 4\. Run the Applications

Start both the API and Worker in development mode with live reloading.

```bash
npm run dev
```

- **API** will be available at: `http://localhost:3000`
- **Worker** will start listening for jobs in the background.

---

## Commands Reference

### Infrastructure

| Command                | Description                                         |
| :--------------------- | :-------------------------------------------------- |
| `npm run docker:up`    | Start containers (detached mode)                    |
| `npm run docker:down`  | Stop and remove containers                          |
| `npm run docker:logs`  | View infrastructure logs                            |
| `npm run podman:up`    | Start containers using Podman                       |
| `npm run podman:clean` | Stop containers and **destroy volumes** (resets DB) |

### Database

| Command               | Description                                       |
| :-------------------- | :------------------------------------------------ |
| `npm run db:generate` | Generate TypeScript client from schema            |
| `npm run db:push`     | Push schema changes to the database (prototyping) |
| `npm run db:studio`   | Open Prisma Studio GUI to view/edit data          |

### Development

| Command              | Description                   |
| :------------------- | :---------------------------- |
| `npm run dev`        | Start all apps (API + Worker) |
| `npm run dev:api`    | Start only the API            |
| `npm run dev:worker` | Start only the Worker         |
| `npm run build`      | Build all packages and apps   |
| `npm run lint`       | Lint codebase                 |

---

## Infrastructure Details (`docker-compose.yml`)

The infrastructure is defined in a single compose file designed for resilience and resource management.

### Services

1.  **Redis (`dex-redis`)**:
    - **Image**: `redis:8-alpine`
    - **Config**: AOF persistence enabled (`appendonly yes`), password protected (`requirepass`), and LRU eviction policy (`allkeys-lru`) to manage memory efficiently.
    - **Healthcheck**: Pings the server every 10s to ensure readiness before apps connect.
2.  **PostgreSQL (`dex-postgres`)**:
    - **Image**: `pgvector/pgvector:pg17` (Supports vector extensions for future AI features).
    - **Config**: Standard user/pass auth via environment variables.
    - **Persistence**: Data persisted to named volume `postgres_data`.

### Configuration Variables

- `${IMAGE_REGISTRY}`: Dynamic prefix allows switching between `docker.io` (public hub) and `localhost/` (local Podman cache) without changing the compose file.
- `${PULL_POLICY}`: Controls whether the runtime should try to download images (`missing`) or strictly use what is available locally (`never`), vital for offline/proxy environments.

<!-- end list -->

```

```

```

```
