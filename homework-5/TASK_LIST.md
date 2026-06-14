# ✅ Detailed Task List — Homework 5: MCP Servers

Each step is atomic. Mark `[x]` as you complete it.
📸 = mandatory screenshot in `docs/screenshots/`.

> Commands are for **Claude Code CLI** (`claude mcp ...`). `claude mcp add` creates/updates
> `.mcp.json` itself, no need to do it separately. After each connection: restart Claude Code
> and run `/mcp` to see the **connected** status.
> If the CLI isn't available in the terminal — add the server to `.mcp.json` manually (example at the end of each section).

---

## Task 1: GitHub MCP ⭐

- [x] 1.1 Create the screenshots folder: `cd homework-5 && mkdir -p docs/screenshots`
- [x] 1.2 Create a GitHub Personal Access Token: GitHub → Settings → Developer settings →
  Personal access tokens. Scope `repo` (+ `read:org` if needed). Copy the token.
- [x] 1.3 Check whether the server is already connected: `claude mcp list` (look for `github`).
- [x] 1.4 If not — add the official GitHub remote MCP (transport http + Bearer token):
  ```bash
  claude mcp add -s user --transport http github https://api.githubcopilot.com/mcp \
    -H "Authorization: Bearer $GITHUB_PERSONAL_ACCESS_TOKEN"
  ```
  Source: github/github-mcp-server → docs/installation-guides/install-claude.md
- [x] 1.5 Restart Claude Code, run `/mcp` → `github` must be **connected**.
- [x] 1.6 Run the specific request in chat:
  > "Using the GitHub MCP, list the 5 most recent commits in the repo
  >  `Nastasia27/gen-ai-software-engineering` and summarize them."

  (alternative: "list my open pull requests" / "create an issue titled 'test MCP'")
- [x] 1.7 📸 `docs/screenshots/github-mcp-result.png` — both the request and the MCP response are visible.

**Example `.mcp.json` entry:**
```json
"github": {
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp",
  "headers": { "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}" }
}
```

---

## Task 2: Filesystem MCP ⭐

- [ ] 2.1 Check whether it already exists: `claude mcp list` (look for `filesystem`).
- [ ] 2.2 If not — add it with a path to an allowed directory (e.g. `homework-5` itself):
  ```bash
  claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem \
    /Users/anastasiakopiika/Documents/FrontEnd/gen-ai-software-engineering/homework-5
  ```
- [ ] 2.3 Restart Claude Code, `/mcp` → `filesystem` **connected**.
- [ ] 2.4 Run the specific request:
  > "Using the Filesystem MCP, list all files in the homework-5 directory
  >  and summarize the folder structure."

  (alternative: "read the file TASKS.md and give me a 3-line summary")
- [ ] 2.5 📸 `docs/screenshots/filesystem-mcp-result.png` — request + result.

**Example `.mcp.json` entry:**
```json
"filesystem": {
  "command": "npx",
  "args": ["-y","@modelcontextprotocol/server-filesystem",
           "/Users/anastasiakopiika/Documents/FrontEnd/gen-ai-software-engineering/homework-5"]
}
```

---

## Task 3: Jira **or** Notion MCP ⭐⭐

> Pick ONE system where you have a real project. Both options are below.

### Option A — Notion
- [ ] 3A.1 Create an internal integration: notion.so/my-integrations → copy the token (`ntn_...`).
- [ ] 3A.2 Grant the integration access to the needed page/database (Share → Connect).
- [ ] 3A.3 Add the server:
  ```bash
  claude mcp add --transport http notion https://mcp.notion.com/mcp
  ```

### Option B — Jira (Atlassian)
- [ ] 3B.1 Create an API token: id.atlassian.com → Security → API tokens.
- [ ] 3B.2 Add the official Atlassian MCP (remote, OAuth in the browser on connect):
  ```bash
  claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse
  ```

