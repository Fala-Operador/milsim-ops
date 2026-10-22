# Gera as imagens padrão dos tipos de impulso (tema airsoft) em SVG, 1200x800.
# Uso: python3 scripts/imagens-impulsos.py <pasta>; depois converta cada SVG em JPEG
# (ex.: captura no Chromium com qualidade 86) e grave em public/impulsos/<tipo>.jpg.
import sys, os, base64
# Foto do operador: "In his sight", U.S. Army Europe (Flickr), em domínio público
# (Public Domain Mark 1.0): https://www.flickr.com/photos/37585279@N03/8971347622
# scripts/impulsos-operador.jpg é a foto espelhada e com cor mais fechada.
TIPOS=[("24h","24H","IMPULSO RELÂMPAGO","#e8b04b",1),("3d","3 DIAS","IMPULSO TÁTICO","#d9a441",2),("5d","5 DIAS","IMPULSO DE ASSALTO","#c98f3a",3),
("7d","7 DIAS","IMPULSO DE OPERAÇÃO","#e07a2f",4),("15d","15 DIAS","IMPULSO DE CAMPANHA","#d65a2a",5),("30d","30 DIAS","IMPULSO ESTRATÉGICO","#c0392b",6)]
W,H=1200,800
FOTO=base64.b64encode(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"impulsos-operador.jpg"),"rb").read()).decode()
OPERADOR=f'''<image href="data:image/jpeg;base64,{FOTO}" x="0" y="-40" width="1280" height="854" preserveAspectRatio="none"/>'''
for i,(id_,dur,titulo,cor,nivel) in enumerate(TIPOS):
    chevrons="".join(f'<path d="M{70+k*46} 640 l32 -36 l-32 -36 h22 l32 36 l-32 36z" fill="{cor if k<nivel else "#ffffff"}" opacity="{1 if k<nivel else 0.18}"/>' for k in range(6))
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
 <linearGradient id="v" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b0f09" stop-opacity="0.95"/><stop offset="0.55" stop-color="#0b0f09" stop-opacity="0.6"/><stop offset="1" stop-color="#0b0f09" stop-opacity="0.15"/></linearGradient>
 <radialGradient id="g" cx="0.83" cy="0.45" r="0.5"><stop offset="0" stop-color="{cor}" stop-opacity="0.55"/><stop offset="1" stop-color="{cor}" stop-opacity="0"/></radialGradient>
 <pattern id="mira" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity="0.05"/></pattern>
</defs>
<rect width="{W}" height="{H}" fill="#2a3322"/>
{OPERADOR}
<rect width="{W}" height="{H}" fill="url(#g)" opacity="0.5"/>
<rect width="{W}" height="{H}" fill="url(#mira)"/>
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
