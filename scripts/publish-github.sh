#!/usr/bin/env bash
set -euo pipefail

repo="${1:-}"
visibility="${2:---private}"
if [[ -z "$repo" ]]; then
  echo "usage: $0 owner/repo [--private|--public]" >&2
  exit 2
fi
if ! command -v gh >/dev/null 2>&1; then
  echo 'GitHub CLI (gh) is required.' >&2
  exit 2
fi

git diff --quiet && git diff --cached --quiet || {
  echo 'Refusing to publish with uncommitted changes.' >&2
  exit 1
}

if git remote get-url origin >/dev/null 2>&1; then
  echo 'origin already exists:'
  git remote get-url origin
  echo 'Push explicitly after verifying the target.'
  exit 1
fi

gh repo create "$repo" "$visibility" --source=. --remote=origin --push
printf '\nPublished canonical SHA: '
git rev-parse HEAD
