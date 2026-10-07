# Changelog 

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## PALM v1.4.0 - 2026-10-07

### Added

- Context Studio - Agents tab - list proposals supported by PRISM and ODRAM
- Settings - configure a fast AI model for lightweight internal agent operations such as tool planning and routing
- Chat - answer questions about prior conversations with memory retrieval tools and per-message conversation citations, with click-through to the cited message
- User Groups - search for a user to filter the groups they belong to
- Chat & Workflows - edit artifacts in-app with version history
- Audit user group resource access grants
- Audit Record - chat submissions
- Context Studio - Conversations tab - add tools fired pie chart
- Chat - classify conversation summaries by use case
- Context Studio - add a Value tab reporting adoption, work products put to work, time in tool, cost per work product by team, and spend broken down by use case category
- Settings - Add error records (pt 2: additional sources)
- Settings - add Error Records (pt 1: tracking tRPC errors to start)
- Chat - edit inline artifacts via chat instruction instead of full regeneration
- AI Agents - PULSE - derive structured values from every row of a free-text survey using a user-defined column and prompt matrix
- Audit Records - cleanup loose ends
- Audit Records - AI/KB/agent provider config CRUD, chat message edits, reshare events
- UI - refine spacing, borders, and input styling
- Document Library - chunks carry their section path and page range, shown beneath document citations in chat
- Settings - add user group max budget and member cost tracking
- User Groups - add monthly spend tracking and token counts
- Context Studio - dive into a Value tab category for its themes, chats, people and work products
- Artifacts - handle empty binary content in download endpoint
- Chat - restore follow-up question phrasing instructions
- PULSE - three-page interactive results dashboard
- Navigation - add collapsible Prompt Tools nav group
- Chat - add message feedback (thumbs up/down)

### Changed

- Logging - move high-volume info and debug log lines to quieter levels
- Agents - overhaul pptx generation
- Settings - hyperlink breadcrumb trail segments to their parent tab
- Context Studio - stop itemizing unattributed spend as a Value tab category
- User Group attribution - remaining gaps and feature flag removal
- Chat - show artifact diff inline, fix multi-edit misattribution
- Prompt Playground - dedicated worker service
- Prompt Generator - add dedicated worker service to accommodate modern LLM models (longer timeouts)
- Prompt Generator & Prompt Playground - run workers in-process instead of dedicated containers
- Chat - show model/agent, message count, and overlapping artifact icons on recent chat rows
- Docling service - install CPU-only torch so the image drops from 13 GB to 5 GB and the registry push no longer times out
- PULSE - upload output columns as a prompt matrix spreadsheet
- PULSE - scope each output column to its source columns and chart any column whose answers repeat
- Document uploads - increase docling concurrency to 2, pin PyTorch threads, and align BullMQ worker concurrency to eliminate 503 thundering herd
- PULSE - split run status from results and add a results dashboard, executive summary, and slides covering every survey column

### Deprecated

### Removed

- Chat - remove the query-scope selector and snapshot the graph for every graph-mode question

### Fixed

- Auth - fix Azure AD scope and NextAuth debug logging actually printing in deployed debug-level environments
- PULSE - attribute test-row runs to the user's group
- Document uploads - skip OCR for text-based PDFs, fix undici headersTimeout killing long conversions, fix image upload crash, validate file types on drag-and-drop
- PULSE - analyze every respondent row, not only rows that answered the matrix's source columns
- Chat - small UI tweaks
- Chat - restore show recent chats in empty chat state (accidentally removed)
- Context Studio - fix user group filter loading state
- Context Studio - attribute the Value tab's By-team breakdown to the group each action was actually performed under, instead of every group its owner belongs to
- Chat - classify a conversation's use case after the assistant has replied
- Chat - scroll behavior fix
- Document upload - Docling parse service (behind the admin test page): citation offsets are now exact UTF-16 positions into the stored document text, converters are built once at startup, the service answers 503 with Retry-After when all converters are busy instead of queueing, the caller enforces a fixed parse timeout, and the image bakes in its models and tokenizer with no runtime TLS bypass
- Context Studio - enforce user-scoped access for non-Admins
- User Groups - stop tracking and counting AI provider usage with no group attributed, and soft-delete groups so deletion doesn't strip historical usage attribution
- Usage Attribution - pass userGroupId for AI spend tracking
- AI Provider Usage - require a user group when recording usage, and hide unattributed usage from spend views
- Context Studio - align user-group usage filtering across queries
- Chat - align sources sidebar controls and keep the scrollbar off the checkboxes
- Tests - drive Mantine Select/MultiSelect dropdowns with mousedown instead of userEvent to fix CI timeouts and cut suite time
- Tests - migrate remaining Mantine Select tests from userEvent to fireEvent
- Chat - restore clicking a citation's View Source button to scroll to and highlight the cited text in the sources sidebar
- Profile - exclude soft-deleted user groups from a member's share-target list

