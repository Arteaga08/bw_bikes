"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** How long the button stays in its confirmed state before returning to normal. */
const DEFAULT_SUCCESS_MS = 2000;

export interface UseAsyncActionOptions {
  /** Milliseconds the `succeeded` flag stays true. Long enough to read, short enough not to feel stuck. */
  successMs?: number;
}

export interface AsyncAction {
  /** Wire to `onClick`. Ignores the call outright while one is already in flight or confirming. */
  run: () => void;
  /** Wire to the button's `loading`. */
  pending: boolean;
  /** Wire to the button's `success`. */
  succeeded: boolean;
}

/**
 * Runs an async action at most once at a time, then holds a short confirmation
 * window — the two halves of "no double clicks".
 *
 * A disabled attribute alone doesn't close the gap: between the first click and
 * React committing `pending`, a fast second click still dispatches. The `inFlight`
 * ref is checked synchronously inside the handler, so the second call returns
 * before it can start anything. The `disabled` attribute the button gets from
 * `pending`/`succeeded` is then the visible half of the same guarantee.
 *
 * The confirmation window counts as busy too: for something like "Agregar al
 * carrito", the moment right after success is exactly when an impatient second
 * click would add a second unit.
 *
 * ```tsx
 * const add = useAsyncAction(async () => {
 *   await addToCart(sku);
 *   toast({ variant: "success", title: "Agregado al carrito" });
 * });
 *
 * <Button onClick={add.run} loading={add.pending} success={add.succeeded} successLabel="Agregado">
 *   Agregar al carrito
 * </Button>
 * ```
 */
export function useAsyncAction(action: () => Promise<void>, { successMs = DEFAULT_SUCCESS_MS }: UseAsyncActionOptions = {}): AsyncAction {
  const [pending, setPending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  // Synchronous re-entry guard. State can't do this job: it isn't readable
  // until React re-renders, and a double click beats that.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kept in a ref so `run` is stable across renders even when the caller passes
  // a fresh closure each time (the normal case for an inline arrow function).
  // Synced in an effect, not during render: writing a ref while rendering is
  // unsafe under concurrent rendering, where a render can be thrown away.
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const run = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);

    void actionRef
      .current()
      .then(() => {
        if (!mounted.current) return;
        setSucceeded(true);
        timer.current = setTimeout(() => {
          if (!mounted.current) return;
          setSucceeded(false);
          // Released only here, not when the promise settles: the confirmation
          // window is part of the lockout.
          inFlight.current = false;
        }, successMs);
      })
      .catch(() => {
        // The action owns its own error reporting (a toast, an inline message).
        // All this needs to do is unlock so the user can retry immediately.
        if (mounted.current) inFlight.current = false;
      })
      .finally(() => {
        if (mounted.current) setPending(false);
      });
  }, [successMs]);

  return { run, pending, succeeded };
}
