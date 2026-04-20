## Code writing instructions
 - Do not use emojis in any code
 - Use tenacity for retries when querying APIs
 - replace print statements with logging
 - When trying to fix code through multiple iterations make sure to clean up the old iterations before trying something new
 - Remove dead code immediately after refactors
 - Before removing any field from a parser or schema, check all places it may be required: spec files (source_rules.spec.json), validation logic, processed output samples, and README
 - Prefer single-responsibility functions with clear names
 - Avoid copy-paste divergence across files
 - Handle edge cases explicitly (empty inputs, missing data, partial failures)
 - Update docs when behavior or data flows change
 - Before v1.0 production, do not keep legacy/historical compatibility code paths; remove superseded code instead of preserving it for history


## Testing expectations
 - Add or update tests whenever behavior changes, new features are introduced, or bugs are fixed
 - Prefer unit tests for core logic; add integration tests when multiple modules interact
 - Test edge cases and failure modes (empty inputs, invalid configs, missing data, etc.)
 - Keep tests deterministic; seed randomness and avoid network calls
 - Use pytest by default for Python; keep tests fast and isolated
 - Add lightweight smoke tests for new workflows or CLI paths
 - If tests are skipped, state why and provide a manual verification step

## Command hygiene
 - If a long-running command is interrupted or times out, check for partial artifacts (e.g., `node_modules` temp dirs) and either clean the affected paths or recommend a clean install before retrying.

## MCPs
  - Only use the Context7 MCP when I explicitly ask for it
  - 

## Chat interactions
  - When preparing for significant changes, please ask any clarifying questions upfront to avoid back-and-forth
  - When the user asks a question (e.g. "what is the problem", "why did X happen"), answer the question only — do not change any code or run any commands unless explicitly instructed to do so

## Tooling
  - Use pnpm for package management instead of npm or yarn
  - use poetry for python package management
