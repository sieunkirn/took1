# 54~57쪽을 레퍼런스 틀(Q3 펼침면 틀 · Mirror 쪽 틀)로 다시 짠 HTML 을 만든다 (그림·아이콘 SVG 는 첫 판 HTML 에서 가져옴)
# 쓰는 법: 레포트북-54-57쪽 폴더에서  python ../레포트북-도구/make-54-57-v2.py
import re, io
s = io.open('레포트북-54-57쪽.html', encoding='utf-8').read()
icons = re.findall(r'<svg viewBox="0 0 40 40">.*?</svg>', s, re.S)
scrn = re.findall(r'<svg class="scrn".*?</svg>', s, re.S)
zoom = re.search(r'<div class="zoom">.*?(<svg.*?</svg>)', s, re.S).group(1)
a = s.index('<div class="kinds">'); b = s.index('<figcaption', a); kinds = s[a:b].strip()
css = """
@page{size:182mm 257mm;margin:0}
@font-face{font-family:"Noto Sans KR";src:url("file:///C:/Windows/Fonts/NotoSansKR-VF.ttf");font-weight:100 900}
:root{--accent:#D32C3E;--ink:#111;--rule:#d9d9d9}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9e9e9}
body{font-family:"Noto Sans KR","Malgun Gothic",sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:182mm;height:257mm;background:#fff;margin:10mm auto;overflow:hidden;display:flex;flex-direction:column}
@media print{html,body{background:#fff}.page{margin:0;page-break-after:always}}
.q.even{padding:42mm 16mm 14mm 18mm}.q.odd{padding:42mm 18mm 14mm 16mm}
.bar{position:absolute;top:18mm;width:66mm;height:3mm;background:var(--accent)}.even .bar{right:0}.odd .bar{left:0}
.sec{display:grid;grid-template-columns:42mm 1fr;column-gap:8mm}
.sec+.sec{margin-top:7mm;padding-top:7mm;border-top:.25mm solid var(--rule)}
.head .no{font-size:13pt;font-weight:700;color:var(--accent);letter-spacing:.02em;line-height:1}
.head h2{font-size:12pt;line-height:1.35;font-weight:700;margin-top:7mm;letter-spacing:-.02em;word-break:keep-all}
.head .sub{font-size:7.5pt;color:var(--accent);margin-top:2mm;font-weight:500;line-height:1.35}
.head svg{display:block;width:15mm;height:15mm;margin-top:7mm;margin-left:-1mm}
.head svg *{fill:none;stroke:var(--accent);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.ko{font-size:8pt;line-height:1.8;letter-spacing:-.01em;word-break:keep-all}
.ko em{font-style:normal;color:var(--accent);font-weight:500}
.ko+.ko{margin-top:3mm}
.en{font-size:7pt;line-height:1.7;color:#9a9a9a}
.body .en{margin-top:5mm}.en+.en{margin-top:2.4mm!important}
.eq{margin:2.4mm 0;padding:.7mm 0 .7mm 2.4mm;border-left:.6mm solid var(--accent);font-family:"STIX Two Text","Cambria Math",Cambria,serif;font-style:italic;font-size:9.5pt;line-height:1.3;letter-spacing:.02em}
.q .figs{margin-top:auto;display:flex;justify-content:flex-end;align-items:flex-end;gap:5mm}
figure{display:flex;flex-direction:column}
.n{display:inline-block;align-self:flex-end;font-size:6pt;line-height:1;border:.25mm solid #bbb;padding:.45mm 1mm;color:var(--accent);margin-bottom:1.4mm}
figure img{display:block}
.slot{background:#f5f5f5;border:.25mm dashed #bdbdbd;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.slot b{font-size:7.5pt;color:#9a9a9a;font-weight:700;letter-spacing:.04em}.slot span{font-size:6pt;color:#ababab;margin-top:1mm;line-height:1.45}
.lab{font-size:6.5pt;line-height:1.3;font-weight:700;text-align:center;margin-top:1.2mm}.lab span{display:block;font-size:6pt;font-weight:400;color:#a3a3a3}
.kinds{display:grid;grid-template-columns:repeat(4,22mm);column-gap:3mm}
.kinds svg{display:block;width:22mm;height:16.72mm;background:#fafafa}
.kinds .scr{fill:none;stroke:#9a9a9a;stroke-width:1.1;stroke-dasharray:3 2.4}.kinds .flm{fill:rgba(211,44,62,.08);stroke:var(--accent);stroke-width:1.4}.kinds .arr{fill:none;stroke:var(--accent);stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round}
.show{padding:18mm 16mm 14mm}
.tag{font-size:9pt;font-weight:700;color:var(--accent);letter-spacing:.02em;line-height:1}
.hero{text-align:center;margin-top:3mm}
.hero h3{font-size:10pt;font-weight:500;line-height:1.3}
.hero .note{font-size:12.5pt;font-weight:500;color:#555;line-height:1.5;margin-top:2.5mm;word-break:keep-all}
.show .figs{position:relative;flex:1;margin-top:6mm}
.show .figs>*{position:absolute}
.dev{display:block;border:.5mm solid #1c1c1c;border-radius:2.4mm}
.call h3{font-size:9pt;font-weight:500;color:#333;line-height:1.3}
.call .note{font-size:6.5pt;line-height:1.65;color:#333;margin-top:1.4mm;word-break:keep-all}
.call .note b{font-weight:700}.call.red h3,.call.red .note b{color:var(--accent)}
i.ln{display:block;border-top:.25mm solid #555;height:0}i.dot{display:block;width:1.4mm;height:1.4mm;border-radius:50%;background:#555}
.sec.foot{display:block}
.foot h2{font-size:17pt;font-weight:500;line-height:1.2}
.cols{display:grid;grid-template-columns:1fr 1fr;column-gap:10mm;margin-top:4mm}
.stats{border-top:.25mm solid var(--rule)}
.stats div{display:grid;grid-template-columns:1fr auto;align-items:baseline;padding:1.3mm 0;border-bottom:.25mm solid var(--rule);font-size:6.5pt;color:#777}
.stats b{font-size:10.5pt;font-weight:700;color:var(--ink);letter-spacing:-.01em}.stats b small{font-size:6.5pt;font-weight:500;margin-left:.4mm}
.stats .top,.stats .top b{color:var(--accent)}
#p56 .sec+.sec{margin-top:4.5mm;padding-top:4.5mm}#p56.q{padding-top:38mm}
"""

