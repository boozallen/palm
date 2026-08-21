# CERTA Agent - Compliance Evaluation, Reporting, and Tracking

## Overview

The CERTA (Compliance Evaluation, Reporting, and Tracking) Agent is an automated website compliance monitoring system that crawls websites and analyzes them against predefined policies using AI models. It provides real-time compliance scoring and detailed reporting for regulatory and policy adherence.

## What CERTA Does

### ✅ Core Functionality
- **Automated Web Crawling** - Uses Puppeteer with advanced scraping techniques
- **Policy-Based Analysis** - Evaluates content against custom compliance policies
- **Real-time Scoring** - Provides compliance scores and detailed recommendations
- **Multi-policy Processing** - Handles multiple policies concurrently with partial results
- **Background Processing** - Runs as BullMQ jobs with Redis for scalability

### ✅ Compliance Capabilities
- **Website Content Analysis** - Scrapes and analyzes web page content
- **Policy Matching** - Compares site content against defined compliance requirements
- **Risk Assessment** - Identifies compliance gaps and potential violations
- **Detailed Reporting** - Generates comprehensive compliance reports with recommendations

## Architecture

### Data Flow

```
1. User submits website URL + selected policies
   ↓
2. tRPC Route: createComplianceJob
   ↓
3. BullMQ Job Creation in Redis
   ↓
4. Background Worker: Web crawling with Puppeteer
   ↓
5. AI Analysis: Content evaluation against policies
   ↓
6. Results Storage: Redis + Database persistence
   ↓
7. Real-time UI Updates: Progress and results
```

### Key Components

**Backend Infrastructure:**
- `/features/ai-agents/routes/certa/` - tRPC routes for job management
- `/features/ai-agents/workers/certa/` - BullMQ workers for processing
- `/features/ai-agents/dal/certa/` - Data access layer for compliance data
- `/features/ai-agents/types/certa/` - TypeScript interfaces

**Frontend Components:**
- `/pages/ai-agents/certa/[agentId].tsx` - Main CERTA agent interface
- `/features/ai-agents/components/certa/` - UI components for compliance workflow
- `/features/ai-agents/api/certa/` - React hooks for API integration

**Job Processing:**
- Redis-based job queues with BullMQ
- Puppeteer for web scraping and content extraction
- AI model integration for policy analysis

## How It Works

### Policy Configuration

CERTA agents are configured with specific compliance policies that define what to check for:

```typescript
interface AgentCertaPolicy {
  title: string;        // Policy name (e.g., "GDPR Compliance")
  content: string;      // Policy text to analyze against
  requirements: string; // Specific compliance requirements
}
```

**Policy Examples:**
- **GDPR Compliance** - Privacy policy presence, cookie consent, data handling
- **Accessibility Standards** - WCAG compliance, alt text, keyboard navigation
- **Security Policies** - SSL certificates, secure forms, data protection
- **Brand Guidelines** - Logo usage, color schemes, messaging consistency

### Compliance Analysis Process

**Step 1: Web Crawling**
- Puppeteer navigates to target website
- Extracts page content, metadata, and structure
- Captures screenshots for visual analysis
- Follows links for comprehensive site analysis

**Step 2: AI-Powered Analysis**
- Content is analyzed against each assigned policy
- AI models evaluate compliance based on policy requirements
- Scoring algorithm calculates compliance percentage
- Identifies specific violations and areas of concern

**Step 3: Report Generation**
- Detailed compliance report with findings
- Risk assessment and priority recommendations
- Visual indicators for quick status overview
- Actionable items for compliance improvement

**Step 4: Progress Tracking**
- Real-time updates during processing
- Partial results as policies complete
- Final comprehensive report delivery
- Historical tracking for compliance trends

## Agent Configuration

### CERTA Policy Configuration

Policies define what to check for compliance:

```typescript
interface AgentCertaPolicy {
  title: string;        // Policy name (e.g., "GDPR Compliance")
  content: string;      // Policy text to analyze against
  requirements: string; // Specific compliance requirements
}
```

Multiple policies can be assigned to one CERTA agent. Each policy is processed concurrently during compliance checks.

**Policy Examples:**
- **GDPR Compliance** - Privacy policy presence, cookie consent, data handling
- **Accessibility Standards** - WCAG compliance, alt text, keyboard navigation
- **Security Policies** - SSL certificates, secure forms, data protection
- **Brand Guidelines** - Logo usage, color schemes, messaging consistency

### Setting Up CERTA Agents

