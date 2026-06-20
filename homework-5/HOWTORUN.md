# How to Run

Step-by-step guide to configure, connect, and test all four MCP servers.

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ |
| Python | 3.11+ |
| npm / npx | Latest |
| Cursor IDE | With MCP support |
| GitHub account | For GitHub MCP |
| Atlassian Cloud + Jira | For Atlassian MCP |

---

## Step 1: Install custom MCP server dependencies

```bash
cd homework-5/custom-mcp-server
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

---

## Step 2: Connect MCP configuration to Cursor

Cursor reads MCP config from `.cursor/mcp.json` at the **repository root**.

```bash
# From repository root
mkdir -p .cursor
cp homework-5/mcp.json .cursor/mcp.json
```

Restart Cursor or toggle servers in **Settings → MCP**.

---

## Step 3: Enable and authenticate each server

### 3.1 GitHub MCP

1. Enable **github** in Settings → MCP
2. Set PAT: `export GITHUB_PAT=ghp_your_token_here`
3. Restart Cursor to pick up the environment variable

**Test prompt:**

```
List the 3 most recent pull requests in gen-ai-software-engineering
```

**Screenshot:** `docs/screenshots/github-mcp-result.png`

---

### 3.2 Filesystem MCP

1. Enable **filesystem** in Settings → MCP
2. No authentication required
3. Scoped to `${workspaceFolder}/homework-5` only

**Test prompt:**

```
List all files in homework-5 and read the first 10 lines of TASKS.md
```

**Screenshot:** `docs/screenshots/filesystem-mcp-result.png`

---

### 3.3 Atlassian Jira MCP

1. Enable **atlassian** in Settings → MCP
2. Complete OAuth in browser (Atlassian account)

**Test prompt (required by TASKS.md):**

```
Give me the tickets of the last 5 bugs on project YOUR_PROJECT_KEY
```

Replace `YOUR_PROJECT_KEY` with your Jira project key.

**Screenshot:** `docs/screenshots/jira-or-notion-mcp-result.png`  
Show ticket keys only (e.g. `ABC-123`), redact titles and descriptions.

---

### 3.4 Custom Lorem Reader MCP

1. Enable **lorem-reader** in Settings → MCP
2. Requires Python 3.11+ and `fastmcp` installed (Step 2)
3. See [custom-mcp-server/HOWTORUN.md](./custom-mcp-server/HOWTORUN.md) for server-specific details

**Test prompts:**

```
Use the read tool with word_count=10
```

```
Read the lorem://text resource with word_count=30
```

**Screenshot:** `docs/screenshots/custom-mcp-read-tool-result.png`

---

## Step 4: Manual server smoke test (custom MCP)

```bash
cd homework-5/custom-mcp-server
source .venv/bin/activate
python server.py
```

Server starts in stdio mode (waits for MCP client input). Stop with `Ctrl+C`.  
If it starts without error, the startup command works.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| MCP server not listed | Copy `homework-5/mcp.json` → `.cursor/mcp.json`, restart Cursor |
| GitHub auth fails | Set `export GITHUB_PAT=ghp_...` and restart Cursor |
| Atlassian auth fails | Re-run OAuth flow in Settings → MCP → atlassian → Authenticate |
| Filesystem access denied | Path must be inside `homework-5/` scope |
| `lorem-reader` won't start | Run `pip install -r requirements.txt` in venv |
| `npx` slow on first run | Normal — downloads `@modelcontextprotocol/server-filesystem` |

---

## Environment variables

Set before launching Cursor (GitHub PAT only):

```bash
export GITHUB_PAT=ghp_your_token_here
```

Never commit tokens — they are read via `${env:GITHUB_PAT}` in `mcp.json`.

---

## Deliverables checklist

- [ ] `mcp.json` with all 4 servers
- [ ] `custom-mcp-server/server.py` with resource + `read` tool
- [ ] `requirements.txt` includes `fastmcp`
- [ ] 4 screenshots in `docs/screenshots/`
- [ ] README.md with author name
- [ ] This HOWTORUN.md
