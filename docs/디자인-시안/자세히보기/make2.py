# 자세히 보기 시안 2차 E~H (2026-11-28, "다른 시안"). 규칙은 1차와 같다: 검정 바탕 · 흰 글자 · 핑크 #FF007B 하나 · 그라데이션 없음
# E 링(앱의 원형 다이얼과 같은 말투) · F 스와치 자국 목록 · G 문장으로 말해 주는 미니멀 · H 왼쪽 세로 호수 레일 + 큰 색 면
import json, io, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(io.open(os.path.join(HERE, 'data.json'), encoding='utf-8'))
P, S = D['p'], D['s']
IMG = '../../../public/' + P['image_url']
SEL = next(s for s in S if s['no'] == '04')
nm = lambda s: s['name'].split(' ', 1)[1] if ' ' in s['name'] else s['name']

BASE = '''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:900px;height:1440px;background:#000;color:#fff;overflow:hidden;position:relative;
 font-family:"Pretendard Variable",Pretendard,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-0.02em;word-break:keep-all}
.dim{color:rgba(255,255,255,.55)} .pink{color:#FF007B}
.x{position:absolute;right:44px;top:44px;width:64px;height:64px;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,.5);display:grid;place-items:center}
.x svg{width:26px;height:26px;stroke:#fff;stroke-width:2.4;stroke-linecap:round;fill:none}
@@CSS@@
</style></head><body>@@HTML@@</body></html>'''
X = '<div class="x"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></div>'

# ---------- E. 링: 가운데 큰 원 = 지금 바른 색, 둘레에 39가지 호수가 원으로 ----------
cx, cy, R = 450, 700, 320
ring = []
for i, s in enumerate(S):
    a = -math.pi / 2 + 2 * math.pi * i / len(S)
    x, y = cx + R * math.cos(a), cy + R * math.sin(a)
    on = ' on' if s is SEL else ''
    ring.append(f'<i class="d{on}" style="left:{x - 19:.1f}px;top:{y - 19:.1f}px;background:{s["hex"]}"></i>')
E_CSS = f'''
.hd{{position:absolute;left:0;right:0;top:140px;text-align:center}}
.hd span{{font-size:18px;font-weight:600}} .hd b{{display:block;margin-top:6px;font-size:40px;font-weight:800}} .hd em{{display:block;margin-top:6px;font-style:normal;font-size:24px;font-weight:700}}
.core{{position:absolute;left:{cx - 230}px;top:{cy - 230}px;width:460px;height:460px;border-radius:50%;background:{SEL["hex"]};display:flex;flex-direction:column;align-items:center;justify-content:center}}
.core small{{font-size:16px;font-weight:700;opacity:.8}}
.core b{{font-size:150px;line-height:.95;font-weight:800;letter-spacing:-0.06em}}
.core span{{font-size:30px;font-weight:700}}
.d{{position:absolute;width:38px;height:38px;border-radius:50%}}
.d.on{{box-shadow:0 0 0 4px #000,0 0 0 6px #fff;transform:scale(1.25)}}
.photo{{position:absolute;left:44px;top:44px;width:96px;height:96px;border-radius:50%;object-fit:cover;background:#fff}}
.hint{{position:absolute;left:0;right:0;top:1060px;text-align:center;font-size:17px;font-weight:600}}
.st{{position:absolute;left:44px;right:44px;top:1130px;border-top:1px solid rgba(255,255,255,.2);padding-top:34px;text-align:center}}
.st p{{font-size:19px;font-weight:700}} .st p i{{display:inline-block;width:10px;height:10px;border-radius:50%;background:#FF007B;margin-right:10px;vertical-align:2px}}
.st b{{display:block;margin-top:14px;font-size:44px;font-weight:800;letter-spacing:-0.03em}}
.st span{{display:block;margin-top:10px;font-size:20px;font-weight:500}}
'''
E_HTML = f'''<img class="photo" src="{IMG}">{X}
<div class="hd"><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div>
{"".join(ring)}
<div class="core"><small>지금 바른 호수</small><b>{SEL["no"]}</b><span>{nm(SEL)}</span></div>
<div class="hint dim">둘레의 색을 누르면 바로 입술에 · 39가지</div>
<div class="st"><p><i></i>이 매장은 품절이에요</p><b>올리브영 대학로점 · 4개</b><span class="dim">가장 가까운 매장 · 도보 34분 · 2.6km · 11:00–22:00</span></div>'''

# ---------- F. 스와치 자국: 팔에 발라 본 것 같은 긴 자국 + 이름 목록 ----------
rows = []
for s in S[:16]:
    on = ' on' if s is SEL else ''
    rows.append(f'<div class="r{on}"><i style="background:{s["hex"]}"></i><span><b>{s["no"]}</b>{nm(s)}</span></div>')
