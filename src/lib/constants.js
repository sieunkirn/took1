// 서버/브라우저 공용 상수
export const FINISH_LABELS = {
  glossy: '글로시',
  matte: '매트',
  satin: '새틴',
  velvet: '벨벳',
};

// 제형 정보가 없는 상품(상품명으로도 추정되지 않은 올리브영 상품)은 '정보 없음'
export const finishLabel = (finish) => FINISH_LABELS[finish] || '정보 없음';

export const FAMILY_LABELS = {
  red: '레드',
  pink: '핑크',
  coral: '코랄',
  orange: '오렌지',
  nude: '누드',
  brown: '브라운',
  rose: '로즈',
  berry: '베리',
  plum: '플럼',
  burgundy: '버건디',
};
