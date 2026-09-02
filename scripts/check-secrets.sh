#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "check-secrets: $1" >&2
  exit 1
}

ENV_EXAMPLE="apps/api/.env.example"

# NODE_ENV, PORT and HOST are standard Node/Docker runtime variables that any
# service declares independently; they are not secrets and apps/web owns its
# own values for them.
ALLOWED_SHARED_NAMES="NODE_ENV PORT HOST"

if [ -f "$ENV_EXAMPLE" ]; then
  while IFS='=' read -r name _; do
    case "$name" in
      ''|'#'*|NEXT_PUBLIC_*) continue ;;
    esac
    case " $ALLOWED_SHARED_NAMES " in
      *" $name "*) continue ;;
    esac
    if git grep --quiet --word-regexp --fixed-strings "$name" -- 'apps/web/' 2>/dev/null; then
      fail "found backend env var '$name' under apps/web/"
    fi
  done < <(grep -v '^[[:space:]]*#' "$ENV_EXAMPLE" | grep -v '^[[:space:]]*$')
fi

if git grep --quiet --extended-regexp 'NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE_KEY|TOKEN)[A-Z0-9_]*' -- . 2>/dev/null; then
  fail "found a NEXT_PUBLIC_* variable containing SECRET, SERVICE_ROLE, PRIVATE_KEY or TOKEN"
fi

echo "check-secrets: ok"
