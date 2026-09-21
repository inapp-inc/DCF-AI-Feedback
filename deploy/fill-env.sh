#!/usr/bin/env bash
# Fill deploy/.env from example + HF token sources. Safe to source.
# Expects ROOT. Optional: ENV_FILE, FILL_ENV_REQUIRED=1 (fail if no hf_ token).

env_file_get() {
  local file=$1 key=$2
  [[ -f "$file" ]] || return 0
  awk -F= -v k="$key" '
    $0 ~ "^" k "=" {
      sub(/^[^=]+=/, "")
      gsub(/\r/, "")
      print
      exit
    }
  ' "$file"
}

env_file_set() {
  local file=$1 key=$2 value=$3
  local tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$value" '
    BEGIN { done = 0 }
    index($0, k "=") == 1 { print k "=" v; done = 1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$file" >"$tmp"
  mv "$tmp" "$file"
}

find_hf_token() {
  local token=""
  local f key
  token="${HF_API_TOKEN:-}"
  if [[ "$token" != hf_* ]]; then
    token="${HUGGINGFACE_API_KEY:-}"
  fi
  if [[ "$token" != hf_* ]]; then
    for f in \
      "${ENV_FILE:-}" \
      "$ROOT/deploy/.env" \
      "$ROOT/docker/.env" \
      "$ROOT/podman/.env" \
      "$ROOT/codebase/backend/.env"
    do
      [[ -n "$f" && -f "$f" ]] || continue
      for key in HF_API_TOKEN HUGGINGFACE_API_KEY; do
        token="$(env_file_get "$f" "$key")"
        if [[ "$token" == hf_* ]]; then
          echo "$token"
          return 0
        fi
      done
    done
    echo ""
    return 0
  fi
  echo "$token"
}

ensure_env_file_exists() {
  local example="$ROOT/deploy/.env.example"
  mkdir -p "$(dirname "$ENV_FILE")"
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ ! -f "$example" ]]; then
      echo "Error: missing $example" >&2
      return 1
    fi
    cp "$example" "$ENV_FILE"
    echo "==> Created $ENV_FILE from deploy/.env.example"
  fi
}

# Copy keys that exist in .env.example but not in ENV_FILE (do not overwrite).
merge_example_keys() {
  local example="$ROOT/deploy/.env.example"
  [[ -f "$example" && -f "$ENV_FILE" ]] || return 0
  local line key
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line//$'\r'/}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      if ! grep -qE "^${key}=" "$ENV_FILE"; then
        echo "${key}=${BASH_REMATCH[2]}" >>"$ENV_FILE"
      fi
    fi
  done < "$example"
}

fill_deploy_env() {
  ENV_FILE="${ENV_FILE:-$ROOT/deploy/.env}"
  ensure_env_file_exists || return 1
  merge_example_keys

  local current token
  current="$(env_file_get "$ENV_FILE" HF_API_TOKEN)"
  if [[ "$current" != hf_* ]]; then
    current="$(env_file_get "$ENV_FILE" HUGGINGFACE_API_KEY)"
  fi
  token="$current"
  if [[ "$token" != hf_* ]]; then
    token="$(find_hf_token)"
  fi

  if [[ "$token" == hf_* ]]; then
    env_file_set "$ENV_FILE" "HF_API_TOKEN" "$token"
    env_file_set "$ENV_FILE" "HUGGINGFACE_API_KEY" "$token"
    echo "==> HF token set in $ENV_FILE"
  else
    if [[ "${FILL_ENV_REQUIRED:-0}" == "1" ]]; then
      echo "Error: no Hugging Face token found." >&2
      echo "  Set HF_API_TOKEN in deploy/.env, docker/.env, podman/.env, or codebase/backend/.env" >&2
      return 1
    fi
    echo "==> WARN: HF_API_TOKEN is empty; AI will use fallback heuristics." >&2
  fi
}
