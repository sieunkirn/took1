# 자세히 보기 — 스마트 미러 UI 시안 SM1~SM3 (2026-11-28 사용자: "앱 디자인이 아니고 스마트 미러의 UI 처럼").
# 스마트 미러 원칙: 검정 = 거울(필름 뒤 화면이 꺼진 곳에 손님 얼굴이 비친다) → 가운데는 비우고 정보는 가장자리에,
# 칸·면 없이 가늘고 밝은 흰 글자, 멀리서도 한눈에 보이는 큰 숫자. 가운데의 희미한 사람 윤곽은 '거울에 비친 모습' 자리 표시이고,
# 입술만 실제 색(지금 앱의 '입술만 보기'처럼 화면은 검정, 입술 자리에만 고른 색)
import json, io, os, math

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(io.open(os.path.join(HERE, 'data.json'), encoding='utf-8'))
P, S = D['p'], D['s']
SEL = next(s for s in S if s['no'] == '04')
nm = lambda s: s['name'].split(' ', 1)[1] if ' ' in s['name'] else s['name']

BASE = '''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:900px;height:1440px;background:#000;color:#fff;overflow:hidden;position:relative;
 font-family:"Pretendard Variable",Pretendard,sans-serif;-webkit-font-smoothing:antialiased;letter-spacing:-0.01em;word-break:keep-all}
.dim{color:rgba(255,255,255,.5)} .pink{color:#FF007B}
.ab{position:absolute}
.cap{font-size:14px;font-weight:500;letter-spacing:.08em;color:rgba(255,255,255,.45)}
.x{position:absolute;width:56px;height:56px;display:grid;place-items:center}
.x svg{width:30px;height:30px;stroke:rgba(255,255,255,.8);stroke-width:1.4;stroke-linecap:round;fill:none}
.mirror{position:absolute;left:0;top:0;width:900px;height:1440px}
.note{position:absolute;font-size:12px;font-weight:500;color:rgba(255,255,255,.18);letter-spacing:.06em}
@@CSS@@
</style></head><body>@@HTML@@</body></html>'''
X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>'

def mirror(cx=450, cy=560, k=1.0, hex_=SEL['hex']):
    # 거울에 비친 사람 윤곽(아주 희미하게) + 입술만 실제 색
    lx, ly = cx, cy + 128 * k
    w = 56 * k
    lips = (f'M{lx - w},{ly} C{lx - w * .6},{ly - 22 * k} {lx - w * .2},{ly - 24 * k} {lx},{ly - 14 * k} '
            f'C{lx + w * .2},{ly - 24 * k} {lx + w * .6},{ly - 22 * k} {lx + w},{ly} '
            f'C{lx + w * .55},{ly + 30 * k} {lx - w * .55},{ly + 30 * k} {lx - w},{ly} Z')
    return (f'<svg class="mirror" viewBox="0 0 900 1440">'
            f'<g fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.09)" stroke-width="1.5">'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{165 * k}" ry="{215 * k}"/>'
            f'<path d="M{cx - 60 * k},{cy + 200 * k} L{cx - 60 * k},{cy + 270 * k} C{cx - 250 * k},{cy + 300 * k} {cx - 330 * k},{cy + 380 * k} {cx - 350 * k},{cy + 520 * k} '
            f'L{cx + 350 * k},{cy + 520 * k} C{cx + 330 * k},{cy + 380 * k} {cx + 250 * k},{cy + 300 * k} {cx + 60 * k},{cy + 270 * k} L{cx + 60 * k},{cy + 200 * k}"/></g>'
            f'<path d="{lips}" fill="{hex_}"/></svg>')

# ---------- SM1. 가장자리: 왼쪽 세로 호수 레일(H 이어받기) · 오른쪽 아래 재고 · 가운데는 거울 ----------
rail = []
for i, s in enumerate(S[:13]):
    y = 300 + i * 62
    on = s is SEL
    rail.append(f'<i class="rd{" on" if on else ""}" style="top:{y}px;background:{s["hex"]}"></i>')
    if on:
        rail.append(f'<div class="rl" style="top:{y - 2}px"><b>{s["no"]}</b> {nm(s)}</div>')
