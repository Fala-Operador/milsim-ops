# Gera as imagens padrão dos tipos de impulso (tema airsoft) em SVG, 1200x800.
# Uso: python3 scripts/imagens-impulsos.py <pasta>; depois converta cada SVG em JPEG
# (ex.: captura no Chromium com qualidade 86) e grave em public/impulsos/<tipo>.jpg.
import sys, os
import random
TIPOS=[("24h","24H","IMPULSO RELÂMPAGO","#e8b04b",1),("3d","3 DIAS","IMPULSO TÁTICO","#d9a441",2),("5d","5 DIAS","IMPULSO DE ASSALTO","#c98f3a",3),
("7d","7 DIAS","IMPULSO DE OPERAÇÃO","#e07a2f",4),("15d","15 DIAS","IMPULSO DE CAMPANHA","#d65a2a",5),("30d","30 DIAS","IMPULSO ESTRATÉGICO","#c0392b",6)]
W,H=1200,800
def camo(seed):
    r=random.Random(seed); out=[]
    cores=["#3b4a2f","#4f5d3a","#2c3524","#6b6a45","#5a4b33"]
    for _ in range(70):
        cx,cy=r.randint(-100,W+100),r.randint(-100,H+100); n=r.randint(6,9); pts=[]
        import math
        rad=r.randint(50,140)
        for k in range(n):
            a=2*math.pi*k/n; rr=rad*r.uniform(0.55,1.15)
            pts.append(f"{cx+rr*math.cos(a):.0f},{cy+rr*0.7*math.sin(a):.0f}")
        out.append(f'<polygon points="{" ".join(pts)}" fill="{r.choice(cores)}" opacity="0.9"/>')
    return "\n".join(out)
# operator silhouette kneeling with rifle, right side
OPERADOR='''<g transform="translate(820,120)" fill="#0b0e09">
 <!-- capacete com NVG e fone -->
 <path d="M120 60 q60 -50 125 -6 q14 14 12 44 l-150 0 q-2 -24 13 -38z"/>
 <rect x="104" y="92" width="160" height="14" rx="6"/>
 <rect x="150" y="28" width="26" height="30" rx="5"/>
 <circle cx="236" cy="118" r="22"/>
 <!-- rosto e pescoço -->
 <path d="M130 106 h96 v46 q-48 26 -96 0z"/>
 <!-- tronco com plate carrier -->
 <path d="M80 170 q110 -40 220 0 l34 250 q-144 40 -288 0z"/>
 <g fill="#161c12"><rect x="104" y="216" width="46" height="62" rx="6"/><rect x="160" y="216" width="46" height="62" rx="6"/><rect x="216" y="216" width="46" height="62" rx="6"/></g>
 <!-- braço de apoio -->
 <path d="M96 196 q-70 34 -96 96 l40 18 q30 -50 84 -76z"/>
 <!-- fuzil apontado para baixo, à esquerda -->
 <g transform="rotate(18 60 300)">
  <rect x="-150" y="286" width="300" height="26" rx="6"/>
  <rect x="-205" y="292" width="62" height="10" rx="3"/>
  <rect x="-60" y="262" width="110" height="20" rx="5"/>
  <rect x="-20" y="310" width="26" height="62" rx="5" transform="rotate(12 -7 310)"/>
  <rect x="70" y="310" width="22" height="46" rx="5" transform="rotate(-10 81 310)"/>
  <path d="M150 284 l90 -6 l12 52 l-102 -6z"/>
 </g>
 <!-- braço do gatilho -->
 <path d="M300 200 q30 70 -40 128 l-28 -26 q40 -40 26 -84z"/>
 <!-- pernas -->
 <path d="M60 410 h270 l20 300 h-80 l-30 -220 h-50 l-30 220 h-80z"/>
</g>'''
for i,(id_,dur,titulo,cor,nivel) in enumerate(TIPOS):
    chevrons="".join(f'<path d="M{70+k*46} 640 l32 -36 l-32 -36 h22 l32 36 l-32 36z" fill="{cor if k<nivel else "#ffffff"}" opacity="{1 if k<nivel else 0.18}"/>' for k in range(6))
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
 <linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b0f09" stop-opacity="0.95"/><stop offset="0.55" stop-color="#0b0f09" stop-opacity="0.6"/><stop offset="1" stop-color="#0b0f09" stop-opacity="0.15"/></linearGradient>
 <radialGradient id="g" cx="0.83" cy="0.45" r="0.5"><stop offset="0" stop-color="{cor}" stop-opacity="0.55"/><stop offset="1" stop-color="{cor}" stop-opacity="0"/></radialGradient>
 <pattern id="mira" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern>
</defs>
<rect width="{W}" height="{H}" fill="#2a3322"/>
{camo(i*7+3)}
<rect width="{W}" height="{H}" fill="url(#g)"/>
<rect width="{W}" height="{H}" fill="url(#mira)"/>
<g opacity="0.35" stroke="{cor}" stroke-width="3" fill="none"><circle cx="1000" cy="330" r="190"/><circle cx="930" cy="330" r="120"/><path d="M1000 110v100M1000 450v100M780 330h100M1120 330h100"/></g>
{OPERADOR}
<rect width="{W}" height="{H}" fill="url(#v)"/>
<rect x="0" y="0" width="{W}" height="12" fill="{cor}"/>
<rect x="0" y="{H-12}" width="{W}" height="12" fill="{cor}"/>
<g font-family="DejaVu Sans, Arial, sans-serif" fill="#f3efe2">
 <text x="70" y="140" font-size="34" font-weight="700" letter-spacing="8" fill="{cor}">MILSIM OPS · AIRSOFT</text>
 <text x="64" y="380" font-size="{220 if len(dur)<4 else (170 if len(dur)<=6 else 150)}" font-weight="900" letter-spacing="4">{dur}</text>
 <text x="70" y="460" font-size="44" font-weight="800" letter-spacing="3">{titulo}</text>
 <text x="70" y="520" font-size="28" fill="#cfc9b4">Sua operação em destaque na página inicial e na listagem</text>
</g>
{chevrons}
</svg>'''
    open(os.path.join(sys.argv[1] if len(sys.argv) > 1 else ".", f"{id_}.svg"), "w").write(svg)
print("ok")