### Security

## PALM v1.3.0 - 2026-08-21

### Added

- Chat - Graph-Enhanced RAG with Neo4j knowledge graph integration (entity extraction, graph building, citation enrichment)
- Profile - add 'general' tab and add buttons to reset cookie settings (PII warning, Regenerate chat response)
- Adding separate document upload worker container
- Chat - assistant messages - add support for table rendering
- Chat - artifacts - support .docx file downloads
- Chat - artifacts - support .xlsx file downloads
- Chat - drag+drop images when LLM model supports it
- Document Library - add support for mp3, mp4a and wav files
- Chat - preselect model when starting chat
- Labor Category (LCAT) agent
- File upload - store plain text in db
- Persist menubar toggle selection
- Chat - NotebookLM design updates
- Agents - LCAT - add LaborCategory table to db schema
- Document Library - add HNSW vector index on Embedding table for faster RAG similarity search (up to 30x speedup)
- Document Library - add benchmark script for vector index performance testing
- Chat - Add RAG mode toggle
- Chat - add a worker for chat submissions
- Agents - LCAT - Create separate comparison components for SOC vs LCAT Salary.com data
- AI Agents - LCAT - map the matchRating to 'human readable' string
- Graph Database - Initial Neo4j Integration
- Agents - RCAST - schema addition of new tables for RCAST agent, add agent scaffolding, Implement LLM-based SOC code mapping, add existing BLS, DOL & Salary.com data sources, add file export
- Chat - citations - add start and end position migration
- Admin - user groups - toggle access to graph database
- App-wide - minor updates
- Graph Database - Query Router with text2cypher, one-hop expansion, and dynamic similarity thresholds
- Chat - sources - ability to delete failed file upload
- Document Library - Adding graph node cleanup to source deletion
- Agents - SWEAR - initial implementation of SWEAR agent
- Settings - General - Set default knowledge graph model
- Document Library - share sources with user group members
- Graph Visualization - Enhanced chat and settings page graphs with anchor mode, expand/collapse/isolate, View Source, node spacing controls, and strict filtering
- Graph Visualization - Error boundary for graceful crash recovery and performance optimization with COUNT queries
- Design Cleanup
- Document Library - limit document upload to 50 (UI)
- Prompt Library - add analytics for shares + chatted with's
- Workflows - enable access by User Group
- Workflows - initial workflow rollout
- Workflows - add localStorage 'draft' stage management
- Workflows - deletion endpoint
- Adding layout param to workflow
- Workflows - fix document upload processing issues
- Workflows - Report Generator - consolidate types
- Document Library - add support for powerpoint files
- Update workflow edges to use smoothstep curves by default
- Workflows - add prompt library selector to prompt primitive
- Workflows - context management parent/child
- Graph - Batch Neo4j graph node deletion to prevent memory exhaustion
- Graph - Batch entity and concept embedding during graph build
- Workflows - remove prompt from workflow definition and store in Prompt table
- Share workflow
- Artifacts - (chat, workflows) - support .pptx generation (no preview)
- Workflows - Prompt primitive - add configuration parameters for models (temperature, etc...)
- Generate workflow
- AI Agents - PRISM - initial implementation of Proposal Requirements Inspection and Scoring Module agent
- AI Agents - PRISM - resume in-progress job on page loading
- Workflows - simple UI view
- Workflows - ability to view HTML in its own page
- AI Agents - MARGIN agent
- Workflows - ability to pause/cancel workflow
- AI Agents - ODRAM agent
- Chat and AI provider - add new httpAgent chat source
- Agent Providers - add implementation for admin configurable agent providers
- Agent Providers - add audit logging to agent chats
- Graph search UX and scoped explanation queries
- Activity Dashboard
- Activity - fix problematic queries, decouple workflows/library prompts, remove unused package
- Workflows - store artifacts in db as WorkflowArtifact (normalizing data)
- Chat/Workflows - Video generation in artifacts using Remotion
- Artifacts - HTML design aesthetic ('pptx' presentations (chat, workflows))
- Share Asset modal - integrate 'refresh share' capability
- Graph Database - Admin-shared documents are now fully queryable in graph mode (one-hop expansion, shortest paths, enumeration, aggregation, Live Graph panel, snapshots). Read-path authorization moved to document-ID validation at route boundaries with compile-time-enforced fail-closed safety net.
- Chat - PRD Agent-related UI edits
- Docker - add dockerfiles and plumbing for new python-based agent services
- Artifacts - PowerPoint (.pptx) template updates
- Chat - add agentic chat
- Document Library - folder management
- Ai Providers - add agent column to AiProviderUsage for agent token tracking
- Agents - add agentic artifact generation
- Graph database - ingest data, graph, and share
- SWH Content Engine - integration
- Agents - add .docx artifact generation
- Settings and Agents - add new repo service
- Chat - add agent trace
- Context Studio - add searchable chats and documents
- First time login - Improve user onboarding experience
- Agents - add edit_docx tool
- Graph database - add cooperative cancellation for in-progress graph builds, preserving previously-graphed documents
- Agents - add create_pptx tool and libreoffice for rendering in artifact panel
- Agents - add edit_pptx tool
- Settings - AI Providers - add embedding flag to AiProviderUsage
- Settings - Data Sources - add Artifact Template model and backend data layer
- Settings - Data Sources - add admin UI for uploading and deleting artifact templates
- Settings - AI Providers - designate a model as embeddings only
- Agents - make skill repo tools user group gated
- Analytics - attribute embedding spend to its source artifact, count retrieval toward cumulative cost, and track usage on the internal agent routes
- Analytics - send user and chat message attribution from claude-service and langgraph so agentic spend is tracked

