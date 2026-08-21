# Document Upload System Documentation

The PALM platform includes a document upload and library system that allows users to upload documents and use them as context in AI conversations. Documents are stored in cloud storage providers and embedded using AI models for semantic search and retrieval.

## Overview

The document upload system provides:

- **Secure Document Processing**: Documents are temporarily uploaded to AWS S3 for processing, then automatically deleted after embeddings are generated
- **AI-Powered Embeddings**: Generate vector embeddings using AWS Bedrock AI models, stored in the database
- **Document Library Management**: Organize and manage your document embeddings through the UI
- **Contextual AI Conversations**: Chat with your documents using AI to extract insights and information

## Architecture

The document upload system uses a **multi-container architecture** for scalability and isolation:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Environment                        │
│                                                                  │
│  ┌─────────────────┐         ┌──────────────────────────────┐  │
│  │   Frontend      │         │  Document Upload Worker      │  │
│  │   Container     │         │  Container (Separate)        │  │
│  │                 │         │                              │  │
│  │  /profile       │         │  • Processes upload queue    │  │
│  │  /document-lib  │         │  • Generates embeddings      │  │
│  └────────┬────────┘         │  • Deletes S3 files          │  │
│           │                  └────────┬─────────────────────┘  │
│           │                           │                         │
│           └───────────┬───────────────┘                         │
│                       │                                         │
│              ┌────────▼─────────┐                               │
│              │  Redis Queue     │                               │
│              │  (BullMQ)        │                               │
│              └──────────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   External Services           │
        │                               │
        │  S3 Storage ──▶ AI Provider  │
        │  (Temporary)    (Bedrock)    │
        └──────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   Database (PostgreSQL)      │
        │   • Embeddings stored        │
        │   • Document metadata        │
        └──────────────────────────────┘
```

### Container Architecture

**Frontend Container**:
- Runs the Next.js application
- Handles user interface and API requests
- Enqueues document uploads to Redis queue
- Does NOT process documents directly

**Document Upload Worker Container** (Separate):
- Dedicated container for document processing
- Processes uploads asynchronously via BullMQ queue
- Generates embeddings using AWS Bedrock
- Automatically deletes files from S3 after processing
- Can scale independently from the frontend
- Shares database and Redis with frontend

**Benefits of Separate Container**:
- **Isolation**: Heavy document processing doesn't affect frontend performance
- **Scalability**: Worker container can be scaled independently
- **Reliability**: Worker failures don't crash the frontend
- **Resource Management**: Separate CPU/memory limits for processing tasks

## Security Model

For security reasons, PALM does not permanently store document files. The workflow is:

1. **Upload**: Document is temporarily uploaded to S3
2. **Process**: AI embeddings are generated from the document content
3. **Store**: Embeddings are stored in the PALM database
4. **Delete**: Original document file is automatically deleted from S3

This ensures that sensitive document content is not retained in cloud storage, while the semantic embeddings remain available for AI conversations.

## Current Providers

Currently, PALM supports document upload through:

- **AWS S3**: Primary document storage provider

## Setup Requirements

To enable document upload functionality, you need to configure:

1. **AWS S3 Bucket**: For document storage
2. **AWS Bedrock AI Provider**: For generating document embeddings
3. **CORS Configuration**: For browser-based uploads
4. **User Group Permissions**: Enable AI provider access for users
5. **System Configuration**: Set default document upload provider

## Quick Start

For detailed setup instructions, see:

- [AWS Setup Guide](./aws-setup/README.md) - Complete AWS S3 and Bedrock configuration

## Usage

Once configured, users can:

1. Navigate to **Profile** → **Document Library**
2. Upload documents (PDF, TXT, DOC, etc.)
3. Documents are automatically processed, embedded, and then securely deleted from S3
4. Reference document embeddings in AI conversations to ask questions and extract insights

## System Configuration

### Setting the Default Document Upload Provider

Admins must configure the default document upload provider:

1. Navigate to **Settings** → **System Configurations**
2. Find the **Document Library** section
3. Select the upload provider (currently AWS S3)
4. Save configuration

**Location**: `features/settings/components/system-configurations/tables/DocumentLibraryDocumentUploadProviderSelectionTable.tsx`

### Document Library UI

Users access the document library through:

**Location**: `features/profile/components/document-library`

## Docker Configuration

### Container Setup

The document upload system requires two containers to be running:

**1. Frontend Container** (`docker-compose.yml`):
```yaml
frontend:
  container_name: frontend
  build:
    context: .
    target: dev
  networks:
    - palm-net
  depends_on:
    - db
    - redis
