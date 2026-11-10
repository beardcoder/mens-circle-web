#!/bin/sh
# PreToolUse (Edit|Write): generated files are never hand-edited (CLAUDE.md, "Generated files").
f=$(jq -r '.tool_input.file_path // empty')
rel=${f#"$CLAUDE_PROJECT_DIR"/}

case "$rel" in
  brand/tokens.* | brand/palette.*) how='bun run brand:export (source: src/styles/theme.css)' ;;
  brand/logo/logo-*.svg | public/images/logo* | public/favicon*) how='bun run brand:logo (source: brand/logo/logo.svg)' ;;
  public/images/og-*.png) how='bun run brand:render --install' ;;
  drizzle/meta/*) how='bun run db:generate (source: src/lib/server/db/schema.ts)' ;;
  bun.lock) how='bun install' ;;
  *) exit 0 ;;
esac

echo "$rel is generated; do not edit it by hand. Run: $how" >&2
exit 2
