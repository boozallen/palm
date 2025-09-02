# AI Agents System Documentation

The PALM platform includes a sophisticated AI agents system that provides automated analysis capabilities through background job processing. This system is built on **BullMQ** job queues with **Redis** as the critical infrastructure backbone.

## Overview

AI Agents are background services that perform complex, time-intensive analysis tasks using AI models. The system includes two specialized agents that process jobs asynchronously:

### 1. CERTA (Compliance Evaluation, Reporting, and Tracking Agent)
- **Agent Type**: `AiAgentType.CERTA = 1` 
- **Purpose**: Automated website compliance monitoring
- **Core Functionality**:
  - Web crawling using Puppeteer with advanced scraping techniques
  - Policy-based content analysis using AI models
  - Real-time compliance scoring and reporting
  - Multi-policy concurrent processing with partial results

### 2. RADAR (Research Article Discovery and Analysis)  
- **Agent Type**: `AiAgentType.RADAR = 2`
- **Purpose**: Academic research discovery and trend analysis
- **Core Functionality**:
  - Academic paper search across multiple databases
  - AI-powered research trend analysis
  - Category and institution-based filtering
  - Intelligent caching system for performance optimization

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
For production environments, use AWS ElastiCache `docs/ai-agents/elasticache-setup.md`.

## Agent Configuration

### 1. Creating Agents (Admin/System Config)
```typescript
// Agents are created through the settings UI at /settings
// - Navigate to Settings → AI Agents  
// - Click "Create Agent"
// - Select type: CERTA or RADAR
// - Configure access via User Groups
```

### 2. CERTA Policy Configuration
```typescript
// Policies define what to check for compliance
interface AgentCertaPolicy {
  title: string;        // Policy name (e.g., "GDPR Compliance")
  content: string;      // Policy text to analyze against
  requirements: string; // Specific compliance requirements
}

// Multiple policies can be assigned to one CERTA agent
// Each policy is processed concurrently during compliance checks
```

## Agent Usage

### CERTA Compliance Checking
1. **Access**: Navigate to `/ai-agents/certa/[agentId]`
2. **Submit URL**: Enter website URL to analyze
3. **Select Policies**: Choose which compliance policies to check
4. **Monitor Progress**: Real-time updates as policies are processed
5. **Review Results**: Detailed compliance scoring and recommendations

### RADAR Research Analysis  
1. **Access**: Navigate to `/ai-agents/radar/[agentId]`
2. **Configure Search**: Set date ranges, categories, institutions
3. **Submit Query**: System checks for cached results first
4. **Track Progress**: Real-time analysis updates
5. **Review Insights**: AI-generated research trends and analysis






