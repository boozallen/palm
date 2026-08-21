import { useState } from 'react';
import { IconBinaryTree2, IconDatabase, IconFileText, IconFileSpreadsheet, IconFileDescription, IconFileMusic, IconFileCode, IconFileChart, IconVideo } from '@tabler/icons-react';

import { Chat } from '@/features/chat/types/chat';
import { Entries, EntryType, MessageEntry } from '@/features/chat/types/entry';
import { ARTIFACT_TOOL_NAMES, ArtifactToolName } from '@/features/chat/types/agent-trace';
import { UserKnowledgeBase } from '@/features/shared/types';
import { Document, AUDIO_FILE_TYPES } from '@/features/shared/types/document';
import { generatePromptSlug } from '@/features/shared/utils';
import { htmlInstructions } from '@/features/shared/constants/system-prompt';

export function useGreeting(name?: string | null): string {
  const [pick] = useState(() => Math.floor(Math.random() * 3));
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
  let firstName: string | undefined;
  if (name) {
    if (name.includes(',')) {
      firstName = name.split(',')[1]?.trim().split(' ')[0];
    } else {
      firstName = name.split(' ')[0];
    }
  }
  if (pick === 0) {
    return firstName ? `Good ${timeOfDay}, ${firstName}` : `Good ${timeOfDay}`;
  }
  if (pick === 1) {
    return firstName ? `${timeOfDay}, ${firstName}` : timeOfDay;
  }
  return firstName ? `Hello, ${firstName}` : 'Hello';
}

export const generatePath = (id: string, promptTitle?: string) => {
  if (promptTitle) {
    const promptSlug = generatePromptSlug(promptTitle);
    return `/chat/${id}/${promptSlug}`;
  }
  return `/chat/${id}`;
};

export const generateUrl = (
  chatId: string,
  knowledgeBaseIds: string[],
  documentIds: string[],
  promptTitle?: string,
  sourcesSidebarExpanded?: boolean,
  useGraph?: boolean,
) => {
  const path = generatePath(chatId, promptTitle);

  const urlParams = new URLSearchParams();
  urlParams.set('knowledge_base_ids', knowledgeBaseIds.join(','));
  urlParams.set('document_ids', documentIds.join(','));
  urlParams.set('sources_sidebar_expanded', sourcesSidebarExpanded?.toString() || 'false');
  urlParams.set('use_graph', useGraph?.toString() || 'false');
  
  const queryString = urlParams.toString();

  return `${path}${queryString ? `?${queryString}` : ''}`;
};

export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const sortConversationsByMostRecentlyUpdated = (conversations: Chat[]) => {
  conversations.sort((a, b) => {
    const first_date = new Date(b.updatedAt).getTime();
    const second_date = new Date(a.updatedAt).getTime();
    return first_date - second_date;
  });

  return conversations;
};

// The following function arranges conversations categorically by date
// The categories are: Today, Yesterday, Previous 7 Days, Previous 30 Days, {month}, {year}
export const categorizeConversationsByDateSections = (conversations: Chat[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - (24 * 3600 * 1000));
  const previousSevenDays = new Date(today.getTime() - (7 * 24 * 3600 * 1000));
  previousSevenDays.setHours(0, 0, 0, 0);
  const previousThirtyDays = new Date(today.getTime() - (30 * 24 * 3600 * 1000));
  previousThirtyDays.setHours(0, 0, 0, 0);
  const sortedChatHistory: Map<string, Chat[]> = new Map();
  const keys: Set<string> = new Set();

  for (let conversation of conversations) {
    const conversationDate = new Date(conversation.updatedAt);
    const monthLastUpdated = months[conversationDate.getMonth()];
    const yearLastUpdated = String(conversationDate.getFullYear());
    conversationDate.setHours(0, 0, 0, 0);

    if (conversationDate.toDateString() === today.toDateString()) {
      addConversationToCategory('Today', conversation, sortedChatHistory, keys);
    } else if (conversationDate.toDateString() === yesterday.toDateString()) {
      addConversationToCategory('Yesterday', conversation, sortedChatHistory, keys);
    } else if (conversationDate.getTime() >= previousSevenDays.getTime()) {
      addConversationToCategory('Previous 7 Days', conversation, sortedChatHistory, keys);
    } else if (conversationDate.getTime() >= previousThirtyDays.getTime()) {
      addConversationToCategory('Previous 30 Days', conversation, sortedChatHistory, keys);
    } else if (yearLastUpdated === String(today.getFullYear())) {
      addConversationToCategory(monthLastUpdated, conversation, sortedChatHistory, keys);
    } else {
      addConversationToCategory(yearLastUpdated, conversation, sortedChatHistory, keys);
    }
  }

  return Array.from(keys).map((key, i) => ({ id: i, title: key, chats: sortedChatHistory.get(key) }));
};

