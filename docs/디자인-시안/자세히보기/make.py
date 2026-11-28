# 자세히 보기 화면 시안 4가지 (2026-11-28) — 실제 제품·호수 데이터(data.json)로 HTML 을 만들고, shoot.js 가 PNG 로 찍는다.
# 규칙: 검정 바탕 · 흰 글자 · 핑크는 #FF007B 하나 · 그라데이션/빛 번짐 없음 · 실제 색은 제품 사진과 호수 색만
import json, io, os

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(io.open(os.path.join(HERE, 'data.json'), encoding='utf-8'))
P, S = D['p'], D['s']
IMG = '../../../public/' + P['image_url']
SEL = next(s for s in S if s['no'] == '04')  # 지금 바른 호수 (시안에서는 품절 상태로 보여 준다)
NAME_ONLY = lambda s: s['name'].split(' ', 1)[1] if ' ' in s['name'] else s['name']

BASE = '''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:900px;height:1440px;background:#000;color:#fff;overflow:hidden;
 font-family:"Pretendard Variable",Pretendard,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-0.02em}
.dim{color:rgba(255,255,255,.55)} .pink{color:#FF007B}
.x{position:absolute;right:44px;top:44px;width:64px;height:64px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5);display:grid;place-items:center}
.x svg{width:26px;height:26px;stroke:#fff;stroke-width:2.4;stroke-linecap:round;fill:none}
%s
</style></head><body>%s</body></html>'''
X = '<div class="x"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></div>'

def dots(shades, cls, sel=SEL, label=True):
    out = []
    for s in shades:
        on = ' on' if s is sel else ''
        lab = f'<span>{s["no"]}</span>' if label else ''
        out.append(f'<div class="{cls}{on}"><i style="background:{s["hex"]}"></i>{lab}</div>')
    return ''.join(out)

# ---------- A. 에디토리얼: 큰 타이포 + 큰 호수 숫자 + 가로 호수 띠 ----------
A_CSS = '''
.top{position:absolute;left:44px;top:62px;font-size:15px;font-weight:700;letter-spacing:.04em}
.photo{position:absolute;right:44px;top:150px;width:330px;height:330px;border-radius:24px;object-fit:cover;background:#fff}
.brand{position:absolute;left:44px;top:156px;font-size:20px;font-weight:600}
.name{position:absolute;left:44px;top:192px;width:440px;word-break:keep-all;font-size:64px;line-height:1.08;font-weight:800;letter-spacing:-0.045em}
.price{position:absolute;left:44px;top:430px;font-size:30px;font-weight:700}
.rule{position:absolute;left:44px;right:44px;height:1px;background:rgba(255,255,255,.2)}
.lab{position:absolute;left:44px;font-size:15px;font-weight:700;letter-spacing:.04em}
.big{position:absolute;left:44px;top:600px;display:flex;align-items:center;gap:36px}
.big i{width:200px;height:200px;border-radius:50%}
.big b{display:block;font-size:150px;line-height:.9;font-weight:800;letter-spacing:-0.06em}
.big span{display:block;margin-top:14px;font-size:30px;font-weight:700}
.strip{position:absolute;left:44px;top:860px;display:flex;gap:18px;width:2000px}
.c{display:flex;flex-direction:column;align-items:center;gap:10px}
.c i{width:76px;height:76px;border-radius:50%}
.c span{font-size:15px;font-weight:600;color:rgba(255,255,255,.55)}
.c.on i{box-shadow:0 0 0 4px #000,0 0 0 6px #fff} .c.on span{color:#fff;font-weight:800}
.more{position:absolute;right:44px;top:820px;font-size:16px;font-weight:600}
.out{position:absolute;left:44px;top:1060px;font-size:56px;font-weight:800;letter-spacing:-0.04em}
.out em{font-style:normal;color:#FF007B}
.store{position:absolute;left:44px;top:1150px;font-size:36px;font-weight:800}
.meta{position:absolute;left:44px;top:1206px;font-size:20px;font-weight:500}
.q{position:absolute;right:44px;top:1140px;text-align:right}
.q b{display:block;font-size:96px;line-height:1;font-weight:800;letter-spacing:-0.05em}
.q span{font-size:17px;font-weight:600}
.others{position:absolute;left:44px;right:44px;top:1290px;display:flex;justify-content:space-between;font-size:18px;font-weight:500}
.others b{color:#fff;font-weight:800;margin-left:8px}
'''
A_HTML = f'''{X}<div class="top dim">DETAIL</div>
<img class="photo" src="{IMG}">
<div class="brand dim">{P["brand"]}</div><div class="name">{P["name"]}</div>
<div class="price">{P["price"]:,}원</div>
<div class="rule" style="top:520px"></div><div class="lab dim" style="top:552px">지금 바른 호수</div>
<div class="big"><i style="background:{SEL["hex"]}"></i><div><b>{SEL["no"]}</b><span>{NAME_ONLY(SEL)}</span></div></div>
<div class="more dim">39가지 · 옆으로 밀기 →</div>
<div class="strip">{dots(S[:14], "c")}</div>
<div class="rule" style="top:1010px"></div><div class="lab dim" style="top:1030px">재고</div>
<div class="out">이 매장 <em>품절</em></div>
<div class="store">올리브영 대학로점</div><div class="meta dim">가장 가까운 구매 가능 매장 · 도보 34분 · 2.6km · 11:00–22:00</div>
<div class="q"><b>4</b><span class="dim">개 남음</span></div>
<div class="rule" style="top:1266px"></div>
<div class="others dim"><span>중앙로점 · 도보 10분<b>2개</b></span><span>시청점 · 도보 16분<b>13개</b></span><span>터미널점 · 도보 25분<b>13개</b></span></div>'''

