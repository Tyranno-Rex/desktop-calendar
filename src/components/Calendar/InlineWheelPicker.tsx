import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import './InlineWheelPicker.css';

interface InlineWheelPickerProps {
  items: { value: number; label: string }[];
  selectedValue: number;
  onSelect: (value: number) => void;
  onClose: () => void;
}

export function InlineWheelPicker({
  items,
  selectedValue,
  onSelect,
  onClose,
}: InlineWheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = items.findIndex(item => item.value === selectedValue);
    return idx >= 0 ? idx : 0;
  });
  const [isExpanded, setIsExpanded] = useState(false);

  const itemHeight = 36;
  const visibleItems = 5;
  const halfVisible = Math.floor(visibleItems / 2);

  // 마운트 시 확장 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setIsExpanded(true), 50);
    return () => clearTimeout(timer);
  }, []);


  // 휠 스크롤
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1 : -1;
    setCurrentIndex(prev => Math.max(0, Math.min(items.length - 1, prev + delta)));
  }, [items.length]);

  // 아이템 클릭
  const handleItemClick = useCallback((index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(index);
    onSelect(items[index].value);
    onClose();
  }, [items, onSelect, onClose]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 약간의 딜레이 후 리스너 등록 (클릭으로 열렸을 때 바로 닫히는 것 방지)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // 3D 원통 효과 계산
  const getItemStyle = (index: number) => {
    const distance = index - currentIndex;
    const absDistance = Math.abs(distance);

    // 각도 (원통 효과)
    const angle = distance * 30;
    // 투명도 (멀수록 흐려짐) - 완전히 투명하게
    const opacity = absDistance === 0 ? 1 : Math.max(0, 0.7 - absDistance * 0.25);
    // 크기 (멀수록 작아짐)
    const scale = Math.max(0.6, 1 - absDistance * 0.15);

    return {
      transform: `rotateX(${angle}deg) scale(${scale})`,
      opacity: isExpanded ? opacity : (absDistance === 0 ? 1 : 0),
    };
  };

  return (
    <motion.div
      ref={containerRef}
      className="inline-wheel-picker"
      initial={{ height: itemHeight }}
      animate={{ height: isExpanded ? itemHeight * visibleItems : itemHeight }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onWheel={handleWheel}
    >
      {/* 선택 영역 하이라이트 */}
      <div
        className="inline-wheel-highlight"
        style={{
          top: halfVisible * itemHeight,
          height: itemHeight,
          opacity: isExpanded ? 1 : 0,
        }}
      />

      {/* 그라데이션 마스크 */}
      <AnimatePresence>
        {isExpanded && (
          <>
            <motion.div
              className="inline-wheel-mask inline-wheel-mask-top"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="inline-wheel-mask inline-wheel-mask-bottom"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* 아이템 목록 */}
      <div
        className="inline-wheel-items"
        style={{
          transform: `translateY(${(halfVisible - currentIndex) * itemHeight}px)`,
        }}
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - currentIndex);
          // 확장되지 않았으면 선택된 것만, 확장되었으면 가까운 것들만 표시
          if (!isExpanded && distance > 0) return null;
          if (isExpanded && distance > halfVisible + 1) return null;

          return (
            <motion.div
              key={`${item.value}-${index}`}
              className={`inline-wheel-item ${index === currentIndex ? 'selected' : ''}`}
              style={{
                height: itemHeight,
                ...getItemStyle(index),
              }}
              onClick={(e) => handleItemClick(index, e)}
            >
              {item.label}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
