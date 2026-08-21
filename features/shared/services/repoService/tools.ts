import type { McpToolDefinition } from '../mcpTools';
import { callRepoList } from './repoList';
import { callRepoSearch } from './searchContent';
import { callRepoReadFile } from './readFile';
import { callRepoListFiles } from './listFiles';
import { callRepoListCommands } from './listCommands';
import { callRepoRunCommand } from './loadCommand';

export const REPO_SERVICE_TOOLS: McpToolDefinition[] = [
  {
    name: 'skill_repo_list',
    description:
      'List all available skill repositories and their descriptions. ' +
      'Call this first to discover which repos are available and pick the right one ' +
      'for the user\'s question.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'skill_repo_search',
    description:
      'Search across all markdown files in a skill repository using keyword/regex matching. ' +
      'Returns matching lines with context. Use this for factual lookups about topics ' +
      'covered by the repo.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_id: {
          type: 'string',
          description: 'The repo ID (from skill_repo_list)',
        },
        query: {
          type: 'string',
          description: 'Search query (keyword or regex, case-insensitive)',
        },
        path: {
          type: 'string',
          description: 'Optional subdirectory to limit search',
        },
      },
      required: ['repo_id', 'query'],
    },
  },
  {
    name: 'skill_repo_read_file',
    description:
      'Read a markdown file from a skill repository. ' +
      'Use this to look up specific files when you need the full content.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_id: {
          type: 'string',
          description: 'The repo ID (from skill_repo_list)',
        },
        path: {
          type: 'string',
          description: 'Relative path from repo root (e.g., t2-content/approach-sdd.md)',
        },
      },
      required: ['repo_id', 'path'],
    },
  },
  {
    name: 'skill_repo_list_files',
    description:
      'List markdown files in a skill repository. ' +
      'Use this to explore the repo structure when deciding which file to read.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_id: {
          type: 'string',
          description: 'The repo ID (from skill_repo_list)',
        },
        path: {
          type: 'string',
          description: 'Optional subdirectory to list',
        },
      },
      required: ['repo_id'],
    },
  },
  {
    name: 'skill_repo_list_commands',
    description:
      'List the available slash commands in a skill repository. ' +
      'Call this when the user asks to draft, generate, outline, or produce an artifact ' +
      'related to the repo\'s domain.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_id: {
          type: 'string',
          description: 'The repo ID (from skill_repo_list)',
        },
      },
      required: ['repo_id'],
    },
  },
  {
    name: 'skill_repo_run_command',
    description:
      'Load a skill repository command\'s instructions and pre-bundled source files. ' +
      'Returns the command methodology and relevant source content. ' +
      'Follow the instructions to produce the requested artifact. ' +
      'Use skill_repo_read_file and skill_repo_search if you need additional files.',
    inputSchema: {
      type: 'object',
      properties: {
        repo_id: {
          type: 'string',
          description: 'The repo ID (from skill_repo_list)',
        },
        command: {
          type: 'string',
          description: 'Command name (from skill_repo_list_commands)',
        },
        user_input: {
          type: 'string',
          description: 'The user\'s specific request or input text',
        },
      },
      required: ['repo_id', 'command'],
    },
  },
];

export const REPO_SERVICE_HANDLERS: Record<string, (args: Record<string, string>) => Promise<unknown>> = {
  skill_repo_list: callRepoList,
  skill_repo_search: callRepoSearch,
  skill_repo_read_file: callRepoReadFile,
  skill_repo_list_files: callRepoListFiles,
  skill_repo_list_commands: callRepoListCommands,
  skill_repo_run_command: callRepoRunCommand,
};