# ---------- B. 컬러 필드: 위 절반을 고른 호수 색 단색 면으로 ----------
B_CSS = '''
.field{position:absolute;left:0;top:0;width:900px;height:640px;background:%s}
.field .no{position:absolute;left:44px;bottom:118px;font-size:200px;line-height:.85;font-weight:800;letter-spacing:-0.07em}
.field .nm{position:absolute;left:52px;bottom:62px;font-size:34px;font-weight:700}
.field .tag{position:absolute;left:52px;top:64px;font-size:15px;font-weight:700;letter-spacing:.04em}
.x{box-shadow:none;background:rgba(0,0,0,.35)}
.photo{position:absolute;right:44px;top:540px;width:200px;height:200px;border-radius:50%%;object-fit:cover;background:#fff;box-shadow:0 0 0 8px #000}
.info{position:absolute;left:44px;top:676px;width:560px}
.info span{font-size:19px;font-weight:600}
.info b{display:block;margin-top:6px;font-size:38px;line-height:1.2;font-weight:800}
.info em{display:block;margin-top:8px;font-style:normal;font-size:26px;font-weight:700}
.grid{position:absolute;left:44px;right:44px;top:900px;display:grid;grid-template-columns:repeat(10,1fr);gap:14px 0}
.g i{display:block;margin:0 auto;width:58px;height:58px;border-radius:50%%}
.g.on i{box-shadow:0 0 0 3px #000,0 0 0 5px #fff}
.h{position:absolute;left:44px;font-size:22px;font-weight:800} .h span{font-size:16px;font-weight:600;margin-left:8px}
.row{position:absolute;left:44px;right:44px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,.2);padding:22px 0}
.row .l{font-size:20px;font-weight:600} .row .l small{display:block;font-size:15px;font-weight:500;margin-top:4px}
.row b{font-size:30px;font-weight:800}
.pill{display:inline-block;padding:6px 14px;border-radius:999px;background:#FF007B;color:#fff;font-size:14px;font-weight:800;margin-right:12px;vertical-align:middle;letter-spacing:0}
'''
B_HTML = f'''<div class="field"><div class="tag">지금 바른 호수</div><div class="no">{SEL["no"]}</div><div class="nm">{NAME_ONLY(SEL)}</div></div>{X}
<img class="photo" src="{IMG}">
<div class="info"><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div>
<div class="h" style="top:850px">호수<span class="dim">39가지 · 누르면 입술에</span></div>
<div class="grid">{dots(S[:30], "g", label=False)}</div>
<div class="h" style="top:1180px">재고</div>
<div class="row" style="top:1222px"><div class="l"><span class="pill">품절</span>이 매장</div><b class="dim">0</b></div>
<div class="row" style="top:1310px"><div class="l">올리브영 대학로점<small class="dim">가장 가까운 매장 · 도보 34분 · 2.6km</small></div><b>4개</b></div>'''

