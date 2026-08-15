"use client";

import { useCallback, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export interface UseDragReorderOptions {
  /** Current row count — the hook measures every registered row up to this index on each pointer move. */
  itemCount: number;
  /** Fires once, on release or on an Arrow-key press, with the confirmed move. Never called mid-drag. */
  onReorder: (from: number, to: number) => void;
}

export interface DragHandleProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface UseDragReorderResult {
  /** Index currently being dragged, or `null` between drags — the row it belongs to dims. */
  draggingIndex: number | null;
  /** Index the pointer is currently over, or `null` — that row gets the drop outline. */
  dropTargetIndex: number | null;
  /** Ref callback for row `index`. The hook measures rows to know which one the pointer is over — wire it to the row's outer element, not the handle. */
  registerRow: (index: number) => (el: HTMLElement | null) => void;
  /** Spread onto the row's drag handle. Drives both the pointer gesture and its Arrow-Up/Down keyboard fallback. */
  getHandleProps: (index: number) => DragHandleProps;
}

/**
 * Reorders a list by dragging its handle, with pointer events instead of the
 * native HTML5 drag-and-drop API — native `draggable` never fires from touch,
 * which would make reordering impossible on a phone (the one thing
 * `GallerySection.tsx`'s mouse-only `draggable` gallery gets away with, being
 * desktop-only in practice). `setPointerCapture` on `pointerdown` keeps every
 * following pointermove/up/cancel for that pointer routed to the same handle
 * even once the finger leaves its bounds, so one set of handlers covers the
 * whole gesture regardless of where it ends.
 *
 * Rows never actually reorder mid-drag — only `dropTargetIndex` moves, purely
 * visual — so `onReorder` fires exactly once, on release. That keeps a
 * handle's own `index` closure valid for the whole gesture: nothing shifts
 * under it until the caller commits the move.
 *
 * The keyboard path (Arrow Up/Down while the handle has focus) calls the same
 * `onReorder` directly. It's the accessible way to reorder — WCAG AA needs a
 * non-pointer path — but it's never rendered as a separate up/down button;
 * the handle itself is the only visible control.
 */
export function useDragReorder({ itemCount, onReorder }: UseDragReorderOptions): UseDragReorderResult {
  const [draggingIndex, setDraggingIndexState] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndexState] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  // Pointer events can fire faster than a state update commits and the
  // closures in `getHandleProps` refresh — read/write these refs inside the
  // handlers instead of trusting the state variables above, which exist only
  // to drive the dim/outline classes on render.
  const draggingIndexRef = useRef<number | null>(null);
  const dropTargetIndexRef = useRef<number | null>(null);

  function setDragging(index: number | null): void {
    draggingIndexRef.current = index;
    setDraggingIndexState(index);
  }

  function setDropTarget(index: number | null): void {
    dropTargetIndexRef.current = index;
    setDropTargetIndexState(index);
  }

  const registerRow = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      rowRefs.current[index] = el;
    },
    [],
  );

  const indexClosestToPointer = useCallback(
    (clientY: number): number => {
      let closest = draggingIndexRef.current ?? 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < itemCount; index += 1) {
        const row = rowRefs.current[index];
        if (!row) continue;
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(clientY - (rect.top + rect.height / 2));
        if (distance < closestDistance) {
          closestDistance = distance;
          closest = index;
        }
      }
      return closest;
    },
    [itemCount],
  );

  const endDrag = useCallback(
    (commit: boolean): void => {
      const from = draggingIndexRef.current;
      const to = dropTargetIndexRef.current;
      setDragging(null);
      setDropTarget(null);
      if (commit && from !== null && to !== null && to !== from) onReorder(from, to);
    },
    [onReorder],
  );

  const getHandleProps = useCallback(
    (index: number): DragHandleProps => ({
      onPointerDown: (event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(index);
        setDropTarget(index);
      },
      onPointerMove: (event) => {
        if (draggingIndexRef.current === null) return;
        const next = indexClosestToPointer(event.clientY);
        if (next !== dropTargetIndexRef.current) setDropTarget(next);
      },
      onPointerUp: () => {
        if (draggingIndexRef.current === null) return;
        endDrag(true);
      },
      onPointerCancel: () => {
        if (draggingIndexRef.current === null) return;
        endDrag(false);
      },
      onKeyDown: (event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        const target = index + (event.key === "ArrowUp" ? -1 : 1);
        if (target < 0 || target >= itemCount) return;
        onReorder(index, target);
      },
    }),
    [itemCount, onReorder, indexClosestToPointer, endDrag],
  );

  return { draggingIndex, dropTargetIndex, registerRow, getHandleProps };
}
