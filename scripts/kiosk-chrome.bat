@echo off
rem took 키오스크: Chrome 을 키오스크 모드(처음부터 끝까지 전체화면, 주소창·탭 없음)로 띄운다.
rem 화면(페이지)을 옮겨도 전체화면이 풀리지 않는다. 설치하는 것은 없고 Chrome 실행 옵션만 쓴다.
rem - 끄기: Alt+F4
rem - 주소를 바꾸려면 아래 URL 을 고친다 (웹캠은 https 주소나 localhost 에서만 열린다)
rem - 처음 한 번은 카메라 권한을 허용해야 한다 (같은 주소면 다음부터는 묻지 않는다)
chcp 65001 >nul
set "URL=https://took-sieunkirns-projects.vercel.app/"

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Chrome 을 찾지 못했습니다. Chrome 이 설치돼 있는지 확인해 주세요.
  pause
  exit /b 1
)

rem 키오스크 전용 프로필: 평소 쓰는 Chrome 창과 섞이지 않고, '복원하시겠습니까' 같은 안내도 뜨지 않는다
start "" "%CHROME%" --kiosk --user-data-dir="%LocalAppData%\took-kiosk" --no-first-run --noerrdialogs --disable-session-crashed-bubble --disable-infobars --autoplay-policy=no-user-gesture-required "%URL%"