```

**2. Document Upload Worker Container** (`docker-compose.yml`):
```yaml
document-upload-worker:
  hostname: document-upload-worker
  build:
    context: .
    dockerfile: ./docker/document-upload-worker/Dockerfile
  restart: always
  networks:
    - palm-net
  depends_on:
    - db
    - redis
```

### Worker Container Implementation

**Worker Dockerfile**: `docker/document-upload-worker/Dockerfile`
- Uses Node.js 22 Alpine base image
- Installs all dependencies (including Prisma)
- Runs the worker entry point: `docker/document-upload-worker/worker.js`

**Worker Entry Point**: `docker/document-upload-worker/worker.js`
- Starts the BullMQ document processing worker
- Listens for jobs from the Redis queue
- Handles graceful shutdown on SIGTERM/SIGINT
- Keeps container alive even on errors (for debugging)

**Main Dockerfile**: `Dockerfile` (lines 75-84)
- Contains special COPY commands needed by the worker container
- Copies server, features, types, libs, and docker folders
- These files are required for the worker to process documents

### Starting the Containers

**Development**:
```bash
docker-compose up frontend document-upload-worker
```

**Production**:
Both containers start automatically via docker-compose with appropriate environment variables.

## Technical Details

### AI Provider Requirements

The embeddings feature requires an AWS Bedrock AI provider to be:

1. **Configured**: Set up through Settings → AI Providers
2. **Enabled**: Associated with the user's user group
3. **Accessible**: User must have permission to use the provider

**Provider Implementation**: `features/ai-provider/sources/bedrock.ts`

### Supported Document Types

- PDF (`.pdf`)
- Text files (`.txt`, `.md`, `.html`)
- Microsoft Word (`.docx`)
- Microsoft Excel (`.xlsx`)
- CSV (`.csv`)

## Troubleshooting

### Common Issues

**Upload fails with CORS error:**
- Check S3 bucket CORS configuration
- Verify localhost (development) or production URL is allowed

**Embeddings not generating:**
- Verify Bedrock AI provider is configured
- Check user has access to the AI provider
- Ensure embedding model is available in your AWS region
- **Check worker container logs**: `docker logs document-upload-worker`

**Documents not appearing:**
- Check S3 bucket permissions
- Verify upload provider is set in system configuration
- Check browser console for errors
- **Verify worker container is running**: `docker ps | grep document-upload-worker`

**Worker container not starting:**
- Check Redis is running: `docker ps | grep redis`
- Check database is running: `docker ps | grep db`
- View worker logs: `docker logs document-upload-worker`
- Verify environment variables are correctly configured

**Worker container keeps restarting:**
- Check for errors in worker logs: `docker logs document-upload-worker --tail 100`
- Verify database connection is working
- Ensure Redis is accessible from the worker container
- Check that required files are copied to the container (server, features, libs, docker folders)

## Security Considerations

- **Automatic File Deletion**: Original documents are automatically deleted from S3 after embedding generation
- **No Permanent Storage**: Document files are not retained; only embeddings are stored in the database
- **S3 Bucket Policies**: Configure appropriate access policies for temporary storage
- **CORS Restrictions**: Ensure CORS is configured restrictively (specific origins only)
- **Access Logs**: Monitor S3 access logs for security auditing
