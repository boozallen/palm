import type { NextApiRequest, NextApiResponse } from 'next';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import logger from '@/server/logger';
import { TOOLS, TOOL_HANDLERS } from '@/features/shared/services/mcpTools';
import { withErrorReporting } from '@/server/withErrorReporting';

function buildMcpServer(): Server {
  const server = new Server(
    { name: 'palm-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    logger.info('[MCP-TOOL-CALL]', {
      tool: name,
      args: Object.keys(args).length > 0 ? args : '(no args)',
    });

    if (!(name in TOOL_HANDLERS)) {
      logger.error('[ MCP-TOOL-ERROR] Unknown tool', { tool: name });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      const result = await TOOL_HANDLERS[name]!(args as Record<string, string>);
      logger.info('[MCP-TOOL-SUCCESS]', {
        tool: name,
        resultSize: JSON.stringify(result).length,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      logger.error('[MCP-TOOL-FAILED]', { tool: name, error: (error as Error).message });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
        isError: true,
      };
    }
  });

  return server;
}

// One transport per SSE connection — keyed by sessionId so POST messages route correctly.
// Stored on globalThis so Next.js hot-reloads don't wipe in-flight sessions.
const g = globalThis as typeof globalThis & { __mcpTransports?: Map<string, SSEServerTransport> };
if (!g.__mcpTransports) {
  g.__mcpTransports = new Map();
}
const transports: Map<string, SSEServerTransport> = g.__mcpTransports;

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    res.status(500).json({ error: 'Server misconfiguration' });
    return;
  }
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${internalApiKey}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method === 'GET') {
    const transport = new SSEServerTransport('/api/mcp/sse', res);
    const server = buildMcpServer();
    transports.set(transport.sessionId, transport);

    res.on('close', () => {
      transports.delete(transport.sessionId);
    });

    await server.connect(transport);
    return;
  }

  if (req.method === 'POST') {
    const sessionId = req.query['sessionId'] as string;
    const transport = transports.get(sessionId);

    if (!transport) {
      res.status(400).json({ error: 'No active SSE session for this sessionId' });
      return;
    }

    await transport.handlePostMessage(req, res);
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withErrorReporting(handler);

export const config = {
  api: {
    bodyParser: false,
  },
};
