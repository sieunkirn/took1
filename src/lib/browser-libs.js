// 브라우저도 같이 쓰는 src/lib 파일 목록.
// 서버(server.js)는 이 파일들만 /lib/ 로 내주고, 정적 빌드(scripts/build-static.js)는 이 파일들을 lib/ 로 복사한다.
// 브라우저 코드(public/js)가 '../lib/새파일.js' 를 불러오게 되면 여기에 추가한다.
export const BROWSER_LIBS = [
  'color.js', 'constants.js', 'catalog.js', 'recommend.js', 'spoken.js', 'situations.js', 'aliases.js',
  'chat.js', 'chat-lang.js', 'chat-words.js', 'chat-parse.js', 'chat-search.js', 'chat-reply.js', 'chat-en.js',
];
