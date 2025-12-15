# Eterna DEX Order Execution Engine

## Architecture

- **Apps**:
  - `api`: Fastify HTTP & WebSocket Server
  - `worker`: BullMQ Order Processor
- **Packages**:
  - `database`: Prisma (Postgres) & Redis connection
  - `types`: Shared Zod schemas and TS interfaces
  - `mock-router`: Simulated DEX routing logic

## Setup

1. `docker-compose up -d`
2. `npm install`
3. `npm run dev`
