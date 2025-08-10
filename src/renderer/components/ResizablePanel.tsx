import React, { useState, useRef, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  resizeDirection: 'horizontal' | 'vertical' | 'both';
  onResize?: (width: number, height: number) => void;
  className?: string;
  resizerPosition?: 'right' | 'left' | 'bottom' | 'top';
}

export function ResizablePanel({
  children,
  width = 280,
  height = 200,
  minWidth = 200,
  maxWidth = 500,
  minHeight = 120,
  maxHeight = 300,
  resizeDirection,
  onResize,
  className = '',
  resizerPosition = 'right'
}: ResizablePanelProps) {
  const [currentWidth, setCurrentWidth] = useState(width);
  const [currentHeight, setCurrentHeight] = useState(height);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const rect = panelRef.current.getBoundingClientRect();
      let newWidth = currentWidth;
      let newHeight = currentHeight;

      if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
        if (resizerPosition === 'right') {
          newWidth = Math.max(minWidth, Math.min(maxWidth, e.clientX - rect.left));
        } else if (resizerPosition === 'left') {
          newWidth = Math.max(minWidth, Math.min(maxWidth, rect.right - e.clientX));
        }
      }

      if (resizeDirection === 'vertical' || resizeDirection === 'both') {
        if (resizerPosition === 'bottom') {
          newHeight = Math.max(minHeight, Math.min(maxHeight, e.clientY - rect.top));
        } else if (resizerPosition === 'top') {
          newHeight = Math.max(minHeight, Math.min(maxHeight, rect.bottom - e.clientY));
        }
      }

      setCurrentWidth(newWidth);
      setCurrentHeight(newHeight);
      onResize?.(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = resizeDirection === 'horizontal' ? 'col-resize' : 
                                  resizeDirection === 'vertical' ? 'row-resize' : 'nwse-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, currentWidth, currentHeight, resizeDirection, minWidth, maxWidth, minHeight, maxHeight, onResize, resizerPosition]);

  const getResizerStyle = () => {
    const baseStyle = "absolute bg-transparent hover:bg-blue-500/20 transition-colors z-10";
    
    switch (resizerPosition) {
      case 'right':
        return `${baseStyle} top-0 right-0 w-1 h-full cursor-col-resize hover:w-2`;
      case 'left':
        return `${baseStyle} top-0 left-0 w-1 h-full cursor-col-resize hover:w-2`;
      case 'bottom':
        return `${baseStyle} bottom-0 left-0 w-full h-1 cursor-row-resize hover:h-2`;
      case 'top':
        return `${baseStyle} top-0 left-0 w-full h-1 cursor-row-resize hover:h-2`;
      default:
        return baseStyle;
    }
  };

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={{
        width: resizeDirection === 'horizontal' || resizeDirection === 'both' ? currentWidth : undefined,
        height: resizeDirection === 'vertical' || resizeDirection === 'both' ? currentHeight : undefined,
      }}
    >
      {children}
      <div
        className={getResizerStyle()}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}
