// 립 매핑 화면 그리기 (lip.js · palette.js 공통)
// 영상 프레임 → #view 캔버스: 좌우 반전·회전해서 그린 뒤 같은 프레임의 입술 위치에 선택 색을 입힌다.
// 캔버스 내부 해상도는 원본(영상) 해상도 그대로 두고, 화면 크기는 CSS 로만 맞춘다 (DPR 배율로 키우지 않는다: 성능)
import { detectVideo } from './lip-tracker.js';
import { applyLipColor, smoothLips } from './lip-engine.js';

import { t as tr } from './i18n.js';

// 제품 제형 → 가장 가까운 가상 텍스처
export const FINISH_TO_TEXTURE = { glossy: 'glossy', matte: 'matte', satin: 'satin', velvet: 'matte', sheer: 'sheer', shimmer: 'shimmer' };

/**
 * 입술 좌표(원본 프레임 기준 0~1)를 반전·회전한 캔버스 기준 좌표로 옮긴다.
 * 그리는 순서와 같다: 먼저 좌우 반전, 그다음 시계 방향 회전
 */
export function mapPoint(p, mirror, rotate) {
  const u = mirror ? 1 - p.x : p.x;
  const v = p.y;
  switch (rotate) {
    case 90: return { x: 1 - v, y: u };
    case 180: return { x: 1 - u, y: 1 - v };
    case 270: return { x: v, y: 1 - u };
    default: return { x: u, y: v };
  }
}

/**
 * 한 프레임 그리기
 * @param {CanvasRenderingContext2D} ctx #view 캔버스
 * @param {{ src: CanvasImageSource, w: number, h: number, mirror?: boolean, rotate?: 0|90|180|270 }} frame 원본과 크기
 * @param {object|null} lips 입술 윤곽 (lip-tracker.js detectVideo 결과)
 * @param {{ hex: string, texture: string, intensity: number }} look 입힐 색
 */
export function drawLipFrame(ctx, frame, lips, look) {
  const { src, w, h, mirror = false } = frame;
  const rotate = ((Number(frame.rotate) || 0) % 360 + 360) % 360;
  const view = ctx.canvas;
  const swap = rotate === 90 || rotate === 270;
  const cw = swap ? h : w;
  const ch = swap ? w : h;
  if (view.width !== cw || view.height !== ch) { view.width = cw; view.height = ch; }
  // 원본을 화면 좌표(좌우 반전·회전)로 그린다. c 의 지금 변환 위에 덧붙인다
  const paint = (c) => {
    c.save();
    if (!rotate) {
      if (mirror) c.transform(-1, 0, 0, 1, w, 0); // 셀피 화면처럼 좌우 반전
      c.drawImage(src, 0, 0, w, h);
    } else { // 웹캠을 돌려 달았을 때: 가운데를 축으로 돌린 뒤 그린다
      c.translate(cw / 2, ch / 2);
      c.rotate((rotate * Math.PI) / 180);
      if (mirror) c.scale(-1, 1);
      c.drawImage(src, -w / 2, -h / 2, w, h);
    }
    c.restore();
  };
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paint(ctx);
  if (!lips) return;
  const pts = rotate ? { outer: lips.outer.map((p) => mapPoint(p, mirror, rotate)), inner: lips.inner.map((p) => mapPoint(p, mirror, rotate)) } : lips;
  // 툭 앱 USB 웹캠(ImageBitmap = 메모리에 디코딩된 그림)이면 입술 주변 조각만 작은 캔버스에 다시 그려 읽는다 (2026-11-28).
  // 화면 캔버스(GPU)에서 픽셀을 읽으면 GPU 가 그리기를 다 끝낼 때까지 메인 스레드가 기다린다
  const raster = typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap;
  const read = raster ? (x0, y0, bw, bh) => {
    if (cropCanvas.width < bw || cropCanvas.height < bh) {
      cropCanvas.width = Math.max(cropCanvas.width, bw + 32);
      cropCanvas.height = Math.max(cropCanvas.height, bh + 32);
    }
    cropCtx.setTransform(1, 0, 0, 1, -x0, -y0);
    paint(cropCtx);
    cropCtx.setTransform(1, 0, 0, 1, 0, 0);
    return cropCtx.getImageData(0, 0, bw, bh);
  } : null;
  applyLipColor(ctx, pts, cw, ch, rotate ? false : mirror, look, read);
}
const cropCanvas = document.createElement('canvas');
const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });

/** 새 카메라 프레임에서 입술을 찾고 이전 프레임과 부드럽게 잇는다 */
export async function trackLips(prev, video) {
  return smoothLips(prev, await detectVideo(video, performance.now()));
}

/** 카메라 스트림 끄기 */
export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/**
 * 터치 필름 보정이 켜져 있나 (touch-calib.js 엔진이 맨 위 창에 있다).
 * 켜져 있으면 터치는 페이지 안에서만 보정된다 → Android 카메라 권한 창은 필름으로 정확히 누를 수 없다
 */
export function filmMode() {
  try { return !!(window.top.__tookCalib?.saved || window.__tookCalib?.saved); } catch { return !!window.__tookCalib?.saved; }
}

/** getUserMedia 오류 → 화면 안내 문구 */
export function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return tr(filmMode() ? 'lip.camDeniedFilm' : 'lip.camDenied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return tr('lip.camNotFound');
    case 'NotReadableError':
      return tr('lip.camBusy');
    default:
      return tr('lip.camFailed') + `${e?.name ? `[${e.name}] ` : ''}${e?.message || e}`;
  }
}
