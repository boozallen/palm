# AWS Setup for Document Upload

This guide provides step-by-step instructions for configuring AWS S3 and AWS Bedrock to support the PALM document upload and embeddings system.

## Prerequisites

Before setting up document upload, ensure you have:

- AWS Account with appropriate permissions to create S3 buckets
- AWS Bedrock provider already configured in PALM (see main README for Bedrock setup)
- Your PALM application URL (for production) or localhost URL (for development)

## Overview

The document upload system uses a **separate container architecture**:
- **Frontend Container**: Handles user uploads and enqueues processing jobs
- **Document Upload Worker Container**: Processes documents asynchronously in a dedicated container

This architecture requires:

1. **S3 Bucket**: For temporary document storage during processing
2. **S3 CORS Configuration**: To allow browser-based uploads from your PALM application
3. **AWS Bedrock Provider**: Already configured for generating document embeddings
4. **Redis Queue**: For communication between frontend and worker containers (automatically configured)

## Setup Steps

### 1. Create an S3 Bucket

1. Log into your AWS Console
2. Navigate to **S3** service
3. Click **Create bucket**
4. Configure bucket settings:
   - **Bucket name**: Choose a unique name (e.g., `palm-documents-prod`)
   - **Region**: Select your preferred AWS region
   - **Block Public Access settings**: Keep public access blocked (recommended)
   - **Bucket Versioning**: Enable if desired
   - **Encryption**: Enable server-side encryption (recommended)
5. Click **Create bucket**

### 2. Configure S3 Bucket CORS

CORS (Cross-Origin Resource Sharing) must be configured to allow your PALM application to upload documents directly from the browser.

1. Navigate to your S3 bucket
2. Go to the **Permissions** tab
3. Scroll to **Cross-origin resource sharing (CORS)**
4. Click **Edit**
5. Add the following CORS configuration:

**For Development:**
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**For Production:**
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**For Both Development and Production:**
```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

6. Click **Save changes**

### 3. Configure S3 Bucket Access

Ensure your AWS credentials (configured for Bedrock) have S3 access. Add the following permissions to your existing IAM policy:

```json
{
    "Effect": "Allow",
    "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
    ],
    "Resource": [
        "arn:aws:s3:::your-bucket-name/*",
        "arn:aws:s3:::your-bucket-name"
    ]
}
```

### 4. Verify AWS Bedrock Configuration

Document embeddings require an AWS Bedrock AI provider to be already configured in PALM (see main README Bedrock section for setup instructions).

**Verify Bedrock Configuration**:

1. **Confirm Provider Exists**:
   - Log into PALM as an admin
   - Navigate to **Settings** → **AI Providers**
   - Verify a Bedrock provider is configured with at least one chat model

2. **Enable Provider for User Groups**:
   - Navigate to **Settings** → **User Groups**
   - Select the user group(s) that should have document upload access
   - Associate the Bedrock AI provider with the group
   - Save changes

**Provider Implementation**: `features/ai-provider/sources/bedrock.ts`

### 5. Configure Document Upload Provider in PALM

Set the default document upload provider:

1. Log into PALM as an admin
2. Navigate to **Settings** → **System Configurations**
3. Find **Document Library** section
4. Select **AWS S3** as the document upload provider
5. Save configuration

**Configuration Location**: `features/settings/components/system-configurations/tables/DocumentLibraryDocumentUploadProviderSelectionTable.tsx`

## Verification

### Test the Setup

1. **Verify worker container is running**:
   ```bash
   docker ps | grep document-upload-worker
   ```

2. Log into PALM as a user with the configured user group
3. Navigate to **Profile** → **Document Library**
4. Click **Upload Document**
5. Select one or more test files (PDF, TXT, etc.)
6. Upload should complete successfully
7. **Monitor worker container logs**:
   ```bash
   docker logs -f document-upload-worker
   ```
8. Verify embeddings are generated (check worker logs)
9. Confirm document files were deleted from S3 bucket after processing

### Common Issues

**CORS Error on Upload:**
- Verify CORS configuration includes your application URL
- Check that AllowedOrigins matches exactly (including protocol and port)
- Clear browser cache and try again

**Access Denied Error:**
- Verify your AWS credentials (configured for Bedrock) have S3 permissions
- Check IAM policy includes the S3 permissions listed above
- Ensure bucket name in environment variables matches actual bucket

**Embeddings Not Generating:**
- Verify Bedrock AI provider is configured
- Check user has access to the Bedrock provider via user group
- Ensure embedding model is available in your AWS region
- **Check worker container logs**: `docker logs document-upload-worker`
- Verify worker container has access to AWS credentials (shared via environment variables)

**Document Not Appearing in Library:**
- Verify embeddings were generated (check application logs)
- Verify document upload provider is set in system configuration
- Check browser console for JavaScript errors
- Note: Original document files are not stored in S3 permanently

## Security Best Practices

1. **Automatic Deletion**: Documents are automatically deleted from S3 after embedding generation (built-in security feature)
2. **Restrict CORS Origins**: Only allow your specific application URLs, not wildcards
3. **Enable S3 Encryption**: Use server-side encryption for temporary document storage
4. **Implement Bucket Policies**: Add additional bucket-level access restrictions
5. **Enable S3 Access Logging**: Track all access to documents for security auditing
6. **Monitor Costs**: Set up AWS billing alerts for S3 usage

## Cost Optimization

Since documents are automatically deleted after processing, S3 storage costs should be minimal. Additional optimizations:

- Monitor S3 usage to ensure automatic deletion is working correctly
- Use S3 Storage Lens for usage analytics
- Set up billing alerts for unexpected storage costs (may indicate deletion failures)

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [S3 CORS Configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