SM1_CSS = '''
.rd{position:absolute;left:48px;width:40px;height:40px;border-radius:50%}
.rd.on{left:42px;width:52px;height:52px;margin-top:-6px;box-shadow:0 0 0 3px #000,0 0 0 4.5px #fff}
.rl{position:absolute;left:112px;font-size:22px;font-weight:300;line-height:40px} .rl b{font-weight:600}
.rcap{left:48px;top:250px}
.more{left:48px;top:1110px;font-size:14px;font-weight:400;color:rgba(255,255,255,.4)}
.prod{left:48px;top:64px} .prod .b{font-size:17px;font-weight:400;color:rgba(255,255,255,.55)}
.prod .n{margin-top:6px;font-size:40px;font-weight:300;letter-spacing:-0.02em} .prod .p{margin-top:4px;font-size:22px;font-weight:300;color:rgba(255,255,255,.7)}
.x{right:40px;top:60px}
.stk{right:48px;top:1120px;text-align:right}
.stk .s{font-size:16px;font-weight:400;color:rgba(255,255,255,.7)} .stk .s i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#FF007B;margin-right:8px;vertical-align:2px}
.stk .num{margin-top:4px;font-size:150px;line-height:1;font-weight:200;letter-spacing:-0.05em} .stk .num small{font-size:28px;font-weight:300;margin-left:6px}
.stk .w{margin-top:6px;font-size:24px;font-weight:400} .stk .m{margin-top:6px;font-size:16px;font-weight:300;color:rgba(255,255,255,.5)}
.hint{left:0;right:0;bottom:56px;text-align:center;font-size:16px;font-weight:300;color:rgba(255,255,255,.45)}
'''
SM1_HTML = f'''{mirror(470, 560)}<div class="note" style="left:380px;top:300px">거울에 비친 모습</div>
<div class="ab prod"><div class="b">{P["brand"]}</div><div class="n">{P["name"]}</div><div class="p">{P["price"]:,}원</div></div>
<div class="x">{X}</div>
<div class="ab cap rcap">호수 39</div>{"".join(rail)}<div class="ab more">↓ 더 보기</div>
<div class="ab stk"><div class="s"><i></i>이 매장 품절</div><div class="num">4<small>개</small></div><div class="w">올리브영 대학로점</div><div class="m">도보 34분 · 2.6km</div></div>
<div class="ab hint">왼쪽 색을 누르면 거울 속 입술이 바뀌어요</div>'''

# ---------- SM2. 아래 1/3: 얼굴은 위에 그대로, 아래에 호를 따라 호수가 늘어선다 · 재고는 오른쪽 위 작은 위젯 ----------
arc = []
n = 11
cx, cy, R = 450, 1700, 600
si = S.index(SEL)
for j in range(-4, 5):  # 고른 호수가 맨 위 가운데, 양옆 4개씩 (목록 끝은 반대쪽으로 이어진다)
    s = S[(si + j) % len(S)]
    a = math.radians(-90 + j * 8.5)
    x, y = cx + R * math.cos(a), cy + R * math.sin(a)
    on = s is SEL
    size = 64 if on else 44
    arc.append(f'<i class="ad{" on" if on else ""}" style="left:{x - size / 2:.1f}px;top:{y - size / 2:.1f}px;width:{size}px;height:{size}px;background:{s["hex"]}"></i>')
SM2_CSS = '''
.ad{position:absolute;border-radius:50%}
.ad.on{box-shadow:0 0 0 3px #000,0 0 0 4.5px #fff}
.sel{left:0;right:0;top:1000px;text-align:center}
.sel .c{font-size:15px;font-weight:400;color:rgba(255,255,255,.5)} .sel .v{margin-top:6px;font-size:34px;font-weight:300} .sel .v b{font-weight:600}
.prod{left:0;right:0;top:1250px;text-align:center;font-size:20px;font-weight:300;color:rgba(255,255,255,.7)}
.prod b{color:#fff;font-weight:500}
.cnt{left:0;right:0;top:1300px;text-align:center;font-size:14px;font-weight:300;color:rgba(255,255,255,.4)}
.x{left:40px;top:56px}
.w{right:48px;top:64px;text-align:right}
.w .s{font-size:15px;font-weight:400;color:rgba(255,255,255,.65)} .w .s i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#FF007B;margin-right:8px;vertical-align:2px}
.w .num{font-size:96px;line-height:1.05;font-weight:200;letter-spacing:-0.05em} .w .num small{font-size:22px;font-weight:300;margin-left:4px}
.w .t{font-size:20px;font-weight:400} .w .m{margin-top:4px;font-size:15px;font-weight:300;color:rgba(255,255,255,.5)}
'''
SM2_HTML = f'''{mirror(450, 500, .95)}<div class="note" style="left:385px;top:250px">거울에 비친 모습</div>
<div class="x">{X}</div>
<div class="ab w"><div class="s"><i></i>이 매장 품절 · 가까운 매장</div><div class="num">4<small>개</small></div><div class="t">올리브영 대학로점</div><div class="m">도보 34분 · 2.6km · 22:00까지</div></div>
<div class="ab sel"><div class="c">지금 바른 호수</div><div class="v"><b>{SEL["no"]}</b> {nm(SEL)}</div></div>
{"".join(arc)}
<div class="ab prod">{P["brand"]} <b>{P["name"]}</b> · {P["price"]:,}원</div>
<div class="ab cnt">옆으로 밀면 39가지 호수가 돌아가요</div>'''

