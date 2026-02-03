import { useEffect } from 'react';

interface MouseEventData {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

// 전역 hover 상태 관리
let currentHoveredElement: Element | null = null;

/**
 * Desktop Mode에서 Electron이 전달하는 마우스 이벤트를 처리하는 훅
 * WorkerW에 임베딩된 창은 일반적인 마우스 이벤트를 받지 못하므로
 * Electron에서 마우스 위치를 모니터링하여 IPC로 전달함
 */
export function useDesktopMouseEvents() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Hover 이벤트 핸들러 - Desktop Mode에서 :hover 대체
    const handleHover = (data: MouseEventData) => {
      const element = document.elementFromPoint(data.x, data.y);

      // 이전 hover 요소와 다르면 상태 업데이트
      if (element !== currentHoveredElement) {
        // 이전 요소에서 hover 클래스 제거
        if (currentHoveredElement) {
          removeHoverState(currentHoveredElement);
        }

        // 새 요소에 hover 클래스 추가
        if (element) {
          addHoverState(element);
        }

        currentHoveredElement = element;
      }
    };

    // MouseLeave 핸들러 - 창을 떠날 때 모든 hover 상태 제거
    const handleMouseLeave = () => {
      if (currentHoveredElement) {
        removeHoverState(currentHoveredElement);
        currentHoveredElement = null;
      }
    };

    // Click 이벤트 핸들러
    const handleClick = (data: MouseEventData) => {
      if (document.hasFocus()) return;
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        element.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: data.x,
          clientY: data.y,
          screenX: data.screenX,
          screenY: data.screenY
        }));
      }
    };

    // MouseDown 이벤트 핸들러
    const handleMouseDown = (data: MouseEventData) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        // active 상태 추가
        addActiveState(element);
        element.dispatchEvent(new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: data.x,
          clientY: data.y,
          screenX: data.screenX,
          screenY: data.screenY
        }));
      }
    };

    // MouseMove 이벤트 핸들러
    const handleMouseMove = (data: MouseEventData) => {
      window.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: data.x,
        clientY: data.y,
        screenX: data.screenX,
        screenY: data.screenY
      }));
    };

    // MouseUp 이벤트 핸들러
    const handleMouseUp = (data: MouseEventData) => {
      // 모든 active 상태 제거
      document.querySelectorAll('.desktop-active').forEach(el => {
        el.classList.remove('desktop-active');
      });

      window.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: data.x,
        clientY: data.y,
        screenX: data.screenX,
        screenY: data.screenY
      }));
    };

    // DblClick 이벤트 핸들러 - 날짜 셀 더블클릭 시 팝업 열기
    const handleDblClick = (data: MouseEventData) => {
      const element = document.elementFromPoint(data.x, data.y);
      if (element) {
        const dateCell = element.closest('[data-date]');
        if (dateCell) {
          const dateStr = dateCell.getAttribute('data-date');
          if (dateStr) {
            api.openPopup?.({
              type: 'add-event',
              date: dateStr,
              x: data.screenX,
              y: data.screenY
            });
          }
        }
      }
    };

    // 이벤트 리스너 등록
    api.onDesktopClick?.(handleClick);
    api.onDesktopMouseDown?.(handleMouseDown);
    api.onDesktopMouseMove?.(handleMouseMove);
    api.onDesktopMouseUp?.(handleMouseUp);
    api.onDesktopDblClick?.(handleDblClick);
    api.onDesktopHover?.(handleHover);
    api.onDesktopMouseLeave?.(handleMouseLeave);

    // Cleanup: Electron IPC 리스너는 컴포넌트 생명주기와 무관하게
    // 앱 전체에서 한 번만 등록되므로 별도 cleanup 불필요
    // (window.electronAPI.on* 함수들은 등록만 하고 해제 함수를 반환하지 않음)
  }, []);
}

// hover 상태 추가 (요소와 부모들에게)
function addHoverState(element: Element) {
  let current: Element | null = element;
  while (current) {
    current.classList.add('desktop-hover');
    current = current.parentElement;
  }
}

// hover 상태 제거 (모든 요소에서)
function removeHoverState(element: Element) {
  // 해당 요소와 부모들에서 제거
  let current: Element | null = element;
  while (current) {
    current.classList.remove('desktop-hover');
    current = current.parentElement;
  }
  // 혹시 남아있는 것도 정리
  document.querySelectorAll('.desktop-hover').forEach(el => {
    el.classList.remove('desktop-hover');
  });
}

// active 상태 추가
function addActiveState(element: Element) {
  let current: Element | null = element;
  while (current) {
    current.classList.add('desktop-active');
    current = current.parentElement;
  }
}
