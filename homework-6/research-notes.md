# Research Notes — context7 queries

During code generation (Agent 2) the **context7** MCP server was used to look up
the two frameworks this pipeline depends on: Python's `decimal` module for money
math, and **FastMCP** for the custom MCP server. Each query below records what was
searched, the library id context7 returned, and the concrete pattern applied in
the code.

> Reproduce in Claude Code: enable the `context7` server via `/mcp` (configured in
> [`mcp.json`](./mcp.json)), then ask e.g. *"use context7 to look up the Python
> decimal module"*. The two calls map to `resolve-library-id` → `query-docs`.
>
> ✅ **Verified live** against the connected `context7` MCP server (2026-06-21);
> the library IDs below are the actual values returned by `resolve-library-id`.

---

## Query 1 — Decimal / monetary arithmetic in Python

- **Search:** "Python decimal module — ROUND_HALF_UP quantize for currency"
- **context7 library id:** `/python/cpython` (module `decimal`)
- **Key insight applied:**
  - Build every `Decimal` from a **string** (`Decimal(str(amount))`) so JSON values
    like `"9999.99"` never pick up binary `float` error.
  - Use `quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)` to round fees and
    settled amounts to the cent deterministically.
- **Where:** [`agents/common.py`](./agents/common.py) `parse_amount()` and
  [`agents/settlement_processor.py`](./agents/settlement_processor.py)
  `compute_settlement()` (e.g. `9999.99 * 0.001 = 9.99999` → fee `10.00`).

## Query 2 — FastMCP server: tools and resources

- **Search:** "FastMCP Python server @mcp.tool and @mcp.resource resource templates"
- **context7 library id:** `/prefecthq/fastmcp` (also surfaced: `/websites/gofastmcp`)
- **Returned snippet (verbatim from context7):**
  ```python
  from fastmcp import FastMCP
  mcp = FastMCP("MyServer")

  @mcp.tool
  def hello(name: str) -> str:
      return f"Hello, {name}!"

  if __name__ == "__main__":
      mcp.run()  # Uses STDIO transport by default
  ```
- **Key insight applied:**
  - Instantiate one `FastMCP("pipeline-status")` and register **tools** with the
    `@mcp.tool` decorator and a **resource** with `@mcp.resource("pipeline://summary")`.
  - Tools take typed arguments (`transaction_id: str`) and return strings; resources
    are addressed by URI and return text — matching the assignment's required surface.
  - Launch on the default stdio transport with `mcp.run()`.
- **Where:** [`mcp/server.py`](./mcp/server.py) — `get_transaction_status`,
  `list_pipeline_results`, and the `pipeline://summary` resource.

---

## (Bonus) Query 3 — pytest-cov coverage reporting

- **Search:** "pytest-cov generate JSON coverage report for a gate"
- **context7 library id:** `/pytest-dev/pytest-cov`
- **Key insight applied:** `--cov-report=json:coverage.json` emits a machine-readable
  report whose `totals.percent_covered` the coverage-gate hook reads to block a push
  below 80%.
- **Where:** [`pytest.ini`](./pytest.ini) and
  [`.claude/hooks/coverage_gate.py`](./.claude/hooks/coverage_gate.py).
