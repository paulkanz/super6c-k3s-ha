#!/usr/bin/env bash
# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# Copyright (c) 2026 Paul Kanz <kanzpaul@gmail.com>
# ==============================================================================
# Script: build-and-import-nodeapp.sh
# Purpose: Build NodeApp ARM64 container image and import directly into K3s containerd
# ==============================================================================
set -euo pipefail

IMAGE_TAG="${1:-0.2.2}"
IMAGE_NAME="nodeapp:${IMAGE_TAG}"
WORKER_NODES=("kube-4" "kube-5" "kube-6")
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${PROJECT_ROOT}/apps/NodeApp"

echo "========================================================"
echo " 🚀 Building & Distributing NodeApp (${IMAGE_NAME})"
echo "========================================================"

# 1. Ensure Docker is running
if ! docker info >/dev/null 2>&1; then
  echo "⚠️  Docker daemon is not running."
  echo "   Attempting to start Docker Desktop on macOS..."
  open -a Docker
  echo -n "   Waiting for Docker daemon to become responsive..."
  until docker info >/dev/null 2>&1; do
    echo -n "."
    sleep 2
  done
  echo " Connected!"
fi

# 2. Build the ARM64 image
echo ""
echo "📦 Building container image for linux/arm64..."
docker buildx build \
  --platform linux/arm64 \
  -t "${IMAGE_NAME}" \
  --load \
  "${APP_DIR}"

echo "✅ Successfully built ${IMAGE_NAME}"

# 3. Stream and import into K3s containerd on all worker nodes
echo ""
echo "📤 Distributing image to K3s worker nodes (${WORKER_NODES[*]})..."

for node in "${WORKER_NODES[@]}"; do
  echo "   ==> Streaming ${IMAGE_NAME} to ${node}..."
  docker save "${IMAGE_NAME}" | ssh -o ConnectTimeout=5 "${ANSIBLE_USER:-admin}@${node}" 'sudo k3s ctr images import -'
  echo "   ✅ Imported on ${node}"
done

echo ""
echo "🎉 Image distribution complete! All worker nodes have ${IMAGE_NAME} loaded in containerd."
echo "👉 You can now deploy the manifests using: ansible-playbook playbooks/09-nodeapp.yml"
echo "   or directly via: kubectl apply -f templates/nodeapp.yaml"
