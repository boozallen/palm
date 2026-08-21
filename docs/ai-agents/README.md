# AI Agents System Documentation

The PALM platform includes a sophisticated AI agents system that provides automated analysis capabilities through background job processing. This system is built on **BullMQ** job queues with **Redis** as the critical infrastructure backbone.

## Overview

AI Agents are background services that perform complex, time-intensive analysis tasks using AI models. The system supports multiple specialized agents that process jobs asynchronously.

## Available Agents

- **[CERTA Agent](./agents/certa-agent.md)** - Compliance Evaluation, Reporting, and Tracking
- **[RADAR Agent](./agents/radar-agent.md)** - Research Article Discovery and Analysis

## Technical Architecture

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│  tRPC Routes │───▶│  Job Creation   │
│  /ai-agents/    │    │ /web-policy- │    │  + Queue in     │
│  [agent]/[id]   │    │  compliance  │    │     Redis       │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                     │
                                                     ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Real-time UI   │◀───│ Redis Hash   │◀───│  BullMQ Worker  │
│   Progress      │    │   Storage    │    │   Processing    │
│   Updates       │    │ job:{jobId}  │    │   Background    │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### Job Processing Flow:

1. **Job Submission**: User submits request through agent UI (`/ai-agents/[agentSlug]/[agentId]`)
2. **Permission Check**: System validates user access via `getAvailableAgents(userId)`
3. **Job Creation**: Unique jobId generated, initial status stored in Redis
4. **Queue Addition**: Job added to BullMQ queue with retry/backoff configuration
5. **Worker Pickup**: Background worker processes job from queue
6. **Progress Updates**: Intermediate results stored in Redis as they complete
7. **Real-time Feedback**: Frontend polls Redis every 4-5 seconds for status updates
8. **Completion**: Final results stored in both Redis and database

## Database Schema

```sql
-- Core agent definition
model AiAgent {
  id          String             @id @default(uuid()) @db.Uuid
  name        String             -- Agent display name
  description String             -- Agent description  
  agentType   Int                @default(1)  -- 1=CERTA, 2=RADAR
  userGroups  UserGroup[]        -- Access control via user groups
  policies    AgentCertaPolicy[] -- CERTA-specific policies
  createdAt   DateTime           @default(now()) @db.Timestamptz
  updatedAt   DateTime           @updatedAt @db.Timestamptz
}
```

## Setup Requirements

### Environment Variables
```bash
# Redis connection (REQUIRED for agents)
REDIS_HOST=localhost              # Redis server hostname
REDIS_PORT=6379                   # Redis port (default 6379)
REDIS_PASSWORD=                   # Optional password for Redis AUTH
```

### Development Setup
```bash
# In docker-compose.yml:
services:
 redis:
    container_name: redis
    hostname: redis
    image: redis:latest
    networks:
      - palm-net
    ports:
      - "6379:6379"

volumes:
  redis_data:
```

### Production Setup
For production environments, use AWS ElastiCache `docs/ai-agents/deployment/elasticache-setup.md`.

## Agent Configuration

Agents are created and managed through the settings UI:

1. **Navigate to Settings** → AI Agents  
2. **Create New Agent** → Select agent type
3. **Configure Access** → Assign to user groups
4. **Save Configuration** → Agent becomes available to authorized users

For agent-specific configuration details, see the individual agent documentation.

## General Usage

1. **Access Agent** → Navigate to `/ai-agents/[agent-type]/[agentId]`
2. **Configure Parameters** → Set agent-specific options
3. **Submit Job** → Analysis begins processing
4. **Monitor Progress** → Real-time updates during processing
5. **Review Results** → View generated analysis and recommendations

For detailed usage instructions, see the individual agent documentation.
