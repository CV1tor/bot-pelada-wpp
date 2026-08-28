#!/usr/bin/env bash

set -euo pipefail

versao="${1:?A versão semântica é obrigatória}"
repositorio="${GITHUB_REPOSITORY,,}"
imagem="ghcr.io/${repositorio}"
versao_maior="${versao%%.*}"
versao_sem_maior="${versao#*.}"
versao_menor="${versao_sem_maior%%.*}"

docker buildx build \
  --platform linux/amd64 \
  --cache-from type=gha \
  --cache-to type=gha,mode=max \
  --label "org.opencontainers.image.source=${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}" \
  --label "org.opencontainers.image.revision=${GITHUB_SHA}" \
  --label "org.opencontainers.image.version=${versao}" \
  --tag "${imagem}:${versao}" \
  --tag "${imagem}:${versao_maior}.${versao_menor}" \
  --tag "${imagem}:${versao_maior}" \
  --tag "${imagem}:latest" \
  --push \
  .
