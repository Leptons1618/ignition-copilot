Below is the **AI indexing schema** used to make an Ignition project queryable and modifiable by an LLM in a reliable way.

This is not an ML research thing — it’s a **structured extraction + embedding layer** so the AI can answer questions like:

```
Where is this tag used?
What views contain alarms?
Create new views following existing patterns.
What breaks if I rename this script?
```

The goal is:

```
Ignition Project → Structured Index → Vector Search → LLM
```

---

# IGNITION AI INDEXING SCHEMA

## (PROJECT KNOWLEDGE EXTRACTION LAYER)

---

## 1. PURPOSE OF INDEXING

Raw Ignition projects are not AI-friendly because:

* views are deeply nested JSON
* tags are separate from project
* scripts reference things indirectly
* relationships are implicit

Indexing converts this into:

```
Explicit relationships + searchable knowledge
```

The index must answer:

| Question                 | Data Source         |
| ------------------------ | ------------------- |
| Which views use a tag?   | bindings            |
| Where is a script used?  | event handlers      |
| What views look similar? | component structure |
| What breaks if modified? | dependency graph    |

---

## 2. INDEX STORAGE STRUCTURE

Create directory:

```
/ai-index/
```

Structure:

```
ai-index/
 ├── views.json
 ├── tags.json
 ├── scripts.json
 ├── dependencies.json
 ├── embeddings/
 │     ├── views.vec
 │     ├── tags.vec
 │     └── scripts.vec
 └── metadata.json
```

---

## 3. VIEW INDEX SCHEMA

Each Perspective view becomes one indexed document.

### views.json format

```json
{
  "view_path": "Pump/PumpView",
  "file_path": "views/Pump/PumpView/view.json",

  "root_container": "flex",

  "components": [
    {
      "id": "Label_1",
      "type": "ia.display.label",
      "path": "root.children[0]",
      "bindings": [
        "[default]Pump01/Status"
      ]
    }
  ],

  "tags_used": [
    "[default]Pump01/Status",
    "[default]Pump01/Speed"
  ],

  "embedded_views": [
    "Common/AlarmIndicator"
  ],

  "scripts_used": [
    "project.pump.formatStatus"
  ],

  "navigation_targets": [
    "PumpDetails"
  ],

  "structure_signature": [
    "flex",
    "label",
    "icon",
    "alarm"
  ]
}
```

---

### Why this matters

The `structure_signature` allows:

```
Find views similar to this one
```

which is critical for AI generation.

---

## 4. TAG INDEX SCHEMA

Generated from exported tags.json.

### tags.json format

```json
{
  "path": "[default]Pump01",
  "type": "UDTInstance",
  "udt": "Pump",

  "members": [
    {
      "name": "Status",
      "datatype": "Boolean"
    },
    {
      "name": "Speed",
      "datatype": "Float"
    }
  ],

  "alarms": [
    "Fault",
    "Overload"
  ]
}
```

---

### Required derived fields

AI must compute:

```
all_udt_instances
all_alarm_tags
numeric_tags
boolean_tags
```

This enables automatic view creation.

Example:

```
Create pump view for all pump instances
```

---

## 5. SCRIPT INDEX SCHEMA

Parse all project scripts.

### scripts.json format

```json
{
  "script_path": "project.pump",
  "functions": [
    {
      "name": "formatStatus",
      "parameters": ["value"],
      "calls": [
        "system.tag.readBlocking"
      ]
    }
  ],

  "used_in_views": [
    "Pump/PumpView"
  ]
}
```

---

### Extraction rules

Detect:

* function definitions
* system.* calls
* tag paths inside scripts
* imports

This enables:

```
What scripts use this tag?
```

---

## 6. DEPENDENCY GRAPH

This is the most important file.

### dependencies.json

```json
{
  "tag_to_view": {
    "[default]Pump01/Status": [
      "Pump/PumpView"
    ]
  },

  "view_to_script": {
    "Pump/PumpView": [
      "project.pump.formatStatus"
    ]
  },

  "view_to_view": {
    "Main": [
      "Pump/PumpView"
    ]
  }
}
```

---

This enables impact analysis:

```
If tag changes → what breaks?
```

---

## 7. EMBEDDING MODEL STRUCTURE

Each indexed object produces a text summary.

Example view embedding text:

```
View Pump/PumpView
Flex container layout
Displays pump status and speed
Uses tags Pump01 Status and Speed
Contains alarm indicator
Used in main navigation
```

This text is embedded into vector storage.

Recommended local models:

```
nomic-embed-text
bge-large
all-MiniLM-L6-v2
```

Stored as:

```
embeddings/views.vec
```

---

## 8. INDEXING PIPELINE

### Step 1 — Parse project

```
scan views/
scan scripts/
load tags.json
```

---

### Step 2 — Extract relationships

* bindings → tags
* event scripts → functions
* embedded views

---

### Step 3 — Build structured JSON index

Generate:

```
views.json
scripts.json
tags.json
dependencies.json
```

---

### Step 4 — Generate embedding text

Create descriptive summaries.

---

### Step 5 — Store vectors

Used for semantic search.

---

## 9. QUERY FLOW AFTER INDEXING

Example:

User asks:

```
Add alarm indicator to all pump views
```

AI flow:

```
vector search → find pump-like views
↓
filter by tags_used contains Pump
↓
modify matching view.json files
↓
lint validation
```

---

Another example:

```
Where is Pump01 used?
```

Flow:

```
dependencies.json lookup
↓
return view list
```

---

## 10. BEST PRACTICES FOR RELIABLE AI BEHAVIOR

### Do not index raw JSON only

Always create human-readable summaries.

### Separate structure from content

Structure drives generation.

### Rebuild index after major edits

Index must reflect project state.

### Never embed entire project in one chunk

Views and scripts must be separate documents.

---

## 11. RESULTING SYSTEM ARCHITECTURE

Final system:

```
Ignition Project
       ↓
Index Builder
       ↓
Structured Index + Embeddings
       ↓
Vector Search
       ↓
LLM
       ↓
Validated Resource Changes
```

---

If you want next, the next piece that makes this actually powerful is the **AI tool interface schema** — meaning the exact tools your AI exposes like:

```
get_view()
find_tag_usage()
create_view_from_template()
apply_view_patch()
```

That’s what turns this from “AI that knows things” into “AI that actually edits the project safely.”
