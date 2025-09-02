# Prompt & Agent Library Marketplace (PALM)

## Overview

### Purpose of PALM

PALM (Prompt & Agent Library Marketplace) is Booz Allen’s enterprise-ready platform that connects users to a wide range of large language models (LLMs) and data sources through a unified, extensible interface. Unlike expensive, proprietary AI chat solutions, PALM is model-agnostic, cost-efficient, and designed to scale across teams and use cases.

With PALM, organizations can:
- Rapidly onboard user groups and assign access to specific models and data sources
- Enable secure, AI-powered chat and prompt workflows with full traceability
- Build mission specific AI Agents that utilize user group approved resources
- Customize and extend capabilities without being locked into a single vendor

Administrators gain fine-grained control over:
- AI provider integrations (e.g., Bedrock, Azure OpenAI, Gemini)
- Knowledge base connections for real-time, citation-backed responses
- Usage monitoring and role-based access

PALM empowers teams to safely and efficiently harness generative AI without the licensing constraints, vendor lock-in, or high costs of closed platforms.

### Tech Stack

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app). The tech stack used is delinated in the list below:

- Next.js (framework)
- Typescript (language)
- tRPC (typesafe API layer)
- Docker (deployment)
- PostgreSQL (database)
- Prisma (ORM)
- Mantine (UI component library)
- Yarn & npm (package manager)
- Kubernetes via Amazon EKS (production deployment)
- Helm (Kubernetes management)

### Release Management

Please see our [release-management.md](docs/release-management.md) for information on our release process and schedule.

## Guidance for Developers

See [docs/getting-started/index.md](docs/getting-started/index.md) for how to get started developing.

### How to Contribute

Please read through our [CONTRIBUTING.md](CONTRIBUTING.md) for instructions if you wish to contribute to PALM.

### Feature Flags

New features typically need more than one PR to be completed - the work is done incrementally. This means the feature in question may not be complete even though the code has been merged. Therefore, we need some way to keep unfinished work from appearing in our production environment. We do this by using feature flags. To add and use a feature flag:

1. Add the feature flag to:
    - [.env.local.sample](.env.local.sample) (and your .env.local)
    - [libs\featureFlags.ts](libs\featureFlags.ts)
2. From there, use conditionals to prevent/allow access based on the value of the flag:
    - The frontend uses `useGetFeatureFlag()` to get the value.
    - The backend uses `isFeatureOn()` to get the value.
3. In order to see your changes under a feature flag in your local development environment, be sure to turn the flag on by setting its value in your .env.local to `true`.

### Error Handling

Our approach to error handling is designed to ensure security and low coupling between architectural layers. Here’s a summary of the error flow from their origin in the backend to their display in the frontend:

#### Data Access Layer (DAL)

- Database interactions are wrapped in try/catch blocks to catch and handle unexpected errors.
- Caught errors should be re-thrown with sanitized messages that do not reveal sensitive information (e.g., variable names, PII).
- Use a server-side logger (e.g., Winston) to log detailed error messages for debugging and troubleshooting.

   ```javascript
   try {
       // database operation to get user role, then return the role
   } catch (error) {
       logger.error('Error getting user role', error);
       throw new Error('Error getting user role');
   }
   ```

#### Route Layer

- Errors from the DAL should propagate through without being caught.
- New errors in the route layer should relate to route-specific issues (e.g., insufficient privileges). Note that we use predefined, custom-wrapped [route errors](features\shared\errors\routeErrors.ts).
- Route code does not catch unexpected errors from the route library, assuming the library sanitizes its error messages.

   ```javascript
   if (userRole !== UserRole.Admin) {
       throw Forbidden('You do not have permission to access this resource');
   }
   // call DAL to get result, then return the result
   ```

#### Routing Middleware

- Convert errors to a consistent format for the frontend. For example, use middleware to convert plain Errors from the DAL into TRPCErrors when using tRPC.

#### Frontend

- Display errors from the backend to the user, such as using toast notifications for form submission errors.
- Avoid including console logs in component files to prevent sensitive information from appearing in the user’s browser console.

   ```javascript
   try {
       // await result from API call
   } catch (error) {
       notifications.show({
           title: 'Submission Failed',
           message: error?.message || 'An unexpected error occurred.',
           variant: 'failed_operation',
       });
   }
   ```

By following these guidelines, we ensure that errors are handled securely and consistently across the application.

### Authentication