def sec(no, h2, sub, icon, body):
    return '<div class="sec"><div class="head"><div class="no">%s</div><h2>%s</h2><div class="sub">%s</div>%s</div><div class="body">%s</div></div>' % (no, h2, sub, icon, body)

def call(st, h, n, cls=""):
    return '<div class="call %s" style="%s"><h3>%s</h3><p class="note">%s</p></div>' % (cls, st, h, n)

def fig(n, inner, ko, en):
    return '<figure><span class="n">%s</span>%s<p class="lab">%s<span>%s</span></p></figure>' % (n, inner, ko, en)

p54 = '<section class="page even q" id="p54"><div class="bar"></div>' + sec(
    "CFP 1 .", "하프미러 뒤에서도<br>보이는가 ,", "Visibility / Half Mirror", icons[0],
    '<p class="ko"><em>하프미러 뒤에서도 화면의 글자와 립 색이 충분히 보이는가.</em> 두 단계로 확인했다. 먼저 PC 미리보기 화면(preview.html)에서 브라운·실버 필름을 겹친 모습을 흉내 내어 비교했다. 다음으로 유리 하프미러(4mm, ATO 디스플레이), 조명 확산용 아크릴(2mm), 실버 필름을 13인치 디스플레이 앞에 대고 화면 밝기, 1m 글자 판독, 상의 왜곡을 보았다. 두께는 버니어 캘리퍼스로 쟀다.</p>'
    '<p class="en">Can the text and the lip color on the screen be seen well enough behind a half mirror? We checked in two steps. First, on a PC preview screen (preview.html), we simulated how brown and silver film would look when laid over the screen and compared them. Next, we held a glass half mirror (4 mm, ATO Display), light-diffusing acrylic (2 mm) and silver film in front of a 13-inch display and looked at screen brightness, whether text could be read from 1 m, and distortion of the reflection. Thickness was measured with vernier calipers.</p>'
) + sec(
    "CFP 4 .", "어떤 재질이면<br>되는가 ,", "Glass / Acrylic / Film", icons[1],
    '<p class="ko">필름은 색을 띠었다. 미리보기에서 브라운은 립 색을 탁하게, 실버는 어둡게 만들었다. 조명 확산용 아크릴은 가볍고 깨지지 않지만 큰 면적에서 상이 일그러졌다. 유리 하프미러는 상이 일그러지지 않았고, 투과율이 예상보다 높아 바탕을 검게 하지 않아도 글자와 얼굴이 보였다.</p>'
    '<p class="ko"><em>하프미러를 쓴 스마트 미러는 성립한다. 최종 재질은 유리 4mm, 반사율 65%·투과율 35%인 하프미러로 정했다.</em> 화면 밝기 600nit에 투과율 35%를 곱한 이론값은 약 210nit이며, 각도별 밝기는 테스트할 예정이다.</p>'
    '<p class="en">The films were tinted: in the preview, brown made the lip color muddy and silver made it dark. Light-diffusing acrylic is light and does not break, but the reflection warped over a large area. The glass half mirror did not distort the reflection, and its transmittance was higher than expected, so text and the face were visible even without a black background.</p>'
    '<p class="en">A smart mirror built with a half mirror works. We chose a 4 mm glass half mirror with 65% reflectance and 35% transmittance as the final material. Multiplying the screen brightness of 600 nits by the 35% transmittance gives a theoretical value of about 210 nits; brightness by viewing angle will be tested later.</p>'
) + '<div class="figs">' + fig(1, '<img src="img/film-none.png" style="width:25mm;height:25mm;border-radius:50%">', "필름 없음", "No film") \
  + fig(2, '<img src="img/film-brown.png" style="width:25mm;height:25mm;border-radius:50%">', "브라운 필름", "Brown film") \
  + fig(3, '<img src="img/film-silver.png" style="width:25mm;height:25mm;border-radius:50%">', "실버 필름", "Silver film") \
  + fig(4, '<div class="slot" style="width:38mm;height:25mm"><b>사진 자리</b><span>실물 시료 비교</span></div>', "실물 시료", "Physical samples") \
  + '</div></section>'

