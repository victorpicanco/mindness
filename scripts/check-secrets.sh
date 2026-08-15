#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "check-secrets: $1" >&2
  exit 1
}

ENV_EXAMPLE="apps/api/.env.example"

# Every backend-only var name declared in apps/api/.env.example (i.e. not NEXT_PUBLIC_-prefixed)
# must never leak verbatim into apps/web/ — that's the client bundle.
if [ -f "$ENV_EXAMPLE" ]; then
  while IFS='=' read -r name _; do
    case "$name" in
      ''|'#'*|NEXT_PUBLIC_*) continue ;;
    esac
    if git grep --quiet --fixed-strings "$name" -- 'apps/web/' 2>/dev/null; then
      fail "found backend env var '$name' under apps/web/"
    fi
  done < <(grep -v '^[[:space:]]*#' "$ENV_EXAMPLE" | grep -v '^[[:space:]]*$')
fi

if git grep --quiet --extended-regexp 'NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY|TOKEN)[A-Z0-9_]*' -- . 2>/dev/null; then
  fail "found a NEXT_PUBLIC_* variable containing SECRET, SERVICE_ROLE, PRIVATE_KEY or TOKEN"
fi

echo "check-secrets: ok"
