#!/usr/bin/env bash
# 产物部署使用
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-5000}"

# ==================== 工具函数 ====================
info() {
  echo "[INFO] $1"
}
warn() {
  echo "[WARN] $1"
}
error() {
  echo "[ERROR] $1"
  exit 1
}

# ============== 启动服务 ======================
info "开始执行：pnpm run start (server)"
cd "$ROOT_DIR/server"
exec pnpm run start
