import { memo, useCallback } from 'react';

interface ResizeHandleProps {
  direction: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
}

export const ResizeHandle = memo(function ResizeHandle({ direction }: ResizeHandleProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    window.electronAPI?.startResize(direction);

    const handleMouseUp = () => {
      window.electronAPI?.stopResize();
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mouseup', handleMouseUp);
  }, [direction]);

  return (
    <div
      className={`resize-handle resize-handle-${direction}`}
      onMouseDown={handleMouseDown}
    />
  );
});
