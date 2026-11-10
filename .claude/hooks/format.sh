#!/bin/sh
# PostToolUse (Edit|Write): blank lines and import order (eslint), then prettier, on the one file.
f=$(jq -r '.tool_input.file_path // empty')

case "$f" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac

cd "$CLAUDE_PROJECT_DIR" || exit 0

case "$f" in
  *.ts | *.tsx | *.astro | *.js | *.mjs) bunx eslint --fix "$f" >/dev/null 2>&1 ;;
esac

# .prettierignore keeps generated and vendored files out
bunx prettier --write --ignore-unknown "$f" >/dev/null 2>&1
exit 0
