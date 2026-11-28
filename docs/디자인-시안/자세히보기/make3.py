# 시안 H 발전안 H1~H3 (2026-11-28 사용자: "H 가 좋은데 지금 바른 호수가 크게 보이는 건 별로").
# 왼쪽 세로 호수 레일은 그대로, 큰 색 면을 빼고 지금 바른 호수는 작게. 그 자리는 제품 사진·재고가 쓴다
import json, io, os

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
/* 왼쪽 세로 호수 레일 (H 그대로) */
.rail{position:absolute;left:0;top:0;bottom:0;width:170px;border-right:1px solid rgba(255,255,255,.15);padding-top:150px;display:flex;flex-direction:column;align-items:center;gap:22px}
.rail .t{position:absolute;top:64px;font-size:15px;font-weight:700}
.rd{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px}
.rd i{width:62px;height:62px;border-radius:50%}
.rd span{font-size:14px;font-weight:700;color:rgba(255,255,255,.5)}
.rd.on i{box-shadow:0 0 0 3px #000,0 0 0 5px #fff}
.rd.on span{color:#fff}
.rd.on::before{content:"";position:absolute;left:-54px;top:8px;width:5px;height:46px;border-radius:3px;background:#FF007B}
.main{position:absolute;left:210px;right:44px}
/* 재고 공통 */
.st .k{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700} .st .k i{width:10px;height:10px;border-radius:50%;background:#FF007B}
.st .b{margin-top:18px;display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:28px;border-bottom:1px solid rgba(255,255,255,.2)}
.st .b b{display:block;font-size:38px;font-weight:800} .st .b span{display:block;margin-top:8px;font-size:18px;font-weight:500}
.st .b strong{font-size:80px;line-height:1;font-weight:800;letter-spacing:-0.05em} .st .b strong small{font-size:22px;margin-left:4px}
.st .r{display:flex;justify-content:space-between;padding:20px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:19px;font-weight:500;color:rgba(255,255,255,.7)}
.st .r b{color:#fff;font-size:22px;font-weight:800}
@@CSS@@
</style></head><body>@@HTML@@</body></html>'''
X = '<div class="x"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></div>'
RAIL = '<div class="rail"><div class="t dim">호수 39</div>' + ''.join(
    f'<div class="rd{" on" if s is SEL else ""}"><i style="background:{s["hex"]}"></i><span>{s["no"]}</span></div>' for s in S[:13]) + '</div>'
STOCK = '''<div class="k"><i></i>이 매장은 품절 · 가장 가까운 매장</div>
<div class="b"><div><b>올리브영 대학로점</b><span class="dim">도보 34분 · 2.6km · 11:00–22:00</span></div><strong>4<small>개</small></strong></div>
<div class="r"><span>올리브영 중앙로점 · 도보 10분</span><b>2개</b></div>
<div class="r"><span>올리브영 시청점 · 도보 16분</span><b>13개</b></div>'''

# H1: 큰 제품 사진 + 정보, 지금 바른 호수는 정보 아래 작은 한 줄
H1_CSS = '''
.ph{top:150px;height:420px;border-radius:32px;overflow:hidden;background:#fff}
.ph img{width:100%;height:100%;object-fit:cover}
.info{top:610px}
.info span{font-size:19px;font-weight:600} .info b{display:block;margin:6px 0 8px;font-size:40px;line-height:1.2;font-weight:800} .info em{font-style:normal;font-size:28px;font-weight:700}
.now{top:780px;display:flex;align-items:center;gap:14px;padding:18px 0;border-top:1px solid rgba(255,255,255,.2);border-bottom:1px solid rgba(255,255,255,.2)}
.now i{width:28px;height:28px;border-radius:50%}
.now span{font-size:17px;font-weight:600} .now b{font-size:20px;font-weight:800}
.now em{margin-left:auto;font-style:normal;font-size:15px;font-weight:600}
.st{top:920px}
'''
H1_HTML = f'''{RAIL}{X}
<div class="main ph"><img src="{IMG}"></div>
<div class="main info"><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div>
<div class="main now"><i style="background:{SEL["hex"]}"></i><span class="dim">지금 바른 호수</span><b>{SEL["no"]} {nm(SEL)}</b><em class="dim">왼쪽에서 다른 호수 고르기</em></div>
<div class="main st">{STOCK}</div>'''

# H2: 제품 사진 위에 지금 바른 호수를 작은 알약으로 얹음
H2_CSS = '''
.ph{top:150px;height:520px;border-radius:32px;overflow:hidden;background:#fff}
.ph img{width:100%;height:100%;object-fit:cover}
.tag{position:absolute;left:24px;bottom:24px;display:flex;align-items:center;gap:12px;padding:10px 22px 10px 10px;border-radius:999px;background:#000}
.tag i{width:36px;height:36px;border-radius:50%}
.tag b{font-size:19px;font-weight:800} .tag span{font-size:14px;font-weight:600;display:block}
.info{top:710px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px}
.info span{font-size:19px;font-weight:600} .info b{display:block;margin-top:6px;font-size:38px;line-height:1.2;font-weight:800}
.info em{flex:none;font-style:normal;font-size:30px;font-weight:800}
.st{top:880px}
'''
H2_HTML = f'''{RAIL}{X}
<div class="main ph"><img src="{IMG}"><div class="tag"><i style="background:{SEL["hex"]}"></i><div><span class="dim">지금 바른 호수</span><b>{SEL["no"]} {nm(SEL)}</b></div></div></div>
<div class="main info"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b></div><em>{P["price"]:,}원</em></div>
<div class="main st">{STOCK}</div>'''

# H3: 글자 중심. 제품 이름 아래 고른 색의 얇은 선 하나 + 작은 호수 이름, 정보는 표처럼
H3_CSS = '''
.top{top:150px;display:flex;gap:28px;align-items:flex-start}
.top img{flex:none;width:200px;height:200px;border-radius:24px;object-fit:cover;background:#fff}
.top span{font-size:19px;font-weight:600} .top b{display:block;margin:6px 0 10px;font-size:42px;line-height:1.18;font-weight:800}
.top em{font-style:normal;font-size:28px;font-weight:700}
.line{top:400px;height:8px;border-radius:4px;background:%s}
.now{top:430px;display:flex;justify-content:space-between;font-size:18px;font-weight:600}
.now b{color:#fff;font-weight:800}
.tbl{top:530px}
.tbl div{display:flex;justify-content:space-between;padding:22px 0;border-top:1px solid rgba(255,255,255,.15);font-size:19px;font-weight:500;color:rgba(255,255,255,.6)}
.tbl div b{color:#fff;font-weight:700}
.st{top:860px}
'''
H3_HTML = f'''{RAIL}{X}
<div class="main top"><img src="{IMG}"><div><span class="dim">{P["brand"]}</span><b>{P["name"]}</b><em>{P["price"]:,}원</em></div></div>
<div class="main line"></div>
<div class="main now"><span class="dim">지금 바른 호수 <b>{SEL["no"]} {nm(SEL)}</b></span><span class="dim">{SEL["hex"]}</span></div>
<div class="main tbl"><div><span>제형</span><b>글로시</b></div><div><span>호수</span><b>39가지</b></div><div><span>브랜드</span><b>{P["brand"]}</b></div></div>
<div class="main st">{STOCK}</div>'''

for key, css, html in [('H1', H1_CSS, H1_HTML), ('H2', H2_CSS, H2_HTML), ('H3', H3_CSS % SEL['hex'], H3_HTML)]:
    io.open(os.path.join(HERE, f'시안{key}.html'), 'w', encoding='utf-8').write(BASE.replace('@@CSS@@', css).replace('@@HTML@@', html))
print('ok')
