/**
 * 글자가 아닌 것(링크·버튼·그림)은 끌어 가거나 우클릭 메뉴로 저장하지 못하게 한다(사용자 결정 2026-10-04).
 * 링크를 끌면 주소가 따라 보이고, 그림은 끌어서 저장할 수 있었다. 글자 선택·복사는 그대로 둔다.
 * CSS(-webkit-user-drag)는 파이어폭스가 몰라서 이벤트로도 막는다. dnd-kit(사진 순서·일정 정렬)은
 * HTML5 드래그를 쓰지 않아 영향이 없다 — 일부러 draggable="true"를 단 요소만 예외로 둔다.
 */
function elementOf(target: EventTarget | null): Element | null {
  return target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
}

export function shouldBlockDrag(target: EventTarget | null): boolean {
  const el = elementOf(target);
  if (!el) return false;
  if (el.closest('[draggable="true"]')) return false;
  return !!el.closest('a, img, svg, picture, video, canvas, button');
}

export function shouldBlockContextMenu(target: EventTarget | null): boolean {
  const el = elementOf(target);
  return !!el?.closest('img, picture, video');
}

/** 앱 시작 때 한 번 — 해제 함수를 돌려준다(시험용) */
export function installContentGuards(doc: Document = document): () => void {
  const onDragStart = (e: DragEvent) => {
    if (shouldBlockDrag(e.target)) e.preventDefault();
  };
  const onContextMenu = (e: MouseEvent) => {
    if (shouldBlockContextMenu(e.target)) e.preventDefault();
  };
  doc.addEventListener('dragstart', onDragStart);
  doc.addEventListener('contextmenu', onContextMenu);
  return () => {
    doc.removeEventListener('dragstart', onDragStart);
    doc.removeEventListener('contextmenu', onContextMenu);
  };
}
