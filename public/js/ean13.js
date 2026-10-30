// EAN-13 바코드를 SVG 로 그린다 (시연용 바코드 화면에서 사용, 외부 라이브러리 없음).
// 구조: 시작 가드(101) + 왼쪽 6자리(첫 자리에 따라 L/G 패턴) + 가운데 가드(01010) + 오른쪽 6자리(R 패턴) + 끝 가드(101) = 95칸

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13Bits(code) {
  if (!/^\d{13}$/.test(code)) throw new Error('EAN-13 은 13자리 숫자여야 합니다: ' + code);
  const d = [...code].map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + '101';
}

// 가드 막대 위치(길게 그림): 0~2, 45~49, 92~94
const isGuard = (i) => i < 3 || (i >= 45 && i < 50) || i >= 92;

/** @returns {string} SVG 마크업 (검정 막대, 흰 배경, 아래에 숫자) */
export function ean13Svg(code, { module = 3, height = 90 } = {}) {
  const bits = ean13Bits(code);
  const quiet = 11; // 좌우 여백(인식에 필요)
  const W = (bits.length + quiet * 2) * module;
  const H = height + 22;
  let bars = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const h = isGuard(i) ? height + 8 : height;
    bars += `<rect x="${(quiet + i) * module}" y="4" width="${module}" height="${h}"/>`;
  }
  const digit = (ch, x) => `<text x="${x}" y="${height + 20}" font-size="${module * 5}" text-anchor="middle">${ch}</text>`;
  let text = digit(code[0], (quiet - 4) * module);
  for (let i = 1; i <= 6; i++) text += digit(code[i], (quiet + 3 + (i - 0.5) * 7) * module);
  for (let i = 7; i <= 12; i++) text += digit(code[i], (quiet + 50 + (i - 6.5) * 7) * module);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="바코드 ${code}">`
    + `<rect width="${W}" height="${H}" fill="#fff"/><g fill="#000">${bars}</g><g fill="#000" font-family="monospace">${text}</g></svg>`;
}