# ---------- C. 인덱스(레포트북 무드): 왼쪽 번호 칸 + 오른쪽 내용 ----------
C_CSS = '''
.idx{position:absolute;left:44px;width:150px;font-size:15px;font-weight:700;letter-spacing:.12em}
.idx b{display:block;font-size:44px;letter-spacing:-0.03em;color:#FF007B;margin-bottom:6px}
.vr{position:absolute;left:214px;top:150px;bottom:60px;width:1px;background:rgba(255,255,255,.2)}
.hr{position:absolute;left:44px;right:44px;height:1px;background:rgba(255,255,255,.2)}
.ttl{position:absolute;left:44px;top:58px;font-size:26px;font-weight:800}
.body{position:absolute;left:250px;right:44px}
.p1{top:180px;display:flex;gap:28px}
.p1 img{width:220px;height:220px;border-radius:18px;object-fit:cover;background:#fff}
.p1 span{font-size:18px;font-weight:600} .p1 b{display:block;margin:6px 0 10px;font-size:34px;line-height:1.2;font-weight:800}
.p1 em{font-style:normal;font-size:24px;font-weight:700}
.now{top:440px;display:flex;align-items:center;gap:18px;font-size:22px;font-weight:700}
.now i{width:48px;height:48px;border-radius:50%}
.grid{top:620px;display:grid;grid-template-columns:repeat(6,1fr);gap:22px 0}
.g{display:flex;flex-direction:column;align-items:center;gap:8px}
.g i{width:64px;height:64px;border-radius:50%} .g span{font-size:13px;font-weight:600;color:rgba(255,255,255,.55)}
.g.on i{box-shadow:0 0 0 3px #000,0 0 0 5px #fff} .g.on span{color:#fff;font-weight:800}
table{border-collapse:collapse;width:100%;font-size:19px}
td{padding:18px 0;border-top:1px solid rgba(255,255,255,.2);font-weight:500;color:rgba(255,255,255,.7)}
td:last-child{text-align:right;color:#fff;font-weight:800;font-size:24px}
tr.best td{color:#fff;font-weight:800;font-size:24px} tr.best td:last-child{font-size:30px}
.st{top:1090px} .st p{font-size:18px;font-weight:700;margin-bottom:12px}
'''
C_HTML = f'''<div class="ttl">제품 정보</div>{X}
<div class="vr"></div>
<div class="idx" style="top:180px"><b>01</b>제품</div>
<div class="body p1"><img src="{IMG}"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div></div>
<div class="body now"><i style="background:{SEL["hex"]}"></i><span><span class="dim" style="font-size:16px;display:block">지금 바른 호수</span>{SEL["name"]}</span></div>
<div class="hr" style="top:540px"></div>
<div class="idx" style="top:580px"><b>02</b>호수<br><span class="dim" style="letter-spacing:0;font-weight:600">39가지</span></div>
<div class="body grid">{dots(S[:24], "g")}</div>
<div class="hr" style="top:1050px"></div>
<div class="idx" style="top:1090px"><b>03</b>재고</div>
<div class="body st"><p><span class="pink">●</span> 이 매장은 품절이에요</p><table>
<tr class="best"><td>올리브영 대학로점 · 도보 34분</td><td>4개</td></tr>
<tr><td>올리브영 중앙로점 · 도보 10분</td><td>2개</td></tr>
<tr><td>올리브영 시청점 · 도보 16분</td><td>13개</td></tr></table></div>'''

