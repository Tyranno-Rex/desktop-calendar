import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './WheelPicker.css';

interface WheelPickerProps {
  items: { value: number; label: string }[];
  selectedValue: number;
  onSelect: (value: number) => void;
  onClose: () => void;
  visibleItems?: number;
}

export function WheelPicker({
  items,
  selectedValue,
  onSelect,
  onClose,
  visibleItems = 7,
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = items.findIndex(item => item.value === selectedValue);
    return idx >= 0 ? idx : 0;
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartIndex = useRef(0);

  const itemHeight = 40;
  const halfVisible = Math.floor(visibleItems / 2);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartIndex.current = currentIndex;
    e.preventDefault();
  }, [currentIndex]);

  // 드래그 중
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = dragStartY.current - e.clientY;
      const deltaIndex = Math.round(deltaY / itemHeight);
      const newIndex = Math.max(0, Math.min(items.length - 1, dragStartIndex.current + deltaIndex));
      setCurrentIndex(newIndex);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, items.length]);

  // 휠 스크롤
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    setCurrentIndex(prev => Math.max(0, Math.min(items.length - 1, prev + delta)));
  }, [items.length]);

  // 아이템 클릭
  const handleItemClick = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // 확인 버튼
  const handleConfirm = useCallback(() => {
    onSelect(items[currentIndex].value);
    onClose();
  }, [currentIndex, items, onSelect, onClose]);

  // 바깥 클릭 시 닫기
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // 3D 원통 효과 계산
  const getItemStyle = (index: number) => {
    const distance = index - currentIndex;
    const absDistance = Math.abs(distance);

    // 각도 (원통 효과)
    const angle = distance * 25;
    // 투명도 (멀수록 흐려짐)
    const opacity = Math.max(0.2, 1 - absDistance * 0.25);
    // 크기 (멀수록 작아짐)
    const scale = Math.max(0.7, 1 - absDistance * 0.1);
    // Z축 이동 (원통 깊이감)
    const translateZ = -absDistance * 10;

    return {
      transform: `rotateX(${angle}deg) scale(${scale}) translateZ(${translateZ}px)`,
      opacity,
      zIndex: 10 - absDistance,
    };
  };

  return (
    <AnimatePresence>
      <motion.div
        className="wheel-picker-backdrop"
        onClick={handleBackdropClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="wheel-picker-container"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="wheel-picker-wheel"
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
            style={{ height: itemHeight * visibleItems }}
          >
            {/* 선택 영역 하이라이트 */}
            <div
              className="wheel-picker-highlight"
              style={{
                top: halfVisible * itemHeight,
                height: itemHeight
              }}
            />

            {/* 그라데이션 마스크 */}
            <div className="wheel-picker-mask wheel-picker-mask-top" />
            <div className="wheel-picker-mask wheel-picker-mask-bottom" />

            {/* 아이템 목록 */}
            <div
              className="wheel-picker-items"
              style={{
                transform: `translateY(${(halfVisible - currentIndex) * itemHeight}px)`,
                perspective: '1000px',
              }}
            >
              {items.map((item, index) => {
                const distance = Math.abs(index - currentIndex);
                if (distance > halfVisible + 1) return null;

                return (
                  <div
                    key={item.value}
                    className={`wheel-picker-item ${index === currentIndex ? 'selected' : ''}`}
                    style={{
                      height: itemHeight,
                      ...getItemStyle(index),
                    }}
                    onClick={() => handleItemClick(index)}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="wheel-picker-actions">
            <button className="wheel-picker-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button className="wheel-picker-btn confirm" onClick={handleConfirm}>
              OK
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
