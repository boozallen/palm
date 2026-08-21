# AWS ElastiCache (Redis) Setup for AI Agents

This guide provides step-by-step instructions for setting up AWS ElastiCache to support the PALM AI agents system in production environments.

## Why ElastiCache is Required

The PALM application uses AWS ElastiCache (Redis/Valkey) as the backend for our job queue and worker system. This enables:

- **Job Queue Management**: Storing and processing background tasks (AI model inference, web crawling, research analysis)
- **Worker Coordination**: Managing multiple worker processes that consume jobs from the queue
- **Task State Tracking**: Maintaining job status, progress, and results in real-time
- **Performance Caching**: Storing expensive operation results for faster response times
- **Scalability**: Supporting horizontal scaling with multiple worker instances

**Without ElastiCache, the AI agents system cannot process background jobs or coordinate worker tasks effectively.**

## Prerequisites

Before setting up ElastiCache, ensure you have:

- AWS Account access with appropriate permissions
- VPC and subnets configured for your application
- Security groups properly configured
- Knowledge of your application's network requirements

## Setup Steps

### 1. Access AWS ElastiCache Console

1. Log into your AWS Console
2. Navigate to ElastiCache: `https://console.aws.amazon.com/elasticache/`
3. Ensure you're in the correct AWS region for your application

### 2. Create New Cluster

1. Click **"Create cluster"**
2. Select **"Redis"** or **"Valkey"** (Valkey is Redis-compatible and often preferred)
3. Choose **"Design your own cache"** (not Easy create for better control)

### 3. Cluster Configuration

#### Basic Settings:
- **Cluster mode**: Select **"Disabled"** (simpler setup, adequate for most use cases)
- **Cluster name**: `palm-redis-cluster` (or your preferred naming convention)
- **Description**: `Redis cache for PALM AI agents system`
- **Location**: **AWS Cloud**
- **Multi-AZ**: **Enabled** (for production resilience)
- **Auto-failover**: **Enabled**

#### Engine Settings:
- **Engine version**: Latest stable (8.0+ recommended)
- **Port**: `6379` (standard Redis port)
- **Parameter group**: `default.redis8.0` or latest version
- **Node type**: 
  - **Development**: `cache.t4g.micro` or `cache.t4g.small`
  - **Production**: `cache.r7g.large` or larger based on workload
- **Number of replicas**: 
  - **Development**: 0-1
  - **Production**: 1-2 for high availability

### 4. Connectivity Configuration

#### Network Settings:
- **Network type**: **IPv4**
- **Subnet group**: Select existing subnet group or create new one
  - Subnets should be in private subnets where your application runs
  - Ensure subnets span multiple AZs for high availability

#### Security Groups:
Configure security groups to allow access from your application:

```bash
# Allow Redis traffic from application security group
Type: Custom TCP
Port: 6379
Source: sg-xxxxxxxxx (your security group)
```
### 6. Review and Create

1. **Review all settings** carefully
2. **Estimate costs** using AWS pricing calculator
3. Click **"Create cluster"**
4. **Wait for cluster to become available** (usually 10-15 minutes)

## Post-Creation Configuration

### 1. Get Connection Details

Once the cluster is available:

1. Go to your cluster in the ElastiCache console
2. Note the **Primary Endpoint** (e.g., `master.palm-redis.xxxxx.use1.cache.amazonaws.com:6379`)

### 2. Configure Application Environment

Update your application's environment variables:



```bash
# Redis connection settings
REDIS_HOST=master.palm-redis.xxxxx.use1.cache.amazonaws.com
REDIS_PORT=6379
```

### 3. Test Connection

Test the Redis connection:

```bash
# Using redis-cli 
redis-cli -h master.palm-redis.xxxxx.use1.cache.amazonaws.com -p 6379 -a your-auth-token ping

# Should return: PONG
```