1. **Navigate to Settings** → AI Agents
2. **Create New Agent** → Select "CERTA" type
3. **Configure Policies** → Add compliance policies to check
4. **Assign User Groups** → Control access to the agent
5. **Save Configuration** → Agent becomes available to authorized users

## Usage

### Running Compliance Checks

1. **Access Agent** → Navigate to `/ai-agents/certa/[agentId]`
2. **Enter Website URL** → Target site for compliance analysis
3. **Select Policies** → Choose which policies to evaluate
4. **Submit Job** → Compliance check begins processing
5. **Monitor Progress** → Real-time updates as analysis proceeds
6. **Review Results** → Detailed compliance report and recommendations

### API Usage

```typescript
// Create a compliance job
import { useCreateComplianceJob } from '@/features/ai-agents/api/certa/compliance';

const { mutate: createJob, isLoading } = useCreateComplianceJob();

createJob({
  agentId: 'agent-uuid',
  websiteUrl: 'https://example.com',
  selectedPolicies: ['policy-1', 'policy-2']
});

// Monitor job progress
import { useComplianceJobStatus } from '@/features/ai-agents/api/certa/status';

const { data: jobStatus } = useComplianceJobStatus(jobId);
```

## Features

### Compliance Monitoring
- ✅ Multi-policy concurrent analysis
- ✅ Real-time progress tracking
- ✅ Detailed compliance scoring
- ✅ Risk prioritization
- ✅ Historical compliance trends

### Reporting Capabilities
- ✅ Comprehensive compliance reports
- ✅ Visual compliance dashboards
- ✅ Exportable results (PDF, CSV)
- ✅ Executive summary views
- ✅ Detailed technical findings

### Integration Features
- ✅ BullMQ job processing
- ✅ Redis-based caching
- ✅ Puppeteer web scraping
- ✅ AI model integration
- ✅ User group access control

## Configuration

### Environment Variables
```bash
# Redis configuration (required for job processing)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=optional_password

# AI provider settings
ANTHROPIC_API_KEY=your_anthropic_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint
```

### Policy Management

Policies are managed through the Settings interface:
- **Title**: Descriptive name for the policy
- **Content**: Full policy text or requirements
- **Requirements**: Specific items to check for compliance

### Access Control

CERTA agents use the PALM user group system:
- Agents are assigned to specific user groups
- Only users in assigned groups can access the agent
- Administrators can modify agent permissions

## Data Storage

### Redis Storage
- Job queue management
- Real-time progress updates
- Temporary result caching
- Session state management

### Database Storage
- Agent configuration
- Policy definitions
- Historical compliance results
- User access logs

## Security Considerations

### Web Scraping Security
- Rate limiting to prevent site overload
- User-agent identification
- Respect for robots.txt
- SSL certificate validation

### Data Privacy
- Temporary storage of scraped content
- Automatic cleanup of sensitive data
- Audit logs for compliance tracking
- Secure transmission of results

## Troubleshooting

### Common Issues

**Job Stuck in Queue**
- Check Redis connection
- Verify worker processes are running
- Review job retry configuration

**Scraping Failures**
- Validate target URL accessibility
- Check for anti-bot protection
- Review Puppeteer configuration

**Policy Analysis Errors**
- Verify AI provider configuration
- Check policy content formatting
- Review API rate limits

### Performance Optimization

- Use Redis clustering for high volume
- Implement job prioritization
- Cache common policy analyses
- Optimize Puppeteer settings

## Future Enhancements

Potential additions:
- [ ] Automated compliance monitoring schedules
- [ ] Email notifications for compliance changes
- [ ] Integration with external compliance tools
- [ ] Custom compliance scoring algorithms
- [ ] Bulk website analysis capabilities
- [ ] Compliance trend analytics
- [ ] API webhooks for compliance events

## Dependencies

- **puppeteer**: ^21.0.0 (web scraping)
- **bullmq**: ^4.0.0 (job processing)
- **redis**: ^4.6.0 (caching and queues)
- **@anthropic-ai/sdk**: AI analysis
- **@mantine/core**: UI components
- **@trpc/react-query**: API layer

## Notes

- CERTA requires Redis infrastructure for job processing
- Web scraping respects standard web etiquette and robots.txt
- AI analysis costs scale with content volume and policy complexity
- Real-time updates require active Redis connection
- Compliance scores are relative to defined policy requirements

## Credits

Built for PALM (Prompt & Agent Library Marketplace) system
Compliance analysis powered by advanced AI models
Web scraping via Puppeteer automation framework