# ---------- SM3. 네 모서리 위젯 (스마트 미러 대시보드처럼) · 아래 가로 호수 줄 ----------
strip = ''.join(f'<i class="sd{" on" if s is SEL else ""}" style="background:{s["hex"]}"></i>' for s in S[:15])
SM3_CSS = '''
.tl{left:48px;top:60px} .tl .b{font-size:16px;font-weight:400;color:rgba(255,255,255,.5)}
.tl .n{margin-top:8px;font-size:46px;line-height:1.12;font-weight:200;width:420px;letter-spacing:-0.03em} .tl .p{margin-top:10px;font-size:22px;font-weight:300;color:rgba(255,255,255,.7)}
.tr{right:48px;top:60px;text-align:right}
.tr .num{font-size:120px;line-height:1;font-weight:200;letter-spacing:-0.05em} .tr .num small{font-size:24px;font-weight:300;margin-left:4px}
.tr .t{margin-top:6px;font-size:20px;font-weight:400} .tr .m{margin-top:4px;font-size:15px;font-weight:300;color:rgba(255,255,255,.5)}
.tr .s{margin-bottom:6px;font-size:15px;font-weight:400;color:rgba(255,255,255,.65)} .tr .s i{display:inline-block;width:7px;height:7px;border-radius:50%;background:#FF007B;margin-right:8px;vertical-align:2px}
.bl{left:48px;top:1150px;display:flex;align-items:center;gap:18px}
.bl i{width:48px;height:48px;border-radius:50%}
.bl .c{font-size:14px;font-weight:400;color:rgba(255,255,255,.5)} .bl .v{font-size:26px;font-weight:300} .bl .v b{font-weight:600}
.br{right:48px;top:1150px;display:flex;align-items:center;gap:10px;font-size:18px;font-weight:300;color:rgba(255,255,255,.75)}
.br .x{position:static}
.line{left:48px;right:48px;top:1250px;height:1px;background:rgba(255,255,255,.15)}
.strip{left:48px;right:48px;top:1290px;display:flex;justify-content:space-between;align-items:center}
.sd{width:36px;height:36px;border-radius:50%}
.sd.on{width:50px;height:50px;box-shadow:0 0 0 3px #000,0 0 0 4.5px #fff}
.cnt{right:48px;top:1366px;font-size:14px;font-weight:300;color:rgba(255,255,255,.4)}
'''
SM3_HTML = f'''{mirror(450, 600)}<div class="note" style="left:385px;top:350px">거울에 비친 모습</div>
<div class="ab tl"><div class="b">{P["brand"]}</div><div class="n">{P["name"]}</div><div class="p">{P["price"]:,}원</div></div>
<div class="ab tr"><div class="s"><i></i>이 매장 품절</div><div class="num">4<small>개</small></div><div class="t">올리브영 대학로점</div><div class="m">도보 34분 · 2.6km</div></div>
<div class="ab bl"><i style="background:{SEL["hex"]}"></i><div><div class="c">지금 바른 호수</div><div class="v"><b>{SEL["no"]}</b> {nm(SEL)}</div></div></div>
<div class="ab br">닫기<div class="x">{X}</div></div>
<div class="ab line"></div><div class="ab strip">{strip}</div><div class="ab cnt">39가지 · 옆으로 밀기</div>'''

for key, css, html in [('SM1', SM1_CSS, SM1_HTML), ('SM2', SM2_CSS, SM2_HTML), ('SM3', SM3_CSS, SM3_HTML)]:
    io.open(os.path.join(HERE, f'시안{key}.html'), 'w', encoding='utf-8').write(BASE.replace('@@CSS@@', css).replace('@@HTML@@', html))
print('ok')
