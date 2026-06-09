import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useReaderStore, type FloatingPanelPosition, type FloatingPanelSize } from "@/stores/reader";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 300;
const EDGE_THRESHOLD = 6;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startPos: FloatingPanelPosition;
}

interface ResizeState {
  pointerId: number;
  edge: string;
  startX: number;
  startY: number;
  startPos: FloatingPanelPosition;
  startSize: FloatingPanelSize;
}

interface FloatingChatPanelProps {
  children: React.ReactNode;
}

export function FloatingChatPanel({ children }: FloatingChatPanelProps) {
  const { t } = useTranslation("reader");
  const {
    floatingPanelPosition,
    floatingPanelSize,
    set: setReader,
  } = useReaderStore();

  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [position, setPosition] = useState<FloatingPanelPosition>(floatingPanelPosition);
  const [size, setSize] = useState<FloatingPanelSize>(floatingPanelSize);

  // Initialize default position (bottom-right) on first mount
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const pos = useReaderStore.getState().floatingPanelPosition;
    if (pos.x === 0 && pos.y === 0) {
      const defaultX = Math.max(20, window.innerWidth - (size.width + 20));
      const defaultY = Math.max(20, window.innerHeight - (size.height + 20));
      const newPos = { x: defaultX, y: defaultY };
      setPosition(newPos);
      setReader({ floatingPanelPosition: newPos });
    }
  }, [setReader, size.width, size.height]);

  // Clamp position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;
        const clampedX = Math.max(0, Math.min(prev.x, maxX));
        const clampedY = Math.max(0, Math.min(prev.y, maxY));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const newPos = { x: clampedX, y: clampedY };
          setReader({ floatingPanelPosition: newPos });
          return newPos;
        }
        return prev;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size.width, size.height, setReader]);

  // Persist position to store on drag end
  const persistPosition = useCallback(
    (pos: FloatingPanelPosition) => {
      setReader({ floatingPanelPosition: pos });
    },
    [setReader],
  );

  // Persist size to store on resize end
  const persistSize = useCallback(
    (newSize: FloatingPanelSize) => {
      setReader({ floatingPanelSize: newSize });
    },
    [setReader],
  );

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPos: position,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position],
  );

  const handleDragPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      const deltaX = e.clientX - drag.startX;
      const deltaY = e.clientY - drag.startY;
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      const newX = Math.max(0, Math.min(drag.startPos.x + deltaX, maxX));
      const newY = Math.max(0, Math.min(drag.startPos.y + deltaY, maxY));
      setPosition({ x: newX, y: newY });
    },
    [size.width, size.height],
  );

  const handleDragPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragStateRef.current = null;
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
      persistPosition(position);
    },
    [position, persistPosition],
  );

  const getResizeEdge = useCallback((e: React.PointerEvent<HTMLDivElement>): string | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    const left = relX < EDGE_THRESHOLD;
    const right = relX > w - EDGE_THRESHOLD;
    const top = relY < EDGE_THRESHOLD;
    const bottom = relY > h - EDGE_THRESHOLD;

    if (top && left) return "top-left";
    if (top && right) return "top-right";
    if (bottom && left) return "bottom-left";
    if (bottom && right) return "bottom-right";
    if (top) return "top";
    if (bottom) return "bottom";
    if (left) return "left";
    if (right) return "right";

    return null;
  }, []);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const edge = getResizeEdge(e);
      if (!edge || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      resizeStateRef.current = {
        pointerId: e.pointerId,
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startPos: position,
        startSize: size,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getResizeEdge, position, size],
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current;
      if (!rs || rs.pointerId !== e.pointerId) return;

      const deltaX = e.clientX - rs.startX;
      const deltaY = e.clientY - rs.startY;

      let newX = rs.startPos.x;
      let newY = rs.startPos.y;
      let newW = rs.startSize.width;
      let newH = rs.startSize.height;

      if (rs.edge.includes("right")) {
        newW = Math.max(MIN_WIDTH, rs.startSize.width + deltaX);
      }
      if (rs.edge.includes("left")) {
        const proposedW = rs.startSize.width - deltaX;
        if (proposedW >= MIN_WIDTH) {
          newW = proposedW;
          newX = rs.startPos.x + deltaX;
        } else {
          newW = MIN_WIDTH;
          newX = rs.startPos.x + (rs.startSize.width - MIN_WIDTH);
        }
      }
      if (rs.edge.includes("bottom")) {
        newH = Math.max(MIN_HEIGHT, rs.startSize.height + deltaY);
      }
      if (rs.edge.includes("top")) {
        const proposedH = rs.startSize.height - deltaY;
        if (proposedH >= MIN_HEIGHT) {
          newH = proposedH;
          newY = rs.startPos.y + deltaY;
        } else {
          newH = MIN_HEIGHT;
          newY = rs.startPos.y + (rs.startSize.height - MIN_HEIGHT);
        }
      }

      // Clamp position within viewport
      const maxX = window.innerWidth - newW;
      const maxY = window.innerHeight - newH;
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
      setSize({ width: newW, height: newH });
    },
    [],
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rs = resizeStateRef.current;
      if (!rs || rs.pointerId !== e.pointerId) return;
      resizeStateRef.current = null;
      if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      }
      persistPosition(position);
      persistSize(size);
    },
    [position, size, persistPosition, persistSize],
  );

  const getCursorForEdge = useCallback((edge: string | null) => {
    switch (edge) {
      case "top":
      case "bottom":
        return "ns-resize";
      case "left":
      case "right":
        return "ew-resize";
      case "top-left":
      case "bottom-right":
        return "nwse-resize";
      case "top-right":
      case "bottom-left":
        return "nesw-resize";
      default:
        return undefined;
    }
  }, []);

  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);

  return createPortal(
    <div
      ref={containerRef}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-background shadow-xl select-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: getCursorForEdge(hoveredEdge),
      }}
      onPointerDown={handleResizePointerDown}
      onPointerMove={(e) => {
        if (resizeStateRef.current) {
          handleResizePointerMove(e);
        } else {
          setHoveredEdge(getResizeEdge(e));
        }
      }}
      onPointerUp={handleResizePointerUp}
    >
      {/* Draggable header */}
      <div
        className="flex h-10 shrink-0 cursor-grab items-center border-b px-3 active:cursor-grabbing"
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
      >
        <span className="text-xs text-muted-foreground">{t("chatPanel")}</span>
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  );
}