p56 = '<section class="page even q" id="p56"><div class="bar"></div>' + sec(
    "CFP 2 .", "터치는 정확히<br>먹히는가 ,", "Capacitive Film / Glass", icons[6],
    '<p class="ko"><em>하프미러 유리 너머로 누른 터치가 버튼 위치에 정확히 먹히는가.</em> 정전식 필름은 화면과 완벽하게 겹치지 않는다. 필름이 조금 밀리거나, 화면보다 크거나, 살짝 기울어 붙으면 누른 곳과 인식한 곳이 어긋난다. 어긋남은 화면 가장자리로 갈수록 커진다. 이 시제품에서는 가로와 세로까지 반대로 인식되어 터치 보정이 꼭 필요했다.</p>'
    '<p class="ko">그래서 터치 보정 화면(calib.html)을 만들었다. 십자 표시 5개(네 모서리 근처와 가운데)를 차례로 띄우고 직원이 누르게 한다. <em>실제로 누른 곳과 눌렀어야 할 곳의 차이로 보정식을 계산해 이후 모든 터치에 적용한다.</em></p>'
    '<p class="en">Does a touch made through the half-mirror glass land exactly on the button? The capacitive film never overlaps the screen perfectly. If the film is slightly shifted, larger than the screen or attached at a slight angle, the point pressed and the point recognized do not match. The gap grows toward the edges of the screen. In our prototype the horizontal and vertical axes were also read the wrong way round, so touch calibration became necessary.</p>'
    '<p class="en">So we built a touch calibration screen (calib.html). It shows five crosses in turn, near the four corners and in the center, and a staff member taps each one. From the difference between where they actually tapped and where they should have tapped, it calculates a correction formula and applies it to every touch afterward.</p>'
) + sec(
    "How .", "점 다섯 개로<br>맞춘다 ,", "Affine / Least Squares", icons[8],
    '<p class="ko">어긋남에는 밀림, 늘어남, 기울어짐이 섞여 있다. 아핀 변환은 이 세 가지를 6개의 숫자로 한 번에 표현한다.</p><p class="eq">x′ = a·x + b·y + c,&nbsp;&nbsp; y′ = d·x + e·y + f</p>'
    '<p class="ko">점 3개면 6개의 숫자를 풀 수 있지만 사람의 손가락은 정확하지 않다. 그래서 점을 5개 받고, 오차 합이 가장 작아지는 숫자를 최소제곱법으로 찾는다. <em>한두 점을 조금 잘못 눌러도 결과가 크게 흔들리지 않는다.</em> 직원이 맞추는 일이므로 이 점이 중요하다.</p>'
    '<p class="en">The mismatch is a mix of shifting, stretching and tilting. An affine transformation expresses all three at once with six numbers. Three points are enough to solve for six numbers, but a human finger is not precise. So we take five points and use the least-squares method to find the numbers that make the total error smallest. Even if one or two points are tapped slightly off, the result does not swing much. This matters because the calibration is done by store staff.</p>'
) + '<div class="figs"><figure><span class="n">1</span>' + kinds + '</figure>' \
  + fig(2, '<img src="img/calib-cross5.png" style="height:26mm;width:16.25mm;border:.2mm solid #cfcfcf">', "십자 5개", "Five crosses") \
  + fig(3, '<img src="img/calib-test9.png" style="height:26mm;width:16.25mm;border:.2mm solid #cfcfcf">', "정확도 테스트", "Accuracy test") \
  + '</div></section>'