PALM leverages [NextAuth.js](https://next-auth.js.org/) for seamless and secure user authentication. Presently, it supports two authentication providers:

  1. [AzureAD](https://next-auth.js.org/providers/azure-ad) - [Configuration Details](docs/auth/AzureAD.md)
  2. [Keycloak](https://next-auth.js.org/providers/keycloak) - [Configuration Details](docs/auth/Keycloak.md)
  
Activation of these providers is managed through the `ENABLED_NEXTAUTH_PROVIDERS` environment variable. To enable both Keycloak and AzureAD, for instance, you would set this variable as follows:

```bash
ENABLED_NEXTAUTH_PROVIDERS=azure-ad,keycloak
```

### Admin Accounts

To update an existing user's role to Admin, run the following command:

```bash
docker exec -it frontend yarn ts-node -r tsconfig-paths/register prisma/scripts/admin.ts <email address>
```

To create a new user with the role Admin, run the following command:

```bash
docker exec -it frontend yarn ts-node -r tsconfig-paths/register prisma/scripts/admin.ts <email address> <password>
```

### Inheriting User Roles from OAuth provider

PALM leverages environment variables to handle role inheritance via an OAuth provider. The `INHERITED_OAUTH_ROLE_PATH` environment variable instructs PALM where to look for the role within the OAuth profile object that is returned by your OAuth provider. If the role is contained in an array, provide the correct path needed to reach the array; PALM will search an array for the first element in the array that is a valid `UserRole` so indices are not needed. For example, if the OAuth profile object has this shape

```json
{
  "OAuthProfile": {
    "access": {
      "palm": {
        "roles": {
          "role": [
            "Admin"
          ]
        }
      }
    }
  }
}
```

Then the correct value for `INHERITED_OAUTH_ROLE_PATH` is `access.palm.roles.role`. Similarly, if the OAuth profile object has this shape

```json
{
  "OAuthProfile": {
    "role": "Admin"
  }
}
```

Then the correct value for `INHERITED_OAUTH_ROLE_PATH` is simply `role`.

**Note:** If `INHERITED_OAUTH_ROLE_PATH` is not set, then role inheritance from an OAuth provider is disabled. Similarly, if `INHERITED_OAUTH_ROLE_PATH` is invalid or if the role returned by the OAuth provider is not a valid `UserRole`, then PALM defaults the user's role to the value set in that user's database record (defaults to `User`).

Refer to the "Inheriting Session User Roles" section within the specific OAuth provider's configuration steps to set up roles.

### Knowledge Base Providers

PALM provides functionality that allows users to efficiently retrieve relevant contextual data from external knowledge bases.

#### Bedrock

To connect PALM with AWS Bedrock, the recommended approach is for an admin to configure the Knowledge Base (KB) provider settings. Here are the steps for the admin to set this up:

1. Go to **Settings**.
2. Select **Knowledge Base Providers**.
3. Click the **+** icon next to **Knowledge Base Providers**.
4. Choose **Bedrock** as the provider.
5. Then fill in the following fields:

- **Access Key ID**: The AWS access key ID.
- **Secret Access Key**: The AWS secret access key.
- **Session Token**: The session token for authentication.
- **Region**: The AWS region where the Bedrock resources are located.

By completing these fields, the KB provider will be fully configured to connect with AWS Bedrock.

**Note**: If the KB provider configuration fields are left empty, PALM will automatically fall back to the following environment variables to establish the connection:

- `AWS_ACCESS_KEY_ID`: Your AWS access key ID.
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret access key.
- `AWS_SESSION_TOKEN`: The session token.
- `AWS_REGION`: The AWS region where your Bedrock resources are deployed.

Be sure that these environment variables are correctly populated, as PALM will use them to connect to AWS Bedrock if no admin configuration is provided.

#### Testing With Local Knowledge Bases

The `kb` Docker container exists for testing PALM features that interact with or depend on Knowledge Base Provider-related functionality locally.

First, set a value for the `LOCAL_KB_API_KEY` environment variable, restart the `frontend` container, and start the `kb` service by running the following command:

```bash
docker compose --profile kb up -d
```

Then complete these configuration steps within the application:

1. Go to **Settings**.
2. Select **Knowledge Base Providers**.
3. Click the **+** icon next to **Knowledge Base Providers**.
4. Choose **PALM** as the provider.
5. Fill in the all necessary fields and use the following config values:

    - **API Endpoint**: `http://kb:5000`
    - **API Key**: <LOCAL_KB_API_KEY>

6. Add a knowledge base to that provider, and set the `External ID` field to `my_knowledge_base`
7. Interact with that provider in the chat interface

### Deployment

#### Kubernetes

The PALM application can be deployed to a Kubernetes cluster using Helm. To understand how to populate these Helm charts, refer to the example files:

- `/deployment/examples/kubernetes/deployment.yaml` describes the deployment configuration for the application. It specifies the number of replicas, the image to be used, ports to expose, environment variables (derived from `.env.local.sample`), and volume mounts. It also includes configuration for image pull secrets and init containers. This file is used by Helm to deploy the application to a Kubernetes cluster.

- `/deployment/examples/kubernetes/values.yaml` contains the configurable values for the deployment. It includes values for the image name, tag, host, port, environment variables, and other configuration options. These values can be customized based on the specific deployment environment.

### Architectural Decisions are logged

Under the `/docs` directory is `/adl`, an Architectural Decision Log, directory. We will record all decisions here for things such as languages used, infrstructure dependencies used, methodologies used and so forth for future reading.

### Security and SBOM

This project maintains a **Software Bill of Materials (SBOM)** to transparently track and manage software dependencies, helping proactively address security vulnerabilities.

- [View and generate SBOM](bom/README.md)