### Changed

- Profile - Document Upload - Refactor docUpload for performance and reliability upgrades
- Chat - update layout
- Agents - LCAT - cleanup and refactor
- Agents - LCAT - enforce stricter typing in routes
- Agents - LCAT - Add timeout handling in production
- LCAT agent - UI/UX - styling pass/normalization
- Document Library - reduce chunk size from 6000 to 800 tokens (with 150 token overlap) for better RAG retrieval precision
- AI Agents - refactoring
- Graph Database - refactor architecture to match other providers
- Remove DOCUMENT_GRAPH feature flag
- Chat - Fix message jump on async chat
- Chat - Fix async chat worker Bedrock validation error
- Document Upload - replace regex sentence splitter with Intl.Segmenter
- Chat - citations - UI tweaks
- Settings - Graph Databases - update Neo4j page to display live data as JSON
- Graph Database - move graph builder worker to separate container
- Settings - Neo4j - graph visualization
- Settings - Graph Database - standardizing endpoints
- Ai Agents - RCAST - update formula and UI design tweaks
- Nodes - 'save configuration' - currently have to 'save' entire workflow for primitive config change to be saved
- Workflows - remove layout and replace with viewport
- Fine-tune workflows view (UI/UX) (executions)
- Node data transfer - ensure no hardcoded formatting is being added to output
- Settings - Document Upload Provider - allow edit of existing provider
- Settings - neo4j - ability to 'write' with query (wrapped in 'are you sure')
- Workflows - Strip promptText from workflow execution payloads
- Artifacts - (chat, workflows) - support HTML rendering in preview
- AI Providers - hooking up top_p value (repetitiveness) config value to API call
- Prompts - model params - rename randomness to temperature
- Prompts - model params - rename repetitiveness to top_p
- AI Agents - MARGIN - upload spreadsheet via presigned URL
- Workflows - make stop/cancel buttons more responsive feeling
- AI Agents - MARGIN - update UI to show calculations
- AI Agents - PRISM - allow duplicate requirements
- Chat - Document upload - Fix production race condition and getDocuments 4MB API warning
- Workflows - select which user groups you want to share with
- Chat/Workflows - get video narration from artifacts
- Artifacts - presentations (html) - 'escape' button functionality
- Document Library - select which user groups you want to share with
- Design updates
- Chat - Make all chats (except deep research) async via worker
- AI Agents - RCAST - updates to include selectable experience level, geographic location, and adjustable wrap rate
- Document upload - Fix OOM and partial embedding state for large document uploads
- Navigation - add more visual real estate (chat history)
- Chat - PRD Agent-related UI edits
- Chat - remove admin/creator ownership check from GetOriginPrompt route
- Chat - Disable graphing for tabular data (.csv, .xlsx, .xls)
- Agents - Refactor Claude service
- Agents - Chunked document generation
- Chat - update layout be more Claude/ChatGPT-like
- Context Studio - optimize queries for faster loading
- Context Studio - add admin filter to more queries, database indexes, remove dead components
- Expand AuditRecord coverage
- Settings - Data Sources - Templates - upload templates to S3 via presigned URL
- Context Studio - move Analytics into a Cost tab