p55 = '<section class="page odd show" id="p55"><div class="tag no">CFP 1 · CFP 4</div>' \
  + '<div class="hero"><h3>Finding</h3><p class="note">색을 흔든 것은 화면이 아니라<br>카메라였다</p></div><div class="figs">' \
  + '<img class="dev" src="img/dark-mode.png" style="left:6mm;top:2mm;height:72mm;width:45mm">' \
  + '<img class="dev" src="img/color-calib.png" style="left:108mm;top:44mm;height:54mm;width:39.45mm">' \
  + '<img class="dev" src="img/mirror-full.png" style="left:44mm;top:20mm;height:92mm;width:57.5mm">' \
  + call("left:6mm;top:80mm;width:34mm", "Dark Mode", "11월 9일의 초기 판단<br>바탕을 검게 한 화면") \
  + '<i class="ln" style="left:101.5mm;top:28mm;width:8mm"></i><i class="dot" style="left:109mm;top:27.3mm"></i>' \
  + call("left:112mm;top:22mm;width:38mm", "Full Camera View", "다크 모드를 버리고 카메라<br>영상으로 화면을 꽉 채움", "red") \
  + call("left:108mm;top:101mm;width:42mm", "Color Calibration", "컬러체커 흰색 칸으로 카메라<br>색을 맞추고 고정") \
  + '</div><div class="sec foot"><h2>Camera</h2><div class="cols"><div>' \
  + '<p class="ko">처음에는 하프미러 위에서 검은 부분만 거울이 된다고 보고, 11월 9일 모든 화면에 다크 모드를 넣어 바탕을 검게 했다. 그러나 실물 유리 하프미러는 투과율이 예상보다 높아, 바탕을 검게 하지 않아도 글자와 얼굴이 보였다.</p>' \
  + '<p class="ko">화면보다 카메라가 더 문제였다. 카메라가 스스로 색과 밝기를 바꾸면 같은 립 색도 장면마다 다르게 보였다. <em>색이 흔들리는 가장 큰 원인은 화면이나 필름이 아니라 카메라의 자동 보정이었다.</em></p>' \
  + '<p class="ko">바탕을 검게 하던 다크 모드를 버리고 카메라 영상으로 화면을 꽉 채웠다. 컬러체커 보드로 카메라 색을 맞추고 고정하는 보정 화면을 만들었다.</p></div><div>' \
  + '<p class="en">At first we assumed that only the black areas become a mirror on a half mirror, so on November 9 we added a dark mode that made every background black. But the real glass half mirror let more light through than expected. Text and the face were visible even without a black background.</p>' \
  + '<p class="en">The camera turned out to be a bigger problem than the screen. When the camera changed color and brightness by itself, the same lip color looked different from scene to scene. The biggest cause of unstable color was neither the screen nor the film but the automatic adjustment of the camera.</p>' \
  + '<p class="en">We dropped the dark mode and filled the screen with the camera image. We also built a calibration screen that matches and locks the camera color using a color checker board.</p></div></div></div></section>'

