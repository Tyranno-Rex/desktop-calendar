import { useEffect } from 'react';

interface MouseEventData {
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

/**
 * Desktop Mode에서 Electron이 전달하는 마우스 이벤트를 처리하는 훅
 * WorkerW에 임베딩된 창은 일반적인 마우스 이벤트를 받지 못하므로
 * Electron에서 마우스 위치를 모니터링하여 IPC로 전달함
 */
export function useDesktopMouseEvents() {
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

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
      element?.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: data.x,
        clientY: data.y,
        screenX: data.screenX,
        screenY: data.screenY
      }));
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

    // Cleanup: Electron IPC 리스너는 컴포넌트 생명주기와 무관하게
    // 앱 전체에서 한 번만 등록되므로 별도 cleanup 불필요
    // (window.electronAPI.on* 함수들은 등록만 하고 해제 함수를 반환하지 않음)
  }, []);
}