### Fixed

- Document Library - share sources - auto-recover from failed graph share-copies (cleanup-on-failure + smart idempotency guard)
- Document Library - share sources - retry-idempotent graph copy via MERGE + indexes
- Document Library - share sources - graph share-copy now uses indexes via label-scoped MATCH/MERGE — tiny shares complete in seconds instead of tens of minutes
- Update NextJS packages to address security vulnerability
- Renaming migration back to original name
- Graph - Add rate limit resilience to extraction, resolution, and transitivity phases
- Fix incorrect retry button display during async processing
- Chat - artifact - only auto-open on artifact creation, not page load
- Chat - failed upload - prevent API call when deleting UI element
- Graph Visualization - Fixed stuck states, duplicate document colors, and isolation banner recovery
- Workflows - Issue with pre-save state --> 'saved' page losing line connections (redraws and simplifies them from parent-child to linear)
- Accepting workflow displays 'copied' workflow + source workflow
- Remove timeout from retryWithBackoff + remove jobheartbeat
- Fix workflows page Title property
- Fix missing sheets data in Document.dataProfile
- Settings - AI Providers - attribute embedding cost to the embedding model
- Context Studio - order the artifact table by creation date so paging is stable
- Context Studio - scope the group and user filter lookups to studio permissions

## PALM v1.2.0 - 2025-10-07

### Added

- Chat - Incorporate Personal Document Library
- Allow Users to Follow up by Selecting Text
- Chat - DB - Add updatedAt column to ChatMessage table
- Chat - Follow up questions - update visibility logic of follow-ups to match Perplexity
- Chat - deep research - add deepResearch column to chatMessage table
- Chat - deep research - incorporate deepResearch column into types and supporting code
- Document Library - Update permissions to require access to a Bedrock provider w/ model
- Add UI indicator for deep research assistant messages
- Chat - Add Deep Research Functionality
- Chat - deep research - add user group access check for deep research button
- Chat - deep research - hide research button if selected chat model does not support deep research
- Chat - retry message - disable message input and direct user to 'retry' button w/ tooltip
- App-wide - Improve loading icon
- Chat - document upload - add file selection input
- Chat - document upload - Incorporate input into add-message and retry-message routes
- Chat - deep research - allow user to stop in progress deep research job
- App wide - add "Are you still there" modal for 15 minute activity logout
- Chat - update context so LLM is aware of 'knowledge base' and 'document library' concepts
- Chat - document upload - add embedding number validation check
- Chat - deep research - loading icon UI/UX (color, transitions)
- Chat - system prompt - update instructions to use mermaid (.mmd) as underlying engine for diagrams and graphs
- Chat - deep research - regenerate deep research message
- Chat - fix race condition in chat summary generation
- App Wide - PII modal check (email addresses)

### Changed

- Replace OpenAI with Bedrock for document upload embeddings
- Chat - deep research - refactoring
- AI Providers - update model inputs
- CERTA - switch from OpenAI to Bedrock for embeddings
- Profile - Document Upload - implement parallel file processing

### Fixed

- Add AI Provider modal - update test to fix palm repo sync
- Chat - model select - show placeholder when model has been deleted instead of empty input

## PALM v1.1.2 - 2025-09-02

### Added

- Automatically open new chat artifacts
- Syntax highlighting for chat artifacts
- Allow retry action on any LLM response in chat
- System message editing at any point in chat conversation
- Edit previous chat message functionality
- Added follow-up chat message generation feature
- Reduced minuscule chat artifacts through updated prompt instructions
- Breadcrumbs for nested pages in settings
- Breadcrumbs for prompt detail pages
- Add lastLoginAt column to User Group Members table
- Updated User Group links without anchor tags

### Changed

- Migration from OpenAI to Bedrock for document embeddings

### Fixed

- AI Agents: Agent detail page AppHead now incorporates agent name
- Chat: Fixed issue where users could continue conversation with unavailable model
- Chat: Fixed popup overlay issue that occurs when citations are visible

## PALM v1.1.1 - 2025-08-12

### Changed

- Hide document library checkbox in chat if there are no providers set in system config

### Security

- Address critical vulnerability from `form-data`
- Address high vulnerabilities from `xlsx`

## PALM v1.1.0 - 2025-08-12

### Added

- Add RADAR to codebase
- AI Agent Management
- Profile - "Personal Document Library" tab (upload and manage documents)
- Settings - "Document Upload Providers" (manage document upload providers)
- Modify `KnowledgeBase` DB table to exclude PDL metadata
- Add Document Upload Provider backend and worker/queue
