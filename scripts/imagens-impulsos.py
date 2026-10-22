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
OPERADOR='''<g fill="#0a0d08">
 <!-- jogador de airsoft de perfil, em postura de tiro, fuzil no ombro apontando para a esquerda -->
 <!-- mochila de hidratação -->
 <path d="M1092 272 L1126 284 L1130 402 L1104 412 Z"/>
 <!-- perna de trás, esticada -->
 <path d="M1044 450 L1104 450 L1116 590 L1152 712 L1116 720 L1078 598 Z"/>
 <path d="M1110 708 L1152 706 L1160 744 L1090 744 Q1090 722 1110 708 Z"/>
 <!-- perna da frente, joelho flexionado -->
 <path d="M1002 448 L1062 452 L1006 596 L998 714 L962 714 L966 592 Z"/>
 <path d="M958 708 L1000 708 L1004 744 L936 744 Q934 724 958 708 Z"/>
 <!-- tronco com colete -->
 <path d="M990 262 L1068 256 Q1098 268 1102 310 L1108 432 Q1078 448 1040 450 L1000 448 Q984 360 990 262 Z"/>
 <path d="M976 282 L998 270 L1004 422 L982 426 Z"/>
 <!-- pescoço, rosto com máscara, capacete -->
 <rect x="1004" y="236" width="46" height="34"/>
 <path d="M974 172 L1064 172 L1062 224 Q1050 248 1020 250 L992 248 Q978 240 974 224 Z"/>
 <path d="M964 204 L994 204 L998 246 L974 246 Q962 230 964 204 Z"/>
 <path d="M962 168 C962 118 996 96 1030 98 C1066 100 1086 126 1084 166 L1076 176 L966 178 Z"/>
 <rect x="954" y="144" width="14" height="20" rx="3"/>
 <!-- fuzil -->
 <path d="M1000 246 L1046 250 L1048 292 L1014 296 L996 270 Z"/>
 <rect x="900" y="242" width="106" height="26" rx="3"/>
 <rect x="938" y="222" width="52" height="16" rx="6"/>
 <rect x="956" y="236" width="16" height="8"/>
 <path d="M930 266 L956 266 L952 320 L928 316 Z"/>
 <path d="M978 266 L994 266 L1002 304 L986 306 Z"/>
 <rect x="818" y="244" width="84" height="22" rx="3"/>
 <rect x="782" y="251" width="38" height="8"/>
 <rect x="766" y="248" width="16" height="14" rx="2"/>
 <path d="M842 264 L858 264 L856 294 L842 294 Z"/>
 <!-- braços: apoio na empunhadura da frente e mão no gatilho -->
 <path d="M1024 288 L936 308 L862 270" fill="none" stroke="#0a0d08" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
 <circle cx="854" cy="268" r="15"/>
 <path d="M1056 290 L1046 336 L994 286" fill="none" stroke="#0a0d08" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
 <circle cx="990" cy="284" r="13"/>
 <!-- detalhes: óculos, protetor auricular, trilho, bolsos, cinto, joelheiras -->
 <g fill="#1b2216">
  <rect x="970" y="186" width="36" height="16" rx="6"/>
  <rect x="1004" y="190" width="60" height="6"/>
  <circle cx="1044" cy="178" r="15"/>
  <rect x="1000" y="136" width="62" height="7" rx="3"/>
  <rect x="998" y="330" width="26" height="40" rx="4"/>
  <rect x="1030" y="330" width="26" height="40" rx="4"/>
  <rect x="1062" y="330" width="26" height="40" rx="4"/>
  <rect x="998" y="434" width="108" height="14"/>
  <ellipse cx="986" cy="592" rx="18" ry="24"/>
  <ellipse cx="1096" cy="590" rx="17" ry="23"/>
  <path d="M968 210 L992 210 L994 240 L976 240 Z" opacity="0.6"/>
 </g>
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
