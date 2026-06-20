# Custom MCP Server — How to Run

Focused guide for the `lorem-reader` FastMCP server.

---

## Install dependencies

```bash
cd homework-5/custom-mcp-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`requirements.txt` includes `fastmcp>=2.0.0`.

---

## Run the server

```bash
python server.py
```

Starts in stdio mode for MCP clients. Press `Ctrl+C` to stop.

---

## Connect MCP configuration

The server is registered in `homework-5/mcp.json`:

```json
"lorem-reader": {
  "command": "python3",
  "args": ["${workspaceFolder}/homework-5/custom-mcp-server/server.py"]
}
```

Copy to Cursor:

```bash
cp homework-5/mcp.json .cursor/mcp.json
```

Enable **lorem-reader** in Cursor Settings → MCP.

---

## Use and test

### Tool: `read`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `word_count` | int | 30 | Number of words to return |

**Prompt:** `Use the read tool with word_count=15`

### Resource: `lorem://text`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `word_count` | query param | 30 | Number of words to return |

**Prompt:** `Read lorem://text?word_count=30`

Both return words from `lorem-ipsum.md` in order.

---

## Expected output (first 10 words)

```
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
```

---

## Resources vs Tools

- **Resource** (`lorem://text`) — passive URI the AI reads; like fetching a URL
- **Tool** (`read`) — active function the AI calls with parameters

Both use the same `_read_words()` logic in `server.py`.
