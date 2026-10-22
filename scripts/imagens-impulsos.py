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
OPERADOR='''<g stroke="#10130c" stroke-width="3" stroke-linejoin="round">
 <!-- operador de airsoft ilustrado, de perfil, em postura de tiro, fuzil apontando para a esquerda -->
 <defs>
  <pattern id="malha" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#262922"/><path d="M0 0L6 6M6 0L0 6" stroke="#4d5245" stroke-width="1"/></pattern>
  <linearGradient id="lente" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0b44a"/><stop offset="1" stop-color="#8a4512"/></linearGradient>
  <clipPath id="cl-perna"><path d="M1002 448 L1062 452 L1006 596 L998 714 L962 714 L966 592 Z"/></clipPath>
  <clipPath id="cl-perna2"><path d="M1044 450 L1104 450 L1116 590 L1152 712 L1116 720 L1078 598 Z"/></clipPath>
 </defs>
 <!-- perna de trás (mais escura) -->
 <path d="M1044 450 L1104 450 L1116 590 L1152 712 L1116 720 L1078 598 Z" fill="#41452a"/>
 <g clip-path="url(#cl-perna2)" stroke="none" fill="#34381f"><ellipse cx="1080" cy="500" rx="22" ry="12"/><ellipse cx="1120" cy="640" rx="18" ry="26"/><ellipse cx="1096" cy="560" rx="10" ry="18" fill="#525634"/></g>
 <ellipse cx="1096" cy="590" rx="17" ry="23" fill="#1f211b"/>
 <path d="M1110 708 L1152 706 L1160 744 L1090 744 Q1090 722 1110 708 Z" fill="#5e4e35"/>
 <!-- mochila de hidratação -->
 <path d="M1092 272 L1126 284 L1130 402 L1104 412 Z" fill="#4b5031"/>
 <!-- braço do gatilho (lado de trás) -->
 <path d="M1056 290 L1046 336 L994 286" fill="none" stroke="#10130c" stroke-width="32" stroke-linecap="round"/>
 <path d="M1056 290 L1046 336 L994 286" fill="none" stroke="#43472b" stroke-width="26" stroke-linecap="round"/>
 <!-- fuzil -->
 <g fill="#1c1e1b">
  <path d="M1000 246 L1046 250 L1048 292 L1014 296 L996 270 Z"/>
  <rect x="900" y="242" width="106" height="26" rx="3"/>
  <path d="M930 266 L956 266 L952 320 L928 316 Z"/>
  <path d="M978 266 L994 266 L1002 304 L986 306 Z"/>
  <rect x="818" y="244" width="84" height="22" rx="3"/>
  <rect x="782" y="251" width="38" height="8"/>
  <rect x="766" y="248" width="16" height="14" rx="2"/>
  <path d="M842 264 L858 264 L856 294 L842 294 Z"/>
  <rect x="956" y="236" width="16" height="8"/>
  <rect x="938" y="222" width="52" height="16" rx="6"/>
 </g>
 <g stroke="none" fill="#3c4038">
  <rect x="904" y="245" width="98" height="4"/><rect x="822" y="247" width="76" height="3"/>
  <rect x="942" y="225" width="44" height="3"/><rect x="826" y="252" width="6" height="10"/><rect x="840" y="252" width="6" height="10"/><rect x="854" y="252" width="6" height="10"/><rect x="868" y="252" width="6" height="10"/><rect x="882" y="252" width="6" height="10"/>
 </g>
 <circle cx="940" cy="230" r="5" fill="#e88a2e" stroke="none"/>
 <circle cx="990" cy="284" r="13" fill="#1d1f1a"/>
 <!-- perna da frente, joelho flexionado, calça camuflada -->
 <path d="M1002 448 L1062 452 L1006 596 L998 714 L962 714 L966 592 Z" fill="#5b5f3a"/>
 <g clip-path="url(#cl-perna)" stroke="none">
  <ellipse cx="1020" cy="480" rx="20" ry="11" fill="#7a7f4e"/><ellipse cx="990" cy="540" rx="14" ry="22" fill="#3f432a"/>
  <ellipse cx="1040" cy="520" rx="10" ry="16" fill="#3f432a"/><ellipse cx="980" cy="650" rx="16" ry="20" fill="#7a7f4e"/>
  <ellipse cx="1000" cy="690" rx="10" ry="14" fill="#3f432a"/><rect x="1020" y="468" width="20" height="40" rx="4" fill="#4d5232"/>
 </g>
 <ellipse cx="986" cy="592" rx="18" ry="24" fill="#262821"/>
 <path d="M978 576 Q986 570 994 576" fill="none" stroke="#4a4d42" stroke-width="3"/>
 <path d="M958 708 L1000 708 L1004 744 L936 744 Q934 724 958 708 Z" fill="#7a6544"/>
 <path d="M936 736 L1004 736 L1004 744 L936 744 Z" fill="#2a2419"/>
 <!-- tronco: farda e colete tático coyote -->
 <path d="M990 262 L1068 256 Q1098 268 1102 310 L1108 432 Q1078 448 1040 450 L1000 448 Q984 360 990 262 Z" fill="#5b5f3a"/>
 <path d="M996 270 L1064 264 Q1090 276 1094 314 L1098 426 Q1074 438 1040 440 L1006 438 Q992 360 996 270 Z" fill="#a88b5c"/>
 <path d="M976 282 L998 270 L1004 422 L982 426 Z" fill="#96794d"/>
 <path d="M1010 280 L1060 276" fill="none" stroke="#c2a574" stroke-width="3"/>
 <g fill="#b89a68"><rect x="998" y="330" width="26" height="42" rx="4"/><rect x="1030" y="330" width="26" height="42" rx="4"/><rect x="1062" y="330" width="26" height="42" rx="4"/></g>
 <g fill="#8a7048" stroke-width="2"><rect x="998" y="330" width="26" height="12" rx="3"/><rect x="1030" y="330" width="26" height="12" rx="3"/><rect x="1062" y="330" width="26" height="12" rx="3"/></g>
 <rect x="1040" y="290" width="34" height="22" rx="3" fill="#8a7048" stroke-width="2"/>
 <rect x="1044" y="294" width="26" height="14" rx="2" fill="#e07a2e" stroke="none"/>
 <rect x="998" y="430" width="108" height="16" fill="#3b3526"/>
 <rect x="1036" y="428" width="20" height="20" rx="2" fill="#8c8c80" stroke-width="2"/>
 <!-- pescoço com balaclava, rosto, máscara de tela e óculos -->
 <rect x="1004" y="236" width="46" height="34" fill="#4b5031"/>
 <path d="M974 172 L1064 172 L1062 224 Q1050 248 1020 250 L992 248 Q978 240 974 224 Z" fill="#4b5031"/>
 <path d="M1012 196 L1040 196 L1040 214 Q1026 222 1012 214 Z" fill="#c99a74" stroke-width="2"/>
 <path d="M964 204 L996 204 L1000 246 L974 246 Q962 230 964 204 Z" fill="url(#malha)"/>
 <rect x="966" y="184" width="40" height="18" rx="7" fill="#1d1f1a"/>
 <rect x="970" y="187" width="32" height="12" rx="5" fill="url(#lente)" stroke="none"/>
 <path d="M974 190 L986 190" stroke="#fff3d6" stroke-width="2"/>
 <rect x="1004" y="188" width="60" height="7" fill="#1d1f1a" stroke="none"/>
 <!-- capacete com capa coyote, trilho, suporte de NVG e abafador -->
 <path d="M962 168 C962 118 996 96 1030 98 C1066 100 1086 126 1084 166 L1076 176 L966 178 Z" fill="#9c8556"/>
 <path d="M978 128 C994 108 1022 104 1046 110" fill="none" stroke="#c9ad78" stroke-width="5" stroke-linecap="round"/>
 <rect x="1004" y="120" width="26" height="16" rx="3" fill="#86703f" stroke-width="2"/>
 <rect x="996" y="146" width="68" height="9" rx="3" fill="#2a2c25"/>
 <rect x="954" y="142" width="16" height="22" rx="3" fill="#2a2c25"/>
 <circle cx="1044" cy="176" r="17" fill="#2a2c25"/>
 <circle cx="1044" cy="176" r="8" fill="#3e4137" stroke="none"/>
 <path d="M1032 188 Q1010 222 990 226" fill="none" stroke="#1d1f1a" stroke-width="4"/>
 <!-- braço de apoio (lado da frente) e luvas -->
 <path d="M1024 288 L936 308 L862 270" fill="none" stroke="#10130c" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
 <path d="M1024 288 L936 308 L862 270" fill="none" stroke="#5b5f3a" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
 <path d="M1008 284 L940 298" fill="none" stroke="#7a7f4e" stroke-width="6" stroke-linecap="round"/>
 <circle cx="936" cy="308" r="15" fill="#262821"/>
 <circle cx="854" cy="268" r="15" fill="#1d1f1a"/>
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