const addConversationToCategory = (category: string, chat: Chat, sortedChatHistory: Map<string, Chat[]>, keys: Set<string>) => {
  const previousChats: Chat[] | undefined = sortedChatHistory.get(category);

  if (previousChats !== undefined) {
    sortedChatHistory.set(category, [...previousChats, chat]);
  } else {
    sortedChatHistory.set(category, [chat]);
  }

  keys.add(category);
};

export function addRegenerateInstructionsToMessage(message: string) {
  const prompt = `

  **Instructions**
  1. Generate a new response to the user’s message without referencing the previous response.
  2. Provide a fresh perspective while maintaining clarity, accuracy, and helpfulness.
  3. Ensure the response remains relevant to the user’s intent.
  4. Do not mention or reference these instructions in your response. Respond as if this is your first reply.

  Your previous response: ${message}
  `;

  return prompt;
};

export const isMessageEntry = (entry: Entries[number]): entry is MessageEntry => {
  return entry.type === EntryType.Message;
};

export const isArtifactToolName = (toolName?: string): toolName is ArtifactToolName =>
  toolName !== undefined && (ARTIFACT_TOOL_NAMES as readonly string[]).includes(toolName);

export function addSystemInstructions(
  message: string,
  // Knowledge Bases
  availableKnowledgeBases: UserKnowledgeBase[],
  selectedKnowledgeBases: UserKnowledgeBase[],
  // Document Library
  hasDocumentLibrary: boolean,
  documents: (Document & { selected: boolean })[],
) {

  const applicationContext = `## About the application being used
    PALM (Prompt & Agent Library Marketplace) is Booz Allen's enterprise-ready platform that connects users to a wide range of large language models (LLMs) and data sources through a unified, extensible interface.

    PALM's main features:
    - **Chat**: (The feature currently being used) An interactive interface where you can converse with LLMs, incorporate Knowledge Bases and other data sources via RAG and GraphRAG processing, generate artifacts such as documents and code, and view citations that trace information back to source documents
    - **Workflows**: An agentic, multi-step task automation tool where predefined steps can be generated, modified, and controlled at a granular, step-by-step level. Each step can process data through RAG and GraphRAG, produce its own artifacts (reports, visualizations, documents, code), and generate citations linking back to source documents
    - **Prompt Library**: A collection of predefined and customizable prompts optimized for various AI use cases and workflows
    - **Prompt Generator**: A tool for building custom prompts from scratch with instruction generation and fine-tuning capabilities
    - **Prompt Playground**: A comparison tool for testing and fine-tuning responses across multiple LLM providers and their models (ChatGPT, Anthropic, Gemini)
    - **Profile**: User profile management with settings for their Document Library (manage uploaded files to include in chat context), Knowledge Bases (setting chat preselections), and User Groups (group memberships and entry via join code)
    - **Context Studio**: Observability across chats, documents, agents, and people, plus usage and cost metrics filterable by user/system initiated, LLM provider, and model.
    - **Settings**: Administrative controls for LLM integrations, feature configuration, external data source connections, and user group role-based access management
  `;

  const knowledgeBasesCount = availableKnowledgeBases?.length || 0;
  const knowledgeBasesContext = `## Knowledge Bases feature
    The Knowledge Bases feature allows users to connect with external data sources and include them in the chat context.
    The user currently has access to ${knowledgeBasesCount} Knowledge Base${knowledgeBasesCount === 1 ? '' : 's'}${knowledgeBasesCount ? `: ${JSON.stringify(availableKnowledgeBases.map(kb => ({ name: kb.label, selected: selectedKnowledgeBases.some(selectedKb => selectedKb.id === kb.id) })))}` : '.'}
  `;

  const documentsCount = documents?.length || 0;
  const documentLibraryContext = hasDocumentLibrary ? `## Document Library feature
    The Document Library feature allows users to upload files (sometimes referred to as 'documents') via the Document Library tab in the Profile page and include them in the chat context.
    The user currently has access to ${documentsCount} file${documentsCount === 1 ? '' : 's'}${documentsCount ? `: ${JSON.stringify(documents.map(doc => ({ filename: doc.filename, selected: doc.selected })))}` : '.'}`
  : '';

  return `${message}

    # Additional Context
    ${applicationContext}

    ${knowledgeBasesContext}
    ${documentLibraryContext}

    # Additional Instructions

    ## Artifacts

    1. **Identify Artifact-Worthy Content**:
      - The LLM should analyze its response to determine if there are any segments of text that qualify as 'artifact-worthy'. These are typically text, code snippets, configurations, or any structured data that could be reused or referenced independently.
      - Examples include standalone text documents, code in various programming languages, configuration files, structured data like JSON or XML, and diagrams/visualizations.
      - Artifacts should represent **complete, non-trivial, and reusable** content. Do **not** create artifacts for trivial examples (e.g., \`console.log("Hello, World!")\`), one-liners, incomplete fragments, or purely illustrative/demo snippets.
      - **For tables specifically**: Simple tables that are part of a conversational response should be rendered **inline using markdown** (not as artifacts). Only create .xlsx artifacts for tables when the user's request clearly indicates they want a **downloadable file** or when the table is substantial enough to warrant saving/exporting (e.g., large datasets, complex data meant for analysis).
      - As a general rule, artifacts are typically longer than **250 characters** or **15+ lines** of meaningful content.
      - **When the user asks to "build an app", "create an app", "make me an app", "build a tool", "make a web page", or any similar request that implies a functional interactive application**, always produce a **single .html** artifact with all CSS and JavaScript inline. Do **not** generate separate .js, .css, or .py artifacts alongside it — the user expects one cohesive, working, renderable result they can immediately preview.
      - **Default to a single self-contained HTML artifact.** Unless the user explicitly requests a standalone CSS file or standalone JavaScript file, always combine HTML, CSS, and JavaScript into one .html artifact. Never split a web page into separate HTML, CSS, and JS artifacts. If the user says "HTML", assume they want a complete interactive web page in a single .html file.

    1a. **Graph and Diagram Artifacts**:
      - When users make generic requests like "turn that to a graph", "create a diagram", "visualize this", or similar non-specific visualization requests, use **Mermaid syntax (.mmd) format by default**.
      - Common Mermaid diagram types: flowcharts (process flows, workflows), sequence diagrams (interactions over time), class diagrams (object-oriented design), state diagrams (state machines), ER diagrams (database schemas), Gantt charts (project timelines).
      - Only use programming-based graph generation (Python, JavaScript, etc.) when:
        - The user specifically requests or is using a programming language in their work
        - The context clearly requires data analysis, statistical plotting
        - Complex data manipulation is needed before visualization
        - The user needs interactive or dynamic visualizations

    2. **Wrap the Content**:
      - For each segment identified as artifact-worthy, it should be wrapped in the following format:
        \`\`\`\`artifact("<file_extension>","<label>")
        <artifact_content>
        \`\`\`\`
      - **CRITICAL**: Always use exactly FOUR backticks (\`\`\`\`) at the beginning and end, not three.
      - Replace '<file_extension>' with the appropriate identifier for the content's file type:
        ${htmlInstructions}
        - Use ".docx" for formatted documents, reports, essays, articles, letters, or any substantial text content that should be professionally formatted and downloadable as a Microsoft Word document. This includes markdown-formatted content that would benefit from rich formatting (headings, lists, tables, etc.).
        - Use ".pptx" for presentations, slide decks, pitch decks, briefings, or any content that should be structured as a PowerPoint presentation. Write the content in **markdown format** — the system will automatically convert it to a .pptx file. Unless instructed otherwise, use heading level 1 (#) for the title slide and heading level 2 (##) for subsequent slide titles, and each h1/h2 heading starts a new slide. Use bullet lists, tables, bold/italic text, and code blocks within slides as needed.
        - Use ".xlsx" for tabular data that users want to download as a spreadsheet for data analysis or manipulation in Excel. **IMPORTANT**: The content inside .xlsx artifacts should be in **markdown table format** (using pipes and dashes) or CSV format, NOT binary Excel data. The system will automatically convert the markdown table to an Excel file when the user downloads it.

          Example of a complete .xlsx artifact (note the FOUR backticks):
          \`\`\`\`artifact(".xlsx","Fruit Price List")
          | Fruit  | Color  | Price |
          |--------|--------|-------|
          | Apple  | Red    | $1.00 |
          | Banana | Yellow | $0.50 |
          \`\`\`\`
        - Use specific programming language extensions (e.g., ".js" for JavaScript, ".py" for Python, ".php" for PHP, ".java" for Java) **only when the user explicitly requests a standalone file** in that language. If the request involves a web page, interactive tool, or visual output, default to a single self-contained .html artifact instead.
        - Use ".txt" **only as a last-resort fallback** when no other file type applies. Before choosing .txt, consider whether .html, .md, .docx, .json, .yaml, or a programming language extension would be more appropriate. If the content has any structure, formatting, or interactivity, do **not** use .txt.
        - Use ".json" for JSON data, ".xml" for XML, ".yaml" for YAML
        - Use ".mmd" for Mermaid diagrams
        - Use ".mp4" when the user asks to create a video, animated explainer, slideshow, or visual walkthrough. The artifact content must be a **raw JSON array** (no code fences) of slide objects. Each slide supports: **id** (string, sequential "1","2",...), **heading** (string), **layout** (one of "title" | "text" | "image-right" | "full-image" | "bullets"), **body** (optional string, max 200 chars — omit for "bullets" layout), **bullets** (optional string array, 3–5 items — use with "bullets" layout instead of body), **imageSearchTerm** (optional 2–4 keyword string describing a visual scene or setting — required for "image-right" and "full-image" layouts; MUST describe a scene, place, object, or concept ONLY — NEVER include any person's name, athlete's name, celebrity name, or any proper noun referring to a human being; violating this causes image generation to fail; e.g. use "computer code screen terminal" not "bill gates", use "software developers office collaboration" not "linus torvalds programming"), and **narration** (optional string, 1–3 sentences spoken aloud while the slide plays). **Layout guide:** "title" = large centered title card (first slide only, auto-used when no body or bullets); "text" = heading + body paragraph (default content layout); "image-right" = text on left with relevant photo on right; "full-image" = full-bleed background photo with text overlaid at bottom; "bullets" = heading + animated staggered bullet list. The **first slide is always "title" layout with no body**; its narration is optional (short welcome line). Every subsequent slide should include a narration. Include **5–8 slides** total. **Vary layouts** — aim to use 3+ different layouts per video. Example:
          [{"id":"1","heading":"How Docker Works","layout":"title","narration":"Welcome to this overview of how Docker works."},{"id":"2","heading":"What is Docker?","layout":"image-right","imageSearchTerm":"docker containers technology","body":"Docker packages applications and dependencies into portable, isolated containers.","narration":"Docker is a containerization platform. It bundles your application and all its dependencies into a portable unit called a container."},{"id":"3","heading":"Core Concepts","layout":"bullets","bullets":["Images: read-only templates","Containers: running instances","Registries: store and share images","Volumes: persistent data"],"narration":"There are four core concepts. Images are blueprints, containers are running instances, registries distribute images, and volumes handle persistent data."},{"id":"4","heading":"Build Once, Run Anywhere","layout":"full-image","imageSearchTerm":"server cloud infrastructure","body":"Identical environments from laptop to production.","narration":"With Docker, you build once and run anywhere — on your laptop, in CI, or in the cloud."},{"id":"5","heading":"Why Teams Love Docker","layout":"text","body":"Eliminates environment inconsistencies, accelerates onboarding, and enables reproducible builds.","narration":"Docker solves the classic works on my machine problem and ensures identical environments from development all the way to production."}]
        - Do not make broad generalizations and be as specific as possible.
      - Provide a concise, sentence case '<label>' that describes the purpose or function of the artifact.
      - The 'artifact-worthy' '<artifact_content>' should be placed within the quadruple backticks. The artifact itself should not be wrapped in quadruple backticks.
      - Ensure that artifact-worthy content is only used once in the response, inside of this wrapped format. Never repeat artifact-worthy content outside of the artifact wrapping.

    3. **Handle Multiple Artifacts**:
      - If multiple artifact-worthy segments are present, each should be wrapped individually using the format described above.
      - Ensure that each artifact is clearly separated and independently wrapped.
      - **Never split a single web page into multiple artifacts** (e.g., separate HTML, CSS, and JS files). A web page or web app should always be a single .html artifact with inline styles and scripts. Multiple artifacts are appropriate only when the outputs are genuinely independent (e.g., a Python script and a separate data file, or two unrelated documents).

    4. **Non-Artifact Content**:
      - If a response contains no artifact-worthy content, ensure that any existing backticks or code-like formatting are not mistakenly wrapped as artifacts.
      - Maintain the integrity of the original response structure, only applying the artifact wrapping where applicable.
      - Artifact-worthy content should only appear wrapped in backticks and the same artifact should not be repeated elsewhere in the response.

    ## Follow Up Questions

    1. **Identify When to Generate Follow-Up Questions**:
      - Analyze your response to determine if it naturally invites further user engagement or exploration.
      - Generate follow-up questions when the response is **open-ended**, **educational**, or **could benefit from clarification or deeper exploration**.
      - Examples include responses that explain concepts, provide recommendations, solve problems with multiple approaches, or introduce new topics that users might want to learn more about.
      - **Always generate 2-3 follow-up questions** for responses that meet these criteria, even for simple queries like greetings or basic questions, as they can lead to meaningful conversations.

    2. **Question Quality Guidelines**:
      - Create questions that represent **natural follow-up queries a user might ask** based on your response content.
      - Questions should **encourage deeper engagement** rather than simple yes/no answers.
      - Make questions **specific and actionable** rather than generic or vague.
      - Ensure questions are **relevant to the user's apparent intent** and **the context of the conversation**.
      - Think from the **user's perspective** - what would they logically want to know or explore next?

    3. **Format Follow-Up Questions**:
      - Wrap each follow-up question in the following format:
        \`<FOLLOWUP>question text here</FOLLOWUP>\`
      - Each question should be wrapped individually using the format described above.
      - Questions should be **complete sentences** that make sense when presented to the user as clickable options.

    4. **Examples of Good Follow-Up Questions**:
      - For a greeting: "Help me create a project", "Explain a complex topic to me", "What are your capabilities?"
      - For technical explanations: "Can you show me a practical example?", "How do I implement this in my project?", "What are the potential pitfalls to avoid?"
      - For recommendations: "Which option is best for beginners?", "How do these compare in terms of performance?", "Can you walk me through the implementation?"
  `;
}

