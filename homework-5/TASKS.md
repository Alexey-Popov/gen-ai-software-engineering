# 🔌 Homework 5: Configure MCP Servers (GitHub, Filesystem, Jira or Notion, Custom)

## 📋 Overview

Install and configure **three external MCP servers** (GitHub, Filesystem, Jira or Notion) and build **one custom MCP server** with FastMCP. Demonstrate working interactions between your development environment (Claude Code or Copilot) and each server. Provide **screenshots of MCP call results** for each configured server.

---

## 📝 Tasks

### Task 1: GitHub MCP ⭐

**Role**: Connect Claude to your GitHub account via the official GitHub MCP server.

**Responsibilities**: Install and configure the GitHub MCP server; ensure it is registered and running without errors; perform at least one interaction (e.g. list recent pull requests, summarize commits, or create an issue) and capture the result of prompting against your repository.

**Success criteria**: GitHub MCP is configured with valid credentials; at least one successful interaction; **screenshot(s) of the MCP call results** included in deliverables.

---

### Task 2: Filesystem MCP ⭐

**Role**: Connect Claude/Copilot to a directory on your machine via the Filesystem MCP server.

**Responsibilities**: Install and configure the Filesystem MCP server with a path to a directory (e.g. a project folder); ensure it is registered and running; perform at least one interaction (e.g. list files, read a file, or summarize directory structure) and capture the result.

**Success criteria**: Filesystem MCP is configured with a valid path; at least one successful interaction; **screenshot(s) of the MCP call results** included in deliverables.

---

### Task 3: Jira or Notion MCP ⭐⭐

**Role**: Connect Claude to Jira or Notion via the corresponding MCP server so the AI can query your project.

**Responsibilities**: Install and configure the Jira or Notion MCP server with the required credentials; ensure it is registered and running; **make the following request**: *"Give me the tickets/pages of the last 5 bugs on a project"* (use a real project you have access to). Capture the full response. Avoid sharing sensitive information — use only ticket/page numbers to represent the working response.

**Success criteria**: Jira or Notion MCP is configured and working; the request for the last 5 bug tickets/pages returns valid results; **screenshots of the MCP call results** (request and response) are included in deliverables.

---

### Task 4: Custom MCP Server with FastMCP ⭐⭐⭐

**Role**: Build and connect your own MCP server implementation so Claude/Copilot can read dynamic resource content.

**Responsibilities**:
- Create the custom MCP server in a **separate folder** (e.g. `custom-mcp-server/`) with `server.py` implementing FastMCP.
- Add a **Resource** URI that reads from `lorem-ipsum.md`, accepts a `word_count` parameter (default: `30`), and returns exactly that many words from the file.
- Add a **Tool** named `read` that Claude can call; it should take an optional `word_count` parameter and return the content from the resource.
- Include a short explanation in your docs:
  - Resources are URIs that Claude can read from (e.g., files, APIs).
  - Tools are actions Claude can call to perform operations (e.g., reading a file, running a command).
- Add a `HOWTORUN.md` that explains how to **install dependencies**, **run the server**, **connect MCP configuration**, and **use/test the `read` tool**.
- Verify and document:
  - The starting script/command works.
  - MCP configuration is valid and points to your custom server.
  - `fastmcp` is present in project dependencies.

**Success criteria**: `server.py` works with FastMCP; resource and `read` tool both return expected word-limited content; setup instructions are complete and reproducible; startup command and MCP config are verified; `fastmcp` dependency is explicitly included; **screenshots of successful MCP calls/results** are included in deliverables.

---

## 📦 Deliverables

| Deliverable | Description |
|-------------|-------------|
| **MCP configurations** | `mcp.json` / `.mcp.json` with all four servers registered |
| **Custom MCP server** | `custom-mcp-server/server.py` with resource and `read` tool |
| **Dependencies file** | `requirements.txt` or `pyproject.toml` including `fastmcp` |
| **Lorem ipsum source** | `custom-mcp-server/lorem-ipsum.md` used by the resource |
| **Screenshots** | In `docs/screenshots/`: results for each MCP server interaction |
| **Documentation** | `README.md` (description, author name) and `HOWTORUN.md` (install, run, connect, and usage instructions) |

**Submission**: Proper README with author name; PR with summary and screenshots; all server configurations committed to repo.

---

## 📁 Expected Project Structure

```
homework-5/
├── README.md                          (description of work and author name)
├── HOWTORUN.md                        (install, run, connect, and usage instructions)
├── custom-mcp-server/
│   ├── server.py                      (custom FastMCP server)
│   ├── lorem-ipsum.md                 (source text for resource output)
│   └── requirements.txt or pyproject.toml  (must include fastmcp)
├── mcp.json / .mcp.json               (server configuration used by your client)
└── docs/
    └── screenshots/
        ├── github-mcp-result.png
        ├── filesystem-mcp-result.png
        ├── jira-or-notion-mcp-result.png
        └── custom-mcp-read-tool-result.png
```

---

<div align="center">Good luck! Submit via the course homework repository as specified in the program.</div>
