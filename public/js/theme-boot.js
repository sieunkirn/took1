// 첫 화면이 그려지기 전에 다크 모드를 바로 켠다 (밝게 깜빡이지 않게).
// <head> 에서 <script src="js/theme-boot.js"></script> 로 부른다 (module 이 아니라 바로 실행되어야 한다)
try { if (localStorage.getItem('took.theme') === 'dark') document.documentElement.dataset.theme = 'dark'; } catch (e) { /* 저장 불가 환경 */ }