interface SelectedSource {
  id: string;
  label: string;
  type: 'knowledge-base' | 'document';
}

export const getFileTypeConfig = (filename: string) => {
  if (filename.includes('.pdf')) {
    return { color: 'red.6', icon: IconFileDescription };
  }
  if (filename.includes('.pptx')) {
    return { color: 'orange.7', icon: IconFileChart };
  }
  if (filename.includes('.mp4')) {
    return { color: 'violet.6', icon: IconVideo };
  }
  if (filename.includes('.xlsx') || filename.includes('.csv')) {
    return { color: 'green.6', icon: IconFileSpreadsheet };
  }
  if (filename.includes('.json')) {
    return { color: 'orange.6', icon: IconFileCode };
  }
  if (filename.includes('.mmd')) {
    return { color: 'violet.6', icon: IconBinaryTree2 };
  }
  if (filename.includes('.html') || filename.includes('.md')) {
    return { color: 'grey.6', icon: IconFileCode };
  }
  if (AUDIO_FILE_TYPES.some(ext => filename.toLowerCase().endsWith(ext))) {
    return { color: 'purple', icon: IconFileMusic };
  }
  return { color: 'blue.6', icon: IconFileText };
};

export const getSourceConfig = (source: SelectedSource) => {
  if (source.type === 'knowledge-base') {
    return { color: 'gray.6', icon: IconDatabase };
  }
  return getFileTypeConfig(source.label);
};
