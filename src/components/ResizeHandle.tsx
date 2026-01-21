import { memo, useCallback } from 'react';

interface ResizeHandleProps {
  direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
  visible?: boolean;
}

export const ResizeHandle = memo(function ResizeHandle({ direction, visible = false }: ResizeHandleProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!visible) return;
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    // Desktop Mode에서는 window에 mouseup이 dispatch됨
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, visible]);

  if (!visible) return null;

  return (
    <div
      className={`resize-handle resize-handle-${direction} resize-handle-active`}
      onMouseDown={handleMouseDown}
    />
  );
});
