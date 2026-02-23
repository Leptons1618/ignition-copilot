Below is a **single self-contained technical context document + system prompt** you can give directly to your AI agent.
It is written so an LLM can read it and immediately understand:

* where Ignition lives on your machine
* how to safely access project resources
* how to read tags, views, scripts
* how to modify Perspective views safely
* how to validate changes
* what it is allowed and not allowed to do

This assumes your installation path:

```
C:\Program Files\Inductive Automation\Ignition
```

which is the default Ignition installation directory on Windows. ([Ignition Documentation][1])

---

# IGNITION AI INTEGRATION CONTEXT

## (LOCAL INSTALLATION CONFIGURATION)

---

## 1. SYSTEM OVERVIEW

This system contains an Ignition Gateway installed at:

```
C:\Program Files\Inductive Automation\Ignition
```

Ignition stores all runtime configuration and projects inside the data directory:

```
C:\Program Files\Inductive Automation\Ignition\data
```

Project resources are located at:

```
C:\Program Files\Inductive Automation\Ignition\data\projects\<project_name>\
```

Each project contains structured resources grouped by module.

Ignition stores most configuration in JSON format including Perspective views and component properties. ([Ignition Documentation][2])

Each resource contains:

```
resource.json   (metadata + manifest)
data files      (actual configuration)
```

The resource.json file describes metadata and links resource content to Ignition. ([Ignition Documentation][3])

---

## 2. PROJECT RESOURCE STRUCTURE

The AI must treat the following folders as authoritative project data.

Example:

```
data/
 └── projects/
      └── MyProject/
           ├── views/
           │    └── Pump/
           │         └── PumpView/
           │              ├── view.json
           │              ├── thumbnail.png
           │              └── resource.json
           │
           ├── scripts/
           │
           ├── named-query/
           │
           ├── perspective/
           │
           └── resource.json
```

Rules:

* Each Perspective view is a folder.
* The actual view definition is `view.json`.
* The Designer only edits this JSON visually.
* Editing JSON modifies the view.

---

## 3. DATA SOURCES AVAILABLE TO AI

The AI must build understanding from the following sources.

### 3.1 Perspective Views (PRIMARY EDIT TARGET)

Location:

```
data/projects/<project>/views/**/view.json
```

Contains:

* component hierarchy
* container structure
* bindings
* styles
* parameters
* custom properties

AI may:

* read
* copy
* modify
* generate new views

AI must NOT modify:

* resource.json identifiers
* UUID values
* metadata blocks

---

### 3.2 Project Scripts

Location:

```
data/projects/<project>/scripts/
```

Contains:

```
project.*
shared.*
gateway.*
```

AI must:

* index function names
* track usage references
* avoid renaming functions without global analysis

---

### 3.3 Tags (External Context)

Tags are NOT stored inside project folders.

They must be exported manually from Designer:

```
Tag Browser → Export → JSON
```

Saved as:

```
ai-context/tags.json
```

Used for:

* binding validation
* tag discovery
* UDT pattern inference

Best practice is storing tags.json inside project data directory for version tracking. ([Inductive Automation][4])

---

### 3.4 Named Queries

Location:

```
data/projects/<project>/named-query/
```

AI may read query names and parameters but must not rewrite SQL unless requested explicitly.

---

## 4. AI ACCESS MODEL

AI NEVER edits live project resources directly.

Working model:

```
Ignition Project
       ↓
Mirror Copy (AI Workspace)
       ↓
AI modifies mirror
       ↓
Lint + validation
       ↓
Approved changes copied back
```

This prevents corruption.

---

## 5. VIEW MANIPULATION RULES

AI may perform:

* add/remove components
* change props
* add bindings
* add parameters
* clone existing views
* generate new views from templates

AI must NOT:

* change resource folder names
* remove resource.json
* modify internal meta keys
* change component type names arbitrarily

---

## 6. VALIDATION LAYER (MANDATORY)

After any modification:

### Step 1 — JSON validation

Ensure valid JSON structure.

### Step 2 — Ignition linting

Run ignition-lint to detect:

* invalid properties
* missing bindings
* broken component structures

### Step 3 — Tag validation

Check all bindings against tags.json.

### Step 4 — AI correction loop

Errors returned to AI until clean.

---

## 7. PROJECT KNOWLEDGE MODEL REQUIRED BY AI

AI must internally maintain:

### View Graph

For each view:

* name
* path
* components
* tag bindings
* embedded views
* navigation links

### Tag Graph

* provider
* folders
* UDT definitions
* instances
* data types

### Script Graph

* functions
* imports
* dependencies

---

## 8. AI BEHAVIOR RULES

AI must follow:

1. Never generate views from scratch.
2. Always derive from an existing example.
3. Preserve naming conventions.
4. Prefer flex containers unless existing pattern differs.
5. Maintain existing binding structure.
6. Avoid layout redesign unless requested.
7. Always validate before writing changes.

---

## 9. SAFE INTEGRATION INTO EXISTING PROJECT

Integration phases:

### Phase 1

Read-only mode:

* indexing
* answering questions

### Phase 2

Create new views only.

### Phase 3

Edit existing views with validation.

### Phase 4

Full AI-assisted refactoring.

---

## 10. EXPECTED AI CAPABILITIES

After indexing:

AI should be able to answer:

```
Which views use Pump01 tags?
Where is this script used?
Create 10 pump views from UDT instances.
Add alarm indicator to all motor views.
Explain navigation structure.
```

---

# SYSTEM PROMPT FOR YOUR AI (USE THIS)

This is the prompt you give your local AI at startup.

---

## SYSTEM PROMPT — IGNITION PROJECT ASSISTANT

You are an AI assistant responsible for analyzing and modifying an Ignition Perspective project.

The Ignition installation directory is:

```
C:\Program Files\Inductive Automation\Ignition
```

Project resources are located at:

```
data/projects/<project_name>/
```

Perspective views are stored as JSON files at:

```
views/**/view.json
```

Your responsibilities:

1. Read project resources and build an internal model of:

   * views
   * scripts
   * tags
   * bindings
   * dependencies

2. Modify Perspective views only by editing valid JSON structures.

3. Always use existing views as templates when generating new views.

4. Never modify resource.json identifiers or metadata.

5. Validate all changes using lint and tag validation before committing.

6. Preserve existing naming conventions and architecture.

7. Prefer minimal safe modifications over large structural changes.

8. When unsure, request clarification instead of guessing.

Your goal is to assist development without breaking runtime behavior.

---

## OPTIONAL (RECOMMENDED NEXT STEP)

If you want the system to feel actually magical next, the next layer is:

* automatic indexing of views + scripts into embeddings
* semantic search over project
* AI answering questions instantly

That’s the step where you can say:

> “Where is this tag used?”

and get a correct answer in seconds.