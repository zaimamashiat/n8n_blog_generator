# n8n GitHub Blog Publisher

This project provides a website where a user can:

1. Connect their GitHub account through OAuth.
2. Select a writable repository.
3. Choose a branch and destination folder.
4. Trigger the n8n blog-generation workflow.
5. Publish the returned `.mdx` and `.json` files to the selected repository.

The GitHub access token is stored only in the server session. It is not placed in frontend JavaScript and is not sent to n8n.

## Architecture

```mermaid
flowchart LR
    U["User"] --> WEB["Blog Publisher Website"]

    WEB -->|GitHub OAuth| GH["GitHub"]
    GH -->|OAuth callback| WEB

    WEB -->|Repository / Branch Selection| API["Node.js Backend"]

    API -->|POST Request| N8N["n8n Blog Generation Workflow"]

    N8N --> RSS["RSS / Article Sources"]
    RSS --> N8N

    N8N --> GROQ["Groq LLM"]
    GROQ --> N8N

    N8N -->|Generated MDX + JSON| API

    API -->|GitHub Contents API| REPO["Selected GitHub Repository"]

    REPO --> BLOG["Published Blog Content"]
```

## Blog Generation Workflow

The n8n workflow collects articles, ranks them by relevance, generates content ideas, creates a complete article, and returns the resulting MDX and JSON files to the application backend.

```mermaid
flowchart TD
    A["Webhook / Workflow Trigger"] --> B["List of Websites"]

    B --> C["Loop Over Websites"]

    C --> D["RSS Read"]

    D --> E["Clean Article Data"]

    E --> F["Sort by Keywords"]

    F --> G["Select Relevant Articles"]

    G --> H["Groq LLM<br/>Analyze Articles"]

    H --> I["Parse LLM Output"]

    I --> J["Filter by Relevance"]

    J --> K["Bundle Ideas"]

    K --> L["Groq LLM<br/>Generate Content Ideas"]

    L --> M["Parse Generated Ideas"]

    M --> N["Pick First / Best Idea"]

    N --> O["Groq LLM<br/>Generate Full Blog Post"]

    O --> P["Parse Blog Output"]

    P --> Q["Generate MDX + JSON"]

    Q --> R["Return Files to Website Backend"]

    R --> S["GitHub Contents API"]

    S --> T["Commit MDX + JSON<br/>to Selected Repository"]
```

## End-to-End Publishing Flow

```mermaid
sequenceDiagram
    participant User
    participant Website
    participant GitHub
    participant n8n
    participant Groq

    User->>Website: Open Blog Publisher
    User->>Website: Connect GitHub
    Website->>GitHub: OAuth authorization request
    GitHub-->>Website: OAuth callback + authorization

    Website->>GitHub: Load writable repositories
    GitHub-->>Website: Repository list

    User->>Website: Select repo, branch and folder
    User->>Website: Generate and publish blog

    Website->>n8n: POST generation request

    n8n->>n8n: Read RSS feeds
    n8n->>n8n: Clean and rank articles

    n8n->>Groq: Analyze relevant articles
    Groq-->>n8n: Article analysis

    n8n->>Groq: Generate content ideas
    Groq-->>n8n: Blog ideas

    n8n->>Groq: Generate full article
    Groq-->>n8n: Generated blog

    n8n-->>Website: MDX + JSON files

    Website->>GitHub: Commit generated files
    GitHub-->>Website: Commit result

    Website-->>User: Published successfully
```

## Project structure

```text
n8n-github-blog-app/
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── .env.example
├── .gitignore
├── n8n-workflow-website-version.json
├── original-workflow.json
├── package.json
├── README.md
└── server.js
```