stats = '<div class="stats" style="left:106mm;top:30mm;width:44mm"><div><span>보정 전 평균</span><b>약 600<small>px</small></b></div><div><span>보정 전 최대</span><b>약 1,010<small>px</small></b></div><div class="top"><span>보정 후 평균</span><b>5.2<small>px</small></b></div><div class="top"><span>보정 후 최대</span><b>6.4<small>px</small></b></div><div><span>통과 기준</span><b>52<small>px</small></b></div></div>'

p57 = '<section class="page odd show" id="p57"><div class="tag no">CFP 2</div>' \
  + '<div class="hero"><h3>Result</h3><p class="note">평균 약 600px의 어긋남이<br>보정 후 5.2px로 줄었다</p></div><div class="figs">' \
  + scrn[0].replace('class="scrn"', 'class="scrn" style="left:0;top:0;width:46mm"') \
  + scrn[1].replace('class="scrn"', 'class="scrn" style="left:53mm;top:0;width:46mm"') \
  + zoom.replace('<svg ', '<svg style="left:106mm;top:0;width:44mm" ', 1) + stats \
  + call("left:0;top:74mm;width:46mm", "Before", "<b>평균 약 600px, 최대 약 1,010px</b><br>누른 곳(고리)과 인식된 자리(빨간 점)가<br>약 90° 돌아가 있다") \
  + call("left:53mm;top:74mm;width:46mm", "After", "<b>평균 5.2px, 최대 6.4px</b><br>9곳 모두 맞는 자리가 눌렸다", "red") \
  + call("left:106mm;top:74mm;width:44mm", "Pass Line", "호수 버튼(약 260×104px)<br>절반 높이인 52px") \
  + '</div><div class="sec foot"><h2>Calibration</h2><div class="cols"><div>' \
  + '<p class="ko">화면 위 9곳에 목표점을 띄워 각각 1번씩 누르고, 누른 곳과 목표점의 거리를 보정 전·후로 비교한다. 호수 버튼(약 260×104px)의 절반 높이인 52px보다 오차가 작으면 통과로 본다.</p>' \
  + '<p class="ko">보정 전에는 터치 필름이 화면을 약 90° 돌린 좌표를 보내서, 9곳 평균 약 600px, 최대 약 1,010px가 어긋났다. <em>보정 후 남은 오차는 평균 5.2px, 최대 6.4px로 52px보다 훨씬 작아 통과했다.</em> 보정 전 자리는 11월 15일에 저장한 보정값으로 거꾸로 계산해 그렸다.</p>' \
  + '<p class="ko">필름을 다시 붙이는 것보다 소프트웨어로 맞추는 편이 빠르고 매장에서도 되풀이할 수 있다. 설치 때 한 번 맞추며, 매장 직원이 할 수 있도록 관리자 화면에 터치 보정을 넣었다.</p></div><div>' \
  + '<p class="en">We show target points at nine places on the screen, tap each one once, and compare the distance between the tap and the target before and after calibration. It passes if the error is smaller than 52 px, half the height of a shade button (about 260×104 px).</p>' \
  + '<p class="en">Before calibration, the touch film sent coordinates rotated about 90° from the screen, so taps were off by about 600 px on average and by up to about 1,010 px. After calibration, the remaining error was 5.2 px on average and 6.4 px at most, far below 52 px, so it passed. The before positions are computed back from the calibration saved on Nov. 15.</p>' \
  + '<p class="en">Correcting it in software is faster than re-attaching the film, and it can be repeated in the store. The touch is aligned once at installation, and touch calibration sits in the admin screen so that store staff can do it.</p></div></div></div></section>'

html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>TOOK 레포트북 54–57쪽 v2</title><style>' + css + '</style></head><body>\n' + p54 + '\n' + p55 + '\n' + p56 + '\n' + p57 + '\n</body></html>'
io.open('레포트북-54-57쪽-v2.html', 'w', encoding='utf-8', newline='\n').write(html)
print('ok', len(html))