F_CSS = '''
.head{position:absolute;left:44px;right:140px;top:44px;display:flex;gap:24px;align-items:center}
.head img{width:120px;height:120px;border-radius:20px;object-fit:cover;background:#fff}
.head span{font-size:17px;font-weight:600} .head b{display:block;margin:4px 0 6px;font-size:32px;font-weight:800} .head em{font-style:normal;font-size:22px;font-weight:700}
.lab{position:absolute;left:44px;top:220px;font-size:22px;font-weight:800} .lab span{font-size:16px;font-weight:600;margin-left:8px}
.list{position:absolute;left:44px;right:44px;top:270px;display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:column;grid-template-rows:repeat(8,auto);column-gap:40px}
.r{display:flex;align-items:center;gap:20px;height:78px;border-bottom:1px solid rgba(255,255,255,.12)}
.r i{flex:none;width:170px;height:30px;border-radius:30px 8px 26px 10px / 18px 8px 18px 8px;transform:rotate(-4deg)}
.r span{font-size:18px;font-weight:600;color:rgba(255,255,255,.65)} .r span b{margin-right:8px;color:rgba(255,255,255,.45);font-weight:700}
.r.on i{height:40px;width:190px}
.r.on span{color:#fff;font-weight:800;font-size:21px} .r.on span b{color:#FF007B}
.more{position:absolute;left:44px;top:924px;font-size:17px;font-weight:600}
.st{position:absolute;left:44px;right:44px;top:1010px;border-top:1px solid rgba(255,255,255,.3);padding-top:40px}
.st .k{font-size:17px;font-weight:700}
.st .big{margin-top:16px;font-size:46px;line-height:1.25;font-weight:800;letter-spacing:-0.03em}
.st .big em{font-style:normal;color:#FF007B}
.st .m{margin-top:16px;font-size:20px;font-weight:500}
.st .o{margin-top:34px;display:flex;gap:30px;font-size:18px;font-weight:500} .st .o b{color:#fff;margin-left:6px}
'''
F_HTML = f'''<div class="head"><img src="{IMG}"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div></div>{X}
<div class="lab">호수<span class="dim">누르면 입술에 발라 드려요</span></div>
<div class="list">{"".join(rows)}</div>
<div class="more dim">아래로 밀면 23가지 더 ↓</div>
<div class="st"><div class="k dim">재고</div>
<div class="big">이 매장은 <em>품절</em>이에요.<br>올리브영 대학로점에 4개 있어요.</div>
<div class="m dim">도보 34분 · 2.6km · 11:00–22:00</div>
<div class="o dim"><span>중앙로점<b>2개</b></span><span>시청점<b>13개</b></span><span>터미널점<b>13개</b></span></div></div>'''

# ---------- G. 문장 미니멀: 가운데 정렬, 큰 여백, 말하듯이 ----------
dots_g = ''.join(f'<i class="{"on" if s is SEL else ""}" style="background:{s["hex"]}"></i>' for s in S[:20])
G_CSS = '''
.photo{position:absolute;left:330px;top:150px;width:240px;height:240px;border-radius:50%;object-fit:cover;background:#fff}
.c{position:absolute;left:60px;right:60px;text-align:center}
.brand{top:430px;font-size:18px;font-weight:600}
.name{top:462px;font-size:44px;font-weight:800}
.price{top:526px;font-size:22px;font-weight:600}
.say{top:640px;font-size:38px;line-height:1.4;font-weight:300;letter-spacing:-0.03em}
.say b{font-weight:800}
.say i{display:inline-block;width:34px;height:34px;border-radius:50%;vertical-align:-4px;margin:0 6px}
.row{position:absolute;left:60px;right:60px;top:800px;display:flex;justify-content:space-between;align-items:center}
.row i{width:30px;height:30px;border-radius:50%}
.row i.on{width:52px;height:52px;box-shadow:0 0 0 3px #000,0 0 0 5px #fff}
.cnt{top:870px;font-size:16px;font-weight:600}
.line{position:absolute;left:390px;width:120px;top:960px;height:1px;background:rgba(255,255,255,.3)}
.stock{top:1020px;font-size:38px;line-height:1.45;font-weight:300;letter-spacing:-0.03em}
.stock b{font-weight:800} .stock em{font-style:normal;font-weight:800;color:#FF007B}
.meta{top:1200px;font-size:19px;font-weight:500}
'''
G_HTML = f'''{X}<img class="photo" src="{IMG}">
<div class="c brand dim">{P["brand"]}</div><div class="c name">{P["name"]}</div><div class="c price dim">{P["price"]:,}원</div>
<div class="c say">지금 입술에는<br><i style="background:{SEL["hex"]}"></i><b>{SEL["no"]} {nm(SEL)}</b>를 발랐어요</div>
<div class="row">{dots_g}</div>
<div class="c cnt dim">39가지 중 · 옆으로 밀어 다른 색도 발라 보세요</div>
<div class="line"></div>
<div class="c stock">이 매장엔 <em>없어요.</em><br>가장 가까운 <b>올리브영 대학로점</b>에<br><b>4개</b> 남아 있어요.</div>
<div class="c meta dim">도보 34분 · 2.6km · 11:00–22:00</div>'''

