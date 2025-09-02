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
