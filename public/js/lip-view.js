// 립 매핑 화면 그리기 (lip.js · mirror.js 공통)
// 영상 프레임 → #view 캔버스: 좌우 반전·회전해서 그린 뒤 같은 프레임의 입술 위치에 선택 색을 입힌다.
// 캔버스 내부 해상도는 원본(영상) 해상도 그대로 두고, 화면 크기는 CSS 로만 맞춘다 (DPR 배율로 키우지 않는다: 성능)
import { detectVideo } from './lip-tracker.js';
import { applyLipColor, smoothLips } from './lip-engine.js';
import { t as tr } from './i18n.js';

// 제품 제형 → 가장 가까운 가상 텍스처
export const FINISH_TO_TEXTURE = { glossy: 'glossy', matte: 'matte', satin: 'satin', velvet: 'matte' };

/**
 * 입술 좌표(원본 프레임 기준 0~1)를 반전·회전한 캔버스 기준 좌표로 옮긴다.
 * 그리는 순서와 같다: 먼저 좌우 반전, 그다음 시계 방향 회전
 */
function mapPoint(p, mirror, rotate) {
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
  ctx.save();
  if (!rotate) {
    // 회전 없음: 기존 립 매핑 화면과 같은 경로
    if (mirror) ctx.setTransform(-1, 0, 0, 1, w, 0); // 셀피 화면처럼 좌우 반전
    ctx.drawImage(src, 0, 0, w, h);
    ctx.restore();
    if (lips) applyLipColor(ctx, lips, w, h, mirror, look);
    return;
  }
  // 웹캠을 돌려 달았을 때: 가운데를 축으로 돌린 뒤 그린다
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  if (mirror) ctx.scale(-1, 1);
  ctx.drawImage(src, -w / 2, -h / 2, w, h);
  ctx.restore();
  if (lips) {
    const map = (pts) => pts.map((p) => mapPoint(p, mirror, rotate));
    applyLipColor(ctx, { outer: map(lips.outer), inner: map(lips.inner) }, cw, ch, false, look);
  }
}

/** 새 카메라 프레임에서 입술을 찾고 이전 프레임과 부드럽게 잇는다 */
export async function trackLips(prev, video) {
  return smoothLips(prev, await detectVideo(video, performance.now()));
}

/** 카메라 스트림 끄기 */
export function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** getUserMedia 오류 → 화면 안내 문구 */
export function cameraErrorMessage(e) {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return tr('lip.camDenied');
    case 'NotFoundError':
    case 'OverconstrainedError':
      return tr('lip.camNotFound');
    case 'NotReadableError':
      return tr('lip.camBusy');
    default:
      return tr('lip.camFailed') + (e?.message || e);
  }
}
