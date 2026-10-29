#!/usr/bin/env python3
# Publica só os modelos de e-mail do Supabase Auth (assunto e HTML de cada
# [auth.email.template.*] e [auth.email.notification.*] do config.toml) pela
# Management API. Não usa `supabase config push`, que enviaria o config.toml
# inteiro (site_url, provedores, limites...) e poderia sobrescrever o que foi
# ajustado no painel. Também não liga nem desliga avisos de segurança: isso
# continua no painel. Usa SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF do
# ambiente do GitHub.
import json, os, sys, tomllib, urllib.request, urllib.error

with open("supabase/config.toml", "rb") as f:
    email = tomllib.load(f)["auth"]["email"]

# Nome do campo na Management API: mailer_subjects_<nome> e mailer_templates_<nome>_content,
# com o sufixo _notification nos avisos de segurança.
modelos = {nome: m for nome, m in email.get("template", {}).items()}
modelos |= {f"{nome}_notification": m for nome, m in email.get("notification", {}).items()}

corpo = {}
for nome, m in modelos.items():
    with open(os.path.join("supabase", m["content_path"].removeprefix("./supabase/")), encoding="utf-8") as f:
        corpo[f"mailer_templates_{nome}_content"] = f.read()
    corpo[f"mailer_subjects_{nome}"] = m["subject"]

ref = os.environ["SUPABASE_PROJECT_REF"]
pedido = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{ref}/config/auth",
    data=json.dumps(corpo).encode(), method="PATCH",
    headers={"Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}", "Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(pedido, timeout=30) as r:
        print(f"Modelos de e-mail publicados em {ref}: {', '.join(modelos)} (HTTP {r.status}).")
except urllib.error.HTTPError as e:
    print(f"::error::Falha ao publicar os modelos de e-mail em {ref}: HTTP {e.code} {e.read().decode()[:500]}")
    sys.exit(1)
