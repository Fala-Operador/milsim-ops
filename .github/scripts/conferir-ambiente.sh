#!/usr/bin/env bash
# Confere, antes de qualquer comando da Supabase CLI, que o ambiente do GitHub
# (AMBIENTE: production ou homologacao) tem token, senha e ref do projeto, e que
# a homologação nunca aponta para o projeto de produção (por exemplo, herdando
# a variável SUPABASE_PROJECT_REF do repositório).
set -euo pipefail

REF_PRODUCAO="fezrmoyjsffufdjptamp"

faltando=()
[ -n "${SUPABASE_ACCESS_TOKEN:-}" ] || faltando+=("segredo SUPABASE_ACCESS_TOKEN")
[ -n "${SUPABASE_DB_PASSWORD:-}" ] || faltando+=("segredo SUPABASE_DB_PASSWORD")
[ -n "${SUPABASE_PROJECT_REF:-}" ] || faltando+=("variável SUPABASE_PROJECT_REF")
if [ ${#faltando[@]} -gt 0 ]; then
  for item in "${faltando[@]}"; do
    echo "::error::Ambiente ${AMBIENTE}: falta $item (Settings → Environments → ${AMBIENTE})."
  done
  exit 1
fi

if [ "$AMBIENTE" != "production" ] && [ "$SUPABASE_PROJECT_REF" = "$REF_PRODUCAO" ]; then
  echo "::error::Ambiente ${AMBIENTE} aponta para o projeto de produção ($REF_PRODUCAO). Defina SUPABASE_PROJECT_REF do projeto de homologação no ambiente."
  exit 1
fi

echo "Ambiente ${AMBIENTE} → projeto ${SUPABASE_PROJECT_REF}"
