import { useState, useCallback, useRef, useEffect } from 'react';
import type { Memo } from '../types';

interface UseMemoSaveOptions {
  initialMemo?: Memo | null;
  debounceMs?: number;
}

interface UseMemoSaveReturn {
  memo: Memo | null;
  content: string;
  isSaving: boolean;
  setContent: (content: string) => void;
  handleContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  setMemo: (memo: Memo | null) => void;
}

/**
 * 메모 저장 로직을 위한 공용 훅
 * - 디바운스된 자동 저장
 * - 저장 상태 관리
 * - 컴포넌트 언마운트 시 정리
 */
export function useMemoSave({
  initialMemo = null,
  debounceMs = 500,
}: UseMemoSaveOptions = {}): UseMemoSaveReturn {
  const [memo, setMemo] = useState<Memo | null>(initialMemo);
  const [content, setContent] = useState(initialMemo?.content || '');
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // initialMemo가 변경되면 상태 업데이트
  useEffect(() => {
    if (initialMemo) {
      setMemo(initialMemo);
      setContent(initialMemo.content);
    }
  }, [initialMemo]);

  // 메모 저장 함수
  const saveMemo = useCallback(async (newContent: string) => {
    if (!window.electronAPI?.saveMemo) return;

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const newMemo: Memo = {
        id: memo?.id || crypto.randomUUID(),
        content: newContent,
        createdAt: memo?.createdAt || now,
        updatedAt: now,
      };

      await window.electronAPI.saveMemo(newMemo);
      setMemo(newMemo);
    } catch (error) {
      console.error('Failed to save memo:', error);
    } finally {
      setIsSaving(false);
    }
  }, [memo]);

  // 내용 변경 핸들러 (디바운스 적용)
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMemo(newContent);
    }, debounceMs);
  }, [saveMemo, debounceMs]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    memo,
    content,
    isSaving,
    setContent,
    handleContentChange,
    setMemo,
  };
}
