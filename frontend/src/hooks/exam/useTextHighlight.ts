/**
 * Hook quản lý text highlighting cho bài đọc IELTS
 * Lưu highlights vào localStorage để persist qua F5
 */
import { useState, useEffect, useCallback } from 'react';

export interface TextHighlight {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  color: string;
  timestamp: number;
}

interface UseTextHighlightOptions {
  submissionId: number;
  passageId: number;
  enabled?: boolean;
}

const HIGHLIGHT_COLORS = {
  yellow: '#fef08a',    // bg-yellow-200
  green: '#bbf7d0',     // bg-green-200
  blue: '#bfdbfe',      // bg-blue-200
  pink: '#fbcfe8',      // bg-pink-200
  orange: '#fed7aa',    // bg-orange-200
} as const;

export type HighlightColor = keyof typeof HIGHLIGHT_COLORS;

export function useTextHighlight({ submissionId, passageId, enabled = true }: UseTextHighlightOptions) {
  const storageKey = `ielts_highlights_${submissionId}_${passageId}`;

  const [highlights, setHighlights] = useState<TextHighlight[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');

  // Lưu highlights vào localStorage
  useEffect(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(highlights));
    } catch (e) {
      console.error('Failed to save highlights:', e);
    }
  }, [highlights, storageKey, enabled]);

  const addHighlight = useCallback((highlight: Omit<TextHighlight, 'id' | 'timestamp'>) => {
    const newHighlight: TextHighlight = {
      ...highlight,
      id: `hl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    setHighlights(prev => [...prev, newHighlight]);
  }, []);

  const removeHighlight = useCallback((id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  }, []);

  const clearAllHighlights = useCallback(() => {
    setHighlights([]);
  }, []);

  const updateHighlightColor = useCallback((id: string, color: HighlightColor) => {
    setHighlights(prev =>
      prev.map(h => (h.id === id ? { ...h, color: HIGHLIGHT_COLORS[color] } : h))
    );
  }, []);

  return {
    highlights,
    selectedColor,
    setSelectedColor,
    addHighlight,
    removeHighlight,
    clearAllHighlights,
    updateHighlightColor,
    colors: HIGHLIGHT_COLORS,
  };
}