# ---------- D. 컬러 칩 덱: 세로로 긴 칩을 넘겨 보는 팔레트 + 아래 고정 재고 바 ----------
D_CSS = '''
.bar{position:absolute;left:44px;right:140px;top:44px;height:64px;display:flex;align-items:center;gap:18px}
.bar img{width:64px;height:64px;border-radius:14px;object-fit:cover;background:#fff}
.bar span{font-size:15px;font-weight:600} .bar b{display:block;font-size:22px;font-weight:800}
.hero{position:absolute;left:44px;top:180px;font-size:15px;font-weight:700;letter-spacing:.04em}
.hn{position:absolute;left:44px;top:214px;font-size:88px;line-height:1;font-weight:800;letter-spacing:-0.05em}
.hs{position:absolute;left:48px;top:318px;font-size:22px;font-weight:600}
.price{position:absolute;right:44px;top:250px;font-size:30px;font-weight:800}
.deck{position:absolute;left:44px;top:420px;display:flex;align-items:flex-end;gap:12px;height:440px;width:2000px}
.k{width:72px;height:330px;border-radius:14px;position:relative}
.k span{position:absolute;left:0;right:0;bottom:-34px;text-align:center;font-size:15px;font-weight:700;color:rgba(255,255,255,.55)}
.k.on{height:440px;width:150px}
.k.on span{color:#fff;font-size:18px}
.k.on::after{content:"";position:absolute;left:0;right:0;bottom:-52px;height:4px;border-radius:2px;background:#FF007B}
.hint{position:absolute;left:44px;top:930px;font-size:17px;font-weight:600}
.dock{position:absolute;left:24px;right:24px;bottom:24px;height:300px;border-radius:36px;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.25);padding:34px 40px}
.dock .s{font-size:17px;font-weight:700}
.dock .s i{display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF007B;margin-right:10px}
.dock .n{margin-top:18px;font-size:44px;font-weight:800;letter-spacing:-0.03em}
.dock .m{margin-top:8px;font-size:19px;font-weight:500}
.dock .q{position:absolute;right:40px;top:96px;text-align:right}
.dock .q b{font-size:84px;line-height:1;font-weight:800;letter-spacing:-0.05em} .dock .q span{display:block;font-size:17px;font-weight:600}
.dock .o{position:absolute;left:40px;right:40px;bottom:30px;font-size:17px;font-weight:500;border-top:1px solid rgba(255,255,255,.2);padding-top:18px}
'''
deck = []
for s in S[1:12]:
    on = ' on' if s is SEL else ''
    deck.append(f'<div class="k{on}" style="background:{s["hex"]}"><span>{s["no"]}</span></div>')
D_HTML = f'''<div class="bar"><img src="{IMG}"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b></div></div>{X}
<div class="hero dim">지금 바른 호수</div><div class="hn">{NAME_ONLY(SEL)}</div><div class="hs dim">No.{SEL["no"]} · 39가지 중</div>
<div class="price">{P["price"]:,}원</div>
<div class="deck">{"".join(deck)}</div>
<div class="hint dim">칩을 옆으로 넘기면 바로 입술에 발라져요</div>
<div class="dock"><div class="s"><i></i>이 매장은 품절이에요 · 가장 가까운 매장</div>
<div class="n">올리브영 대학로점</div><div class="m dim">도보 34분 · 2.6km · 11:00–22:00</div>
<div class="q"><b>4</b><span class="dim">개 남음</span></div>
<div class="o dim">중앙로점 2개 · 시청점 13개 · 터미널점 13개</div></div>'''

for key, css, html in [('A', A_CSS, A_HTML), ('B', B_CSS % SEL['hex'], B_HTML), ('C', C_CSS, C_HTML), ('D', D_CSS, D_HTML)]:
    io.open(os.path.join(HERE, f'시안{key}.html'), 'w', encoding='utf-8').write(BASE.replace('%s', css, 1).replace('%s', html, 1))
print('ok')
