# Configuring Credentials Authentication

The credentials authentication provider enables traditional email and password-based login for PALM. This authentication method stores user credentials directly in the PALM database and uses bcrypt for secure password hashing.

## ENVIRONMENT: Local, Production

The credentials authentication provider is suitable for both local development and production environments where you need direct control over user authentication without external identity providers.

## Setting Up Credentials Authentication

### 1. Enable Credentials Provider

Add `credentials` to your `ENABLED_NEXTAUTH_PROVIDERS` environment variable in your `.env.local` file:

```bash
# Enable credentials authentication along with other providers
ENABLED_NEXTAUTH_PROVIDERS=credentials

# Or combine with other providers
ENABLED_NEXTAUTH_PROVIDERS=azure-ad,keycloak,credentials
```

### 2. Required Environment Variables

The credentials provider doesn't require additional environment variables beyond the standard NextAuth configuration:

```bash
# Required for NextAuth
NEXTAUTH_SECRET= # Generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
```

### 3. Database Requirements

The credentials provider requires users to have a `hashedPassword` field in the database. The authentication system will:

- Look up users by email address
- Verify the provided password against the stored bcrypt hash
- Return user information if authentication succeeds

## How Credentials Authentication Works

### User Authentication Flow

1. **User Input**: User enters email and password on the login form
2. **Database Lookup**: System searches for a user with the provided email address
3. **Password Verification**: Compares the provided password with the stored bcrypt hash
4. **Session Creation**: If authentication succeeds, creates a user session

### Password Security

- Passwords are hashed using bcrypt before storage
- Plain text passwords are never stored in the database
- Password comparison uses secure bcrypt comparison methods

### User Role Assignment

When a user authenticates with credentials:
- The user's role is retrieved directly from the database (`user.role`)
- No role inheritance from external providers is applied
- Roles are validated against the defined UserRole types

## User Management

### Creating Users with Credentials

To create a new user with Admin role for credentials authentication, use the following command:

```bash
docker exec -it frontend yarn ts-node -r tsconfig-paths/register prisma/scripts/admin.ts <email address> <password>
```

This command will:
- Create a new user with the specified email and password
- Automatically hash the password using bcrypt
- Assign the Admin role to the user
- Make the user available for credentials-based login

### Password Requirements

The system doesn't enforce specific password requirements at the authentication level, but you should implement appropriate password policies in your user creation workflows.

## Security Considerations

### Production Deployment

When deploying credentials authentication in production:

1. **HTTPS Required**: Always use HTTPS to protect credentials in transit
2. **Secure Cookies**: Enable secure cookies by setting `ENABLE_SECURE_COOKIES=true`
3. **Strong NextAuth Secret**: Use a cryptographically secure NEXTAUTH_SECRET
4. **Password Policies**: Implement strong password requirements in user registration

### Example Production Configuration

```bash
# Production settings
NEXTAUTH_URL=https://your-domain.com
ENABLE_SECURE_COOKIES=true
NEXTAUTH_SECRET=your-very-secure-randomly-generated-secret
ENABLED_NEXTAUTH_PROVIDERS=credentials
```

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify the user exists in the database with the correct email
- Ensure the user has a `hashedPassword` field
- Check that the password was properly hashed with bcrypt

**User Not Found**
- Email addresses are case-sensitive in the database lookup
- Ensure the user record exists and is properly configured

**Session Issues**
- Verify NEXTAUTH_SECRET is set and consistent
- Check NEXTAUTH_URL matches your deployment URL

### Logging

The authentication system provides detailed logging for troubleshooting:
- Failed login attempts are logged with user email (for security analysis)
- Missing password hashes are logged as warnings
- Database errors during authentication are logged as errors

## Combining with Other Providers

The credentials provider can be used alongside other authentication methods:

```bash
# Multiple authentication providers
ENABLED_NEXTAUTH_PROVIDERS=azure-ad,keycloak,credentials
```

This allows users to choose their preferred authentication method from the login page.
