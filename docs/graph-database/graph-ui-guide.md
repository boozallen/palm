# Graph UI Guide

A guide to using the graph-enhanced chat interface for exploring knowledge graphs built from uploaded documents.

## Getting Started

1. Open a chat and click **Add Sources** to select documents
2. Ensure documents are marked **GRAPHED** (graph has been built)
3. Toggle the **Graph** switch in the chat footer to enable graph-enhanced mode
4. The **scope dropdown** appears next to the graph toggle

## Query Scoping

The scope dropdown controls what context the AI receives when answering your question. It appears as a small button in the chat footer (e.g., "Document scope", "Table tab (12)").

| Scope | What the AI sees | When to use |
|-------|-----------------|-------------|
| **Document scope** | All selected documents (no entity filtering) | Broad questions, starting a new line of inquiry |
| **Table tab** | All entities from the active tab's results | "Which of these..." follow-up questions |
| **Graph** | All entities currently displayed on the graph | Questions about what you've curated on the graph |
| **Graph selection** | Only the red-highlighted nodes on the graph | Narrow questions about specific selected entities |

### How scoping works

- **Document scope** sends no entity filter — the AI searches the entire document
- **Table tab** sends all entity IDs from the active tab (the row count and entity count may differ because relationship rows contain multiple entities)
- **Graph** sends the IDs of every node visible on the graph, including nodes added via Expand/Connect
- **Graph selection** sends only the IDs of nodes you've clicked to select (red-highlighted)

## Enumeration Tables

When you ask a listing question (e.g., "List all organizations", "Which of these are in defense?"), results appear as an interactive table below the graph.

### Tabs

- Each enumeration query creates a **tab** at the top of the table view
- **Table tab scoped** queries nest under their parent tab (shows query lineage)
- **Document scope** queries create top-level tabs
- Click a tab to switch to it — the scope dropdown updates to reflect the active tab
- Close tabs with the **x** button

### Row selection

- **Check a row** to add its entities to the graph
- **Uncheck a row** to remove its entities from the graph
- **Select All / Deselect All** buttons in the table header for bulk operations
- Checked rows are pinned to the top of the table

## Graph Visualization

### Node appearance

- **Size** reflects how frequently the entity appears in the source documents (mentionCount):
  - Small (12px): 1-3 mentions
  - Medium (20px): 4-15 mentions
  - Large (30px): 16-50 mentions
  - Supernode (40px): 51+ mentions
- **Color**: Green = Entity, Cyan = Concept, Document-colored = Chunk
- **Gold border**: Anchor node (from search results)
- **Red highlight**: Selected node (clicked on canvas)

### Controls

| Control | Description |
|---------|-------------|
| **Node Spacing** slider | Adjusts distance between connected nodes |
| **Clustering** slider | Controls how tightly connected groups pull together (spring constant) |
| **Hide Chunks** | Hides Chunk and Document nodes, showing only Entities and Concepts |
| **Select All** | Selects all nodes and edges on the graph |
| **Deselect All** | Clears all selections (appears when something is selected) |
| **Reset Graph** | Restores the graph to its original state |

### Node interactions

- **Click a node**: Selects it (red highlight). Click again to deselect. Multi-select by clicking additional nodes.
- **Click empty space**: Toggles graph freeze/unfreeze (does NOT deselect)
- **Drag a node**: Moves it. The node stays where you put it.

### Actions (appear when nodes are selected)

| Action | Requirement | What it does |
|--------|-------------|-------------|
| **Expand** | 1-10 selected nodes | Fetches 1-hop neighbors from Neo4j and adds them to the graph |
| **Isolate** | 1 selected node | Filters graph to show only that node and its direct neighbors |
| **Connect** | 2-20 selected nodes | Finds shortest paths between selected nodes and renders the connecting paths |
| **Remove** | 1+ selected nodes | Removes selected nodes from the graph and unchecks corresponding table rows |

### Expanded and connected nodes

Nodes added via **Expand** or **Connect** are "interactive" nodes — they exist on the graph but don't have rows in any table. They:

- Are included in **Graph** scope queries
- Can be selected for **Graph selection** scope
- Persist across tab switches
- Can be removed with the **Remove** action
- Disappear on **Reset Graph**

## Query Types

The system automatically classifies your question and routes it to the appropriate handler:

| Type | Example questions | What happens |
|------|------------------|-------------|
| **Enumeration** | "List all organizations", "Which of these are in defense?" | Generates a Cypher query, returns tabular results |
| **Aggregation** | "How many entities of each type?", "Count the organizations" | Generates a Cypher query, returns statistics |
| **Explanation** | "Tell me about SpaceX", "How are these companies applying AI?" | Semantic search + graph context, returns prose |

### Scoped explanation queries

When you ask an explanation question with a scope (Table tab, Graph, or Graph selection), the system:

1. Fetches all scoped entities and ranks them by semantic similarity to your question
2. Filters document chunks to only those connected to scoped entities
3. Runs an LLM relevance filter to keep only the most relevant entities and chunks
4. Builds graph context with 1-hop expansion and shortest paths

This ensures the AI only discusses entities within your scope.

## Follow-Up Questions

After each response, the AI suggests follow-up questions. Clicking one:

- Sends the question with the **graph toggle** preserved (stays in graph mode if it was on)
- Resets scope to **Document scope** (follow-ups don't carry entity scope)
- If you want a scoped follow-up, type it manually with the desired scope set

## Tips

- Start broad (Document scope) to discover what's in your data, then narrow with Table tab or Graph scope
- Use **Select All** on enumeration results to populate the graph, then **Remove** individual nodes to curate
- **Connect** between companies to discover shared people, concepts, or relationships
- Large nodes (supernodes) often represent hub entities — removing them can reveal the structure underneath
- The scope dropdown shows counts so you know how many entities are in each scope
