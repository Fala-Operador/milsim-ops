#!/usr/bin/env python3
# Publica só os modelos de e-mail do Supabase Auth (assunto e HTML de
# [auth.email.template.*] no config.toml) pela Management API. Não usa
# `supabase config push`, que enviaria o config.toml inteiro (site_url,
# provedores, limites...) e poderia sobrescrever o que foi ajustado no painel.
# Usa SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF do ambiente do GitHub.
import json, os, sys, tomllib, urllib.request, urllib.error

# Nome no config.toml → nome do campo na Management API.
MODELOS = {"confirmation": "confirmation", "recovery": "recovery"}

with open("supabase/config.toml", "rb") as f:
    modelos = tomllib.load(f)["auth"]["email"]["template"]

corpo = {}
for nome, campo in MODELOS.items():
    m = modelos[nome]
    with open(os.path.join("supabase", m["content_path"].removeprefix("./supabase/")), encoding="utf-8") as f:
        corpo[f"mailer_templates_{campo}_content"] = f.read()
    corpo[f"mailer_subjects_{campo}"] = m["subject"]

ref = os.environ["SUPABASE_PROJECT_REF"]
pedido = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    data=json.dumps(corpo).encode(), method="PATCH",
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(pedido, timeout=30) as r:
        print(f"Modelos de e-mail publicados em {ref}: {', '.join(MODELOS)} (HTTP {r.status}).")
except urllib.error.HTTPError as e:
    print(f"::error::Falha ao publicar os modelos de e-mail em {ref}: HTTP {e.code} {e.read().decode()[:500]}")
    sys.exit(1)