### Shared steps
- [ ] 3.4 Restart Claude Code, `/mcp` → server **connected** (complete auth if prompted).
- [ ] 3.5 Run the **exact request from the assignment**:
  > "Give me the tickets/pages of the last 5 bugs on a project"

  (substitute the name of a real project).
- [ ] 3.6 ⚠️ Before the screenshot, remove sensitive data — keep only the ticket/page **numbers**.
- [ ] 3.7 📸 `docs/screenshots/jira-or-notion-mcp-result.png` — request + response (anonymized).

---

## Task 4: Custom MCP Server (FastMCP) ⭐⭐⭐

### 4.0 Check tooling (needed only here)
- [ ] 4.0.1 `python3 --version`
- [ ] 4.0.2 `uv --version`; if missing — `brew install uv`
- [ ] 4.0.3 Create the folder: `mkdir -p custom-mcp-server`

### 4.1 Server files
- [ ] 4.1.1 `custom-mcp-server/lorem-ipsum.md` — source text (> 30 words).
- [ ] 4.1.2 `custom-mcp-server/requirements.txt` with the line `fastmcp` (or `pyproject.toml`).
- [ ] 4.1.3 `custom-mcp-server/server.py` using FastMCP:
  - [ ] **Resource** with a URI (e.g. `lorem://words`), reads `lorem-ipsum.md`, accepts
        `word_count` (default `30`), returns exactly that many words.
  - [ ] **Tool** `read(word_count: int = 30)` — returns the content from the same resource.

### 4.2 Install and run locally
- [ ] 4.2.1 Install dependencies: `cd custom-mcp-server && uv pip install -r requirements.txt`
- [ ] 4.2.2 Verify the server starts without errors: `uv run server.py`

### 4.3 Connect to Claude
- [ ] 4.3.1 Add the custom server:
  ```bash
  claude mcp add custom-lorem -- uv run \
    /Users/anastasiakopiika/Documents/FrontEnd/gen-ai-software-engineering/homework-5/custom-mcp-server/server.py
  ```
- [ ] 4.3.2 Restart Claude Code, `/mcp` → `custom-lorem` **connected**.

### 4.4 Test the `read` tool
- [ ] 4.4.1 Request: > "Use the custom-lorem MCP `read` tool to return 10 words."
- [ ] 4.4.2 Request: > "Now call `read` with the default word_count and show the result."
  (verify default = 30 words, and the parameter limits the count).
- [ ] 4.4.3 📸 `docs/screenshots/custom-mcp-read-tool-result.png` — `read` call + result.

**Example `.mcp.json` entry:**
```json
"custom-lorem": {
  "command": "uv",
  "args": ["run",".../homework-5/custom-mcp-server/server.py"]
}
```

---

## Task 5: Documentation

- [ ] 5.1 `homework-5/README.md`:
  - [ ] description of the work + **author name**;
  - [ ] explanation: **Resources** = URIs that Claude *reads* (files, APIs); **Tools** = actions
        that Claude *calls* (read a file, run a command).
- [ ] 5.2 `homework-5/HOWTORUN.md`: install dependencies → run the server →
      connect the MCP config → how to call/test the `read` tool.

---

## Task 6: Final check and submission

- [ ] 6.1 All **4** servers registered in `.mcp.json` (github, filesystem, jira/notion, custom-lorem).
- [ ] 6.2 All 4 screenshots in place in `docs/screenshots/`:
  - [ ] `github-mcp-result.png`
  - [ ] `filesystem-mcp-result.png`
  - [ ] `jira-or-notion-mcp-result.png`
  - [ ] `custom-mcp-read-tool-result.png`
- [ ] 6.3 `fastmcp` explicitly present in `requirements.txt` / `pyproject.toml`.
- [ ] 6.4 Folder structure matches `TASKS.md`.
- [ ] 6.5 ⚠️ NO tokens in commits. Add `.gitignore`, keep real tokens in env
      or in `.mcp.json` that is not committed.
- [ ] 6.6 Open a PR with summary and embedded screenshots; README with author name.