# ---------- H. 왼쪽 세로 호수 레일 + 오른쪽 큰 색 면 ----------
rail = ''.join(f'<div class="rd{" on" if s is SEL else ""}"><i style="background:{s["hex"]}"></i><span>{s["no"]}</span></div>' for s in S[:13])
H_CSS = f'''
.rail{{position:absolute;left:0;top:0;bottom:0;width:170px;border-right:1px solid rgba(255,255,255,.15);padding-top:150px;display:flex;flex-direction:column;align-items:center;gap:22px}}
.rd{{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px}}
.rd i{{width:62px;height:62px;border-radius:50%}}
.rd span{{font-size:14px;font-weight:700;color:rgba(255,255,255,.5)}}
.rd.on span{{color:#fff}}
.rd.on::before{{content:"";position:absolute;left:-54px;top:8px;width:5px;height:46px;border-radius:3px;background:#FF007B}}
.rail .t{{position:absolute;top:64px;font-size:15px;font-weight:700}}
.main{{position:absolute;left:210px;right:44px}}
.top{{top:150px;display:flex;gap:22px;align-items:center}}
.top img{{width:110px;height:110px;border-radius:18px;object-fit:cover;background:#fff}}
.top span{{font-size:17px;font-weight:600}} .top b{{display:block;margin:4px 0;font-size:30px;font-weight:800}} .top em{{font-style:normal;font-size:22px;font-weight:700}}
.sw{{top:320px;height:520px;border-radius:36px;background:{SEL["hex"]}}}
.sw small{{position:absolute;left:40px;top:36px;font-size:16px;font-weight:700;opacity:.85}}
.sw b{{position:absolute;left:36px;bottom:90px;font-size:170px;line-height:.85;font-weight:800;letter-spacing:-0.07em}}
.sw span{{position:absolute;left:42px;bottom:40px;font-size:30px;font-weight:700}}
.sw .hex{{position:absolute;right:40px;bottom:44px;font-size:16px;font-weight:600;opacity:.8;letter-spacing:.04em}}
.st{{top:900px}}
.st .k{{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700}} .st .k i{{width:10px;height:10px;border-radius:50%;background:#FF007B}}
.st .b{{margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.2)}}
.st .b b{{display:block;font-size:38px;font-weight:800}} .st .b span{{display:block;margin-top:8px;font-size:18px;font-weight:500}}
.st .b strong{{font-size:80px;line-height:1;font-weight:800;letter-spacing:-0.05em}} .st .b strong small{{font-size:22px;margin-left:4px}}
.st .r{{display:flex;justify-content:space-between;padding:20px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:19px;font-weight:500;color:rgba(255,255,255,.7)}}
.st .r b{{color:#fff;font-size:22px;font-weight:800}}
'''
H_HTML = f'''<div class="rail"><div class="t dim">호수 39</div>{rail}</div>{X}
<div class="main top"><img src="{IMG}"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div></div>
<div class="main sw"><small>지금 바른 호수</small><b>{SEL["no"]}</b><span>{nm(SEL)}</span><div class="hex">{SEL["hex"]}</div></div>
<div class="main st"><div class="k"><i></i>이 매장은 품절 · 가장 가까운 매장</div>
<div class="b"><div><b>올리브영 대학로점</b><span class="dim">도보 34분 · 2.6km · 11:00–22:00</span></div><strong>4<small>개</small></strong></div>
<div class="r"><span>올리브영 중앙로점 · 도보 10분</span><b>2개</b></div>
<div class="r"><span>올리브영 시청점 · 도보 16분</span><b>13개</b></div></div>'''

for key, css, html in [('E', E_CSS, E_HTML), ('F', F_CSS, F_HTML), ('G', G_CSS, G_HTML), ('H', H_CSS, H_HTML)]:
    io.open(os.path.join(HERE, f'시안{key}.html'), 'w', encoding='utf-8').write(BASE.replace('@@CSS@@', css).replace('@@HTML@@', html))
print('ok')
