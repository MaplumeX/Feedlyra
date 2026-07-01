import { cloneElement, useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { useReaderStore, type FloatingPanelPosition, type FloatingPanelSize } from "@/stores/reader";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 420;
const EDGE_THRESHOLD = 6;

// Pointer event handlers injected into the child (AIChatPanel) header to make it a drag handle.
export type FloatingDragHandlers = {
  onHeaderPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
};

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
  children: ReactElement<FloatingChildProps>;
}

/**
 * Props the panel injects into its single child via cloneElement. Declared locally
 * so FloatingChatPanel does not need to import the child component's full prop type.
 */
export interface FloatingChildProps {
  draggable?: boolean;
  onHeaderPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * Highlight overlay shown when the pointer enters a resize edge / corner.
 * pointer-events-none so it never blocks the container's edge detection.
 */
function ResizeEdgeOverlay({ edge, active }: { edge: string | null; active: boolean }) {
  if (!edge) return null;
  const opacity = active ? "opacity-50" : "opacity-30";
  const edgeStyles: Record<string, string> = {
    top: "inset-x-0 top-0 h-px",
    bottom: "inset-x-0 bottom-0 h-px",
    left: "inset-y-0 left-0 w-px",
    right: "inset-y-0 right-0 w-px",
    "top-left": "top-0 left-0 h-1.5 w-1.5",
    "top-right": "top-0 right-0 h-1.5 w-1.5",
    "bottom-left": "bottom-0 left-0 h-1.5 w-1.5",
    "bottom-right": "bottom-0 right-0 h-1.5 w-1.5",
  };
  const pos = edgeStyles[edge];
  if (!pos) return null;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute bg-primary transition-opacity",
        pos,
        opacity,
      )}
    />
  );
}

export function FloatingChatPanel({ children }: FloatingChatPanelProps) {
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
      // Header is the explicit drag handle — never let the container's resize
      // edge detection (which fires via bubbling) also start a resize here.
      e.stopPropagation();
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
    // The header is an explicit drag handle — never treat it as a resize edge,
    // even when the pointer sits within the top 6px zone that overlaps the header.
    if ((e.target as HTMLElement).closest("[data-floating-drag-handle]")) return null;
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

  const dragProps: FloatingDragHandlers = {
    onHeaderPointerDown: handleDragPointerDown,
    onHeaderPointerMove: handleDragPointerMove,
    onHeaderPointerUp: handleDragPointerUp,
  };

  return createPortal(
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-background shadow-lg select-none transition-shadow",
        "focus-within:ring-1 focus-within:ring-primary/10",
      )}
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
      {/* Resize edge highlight overlay (8 edges/corners) */}
      <ResizeEdgeOverlay edge={hoveredEdge} active={!!resizeStateRef.current} />

      {/* Content area — inject drag handlers into the child (AIChatPanel) header.
          Plain block (not flex) so the child fills the panel width; a flex row
          with one non-flex-1 child leaves the panel's right edge blank. */}
      <div className="min-h-0 flex-1">
        {cloneElement(children, { draggable: true, ...dragProps })}
      </div>
    </div>,
    document.body,
  );
}
