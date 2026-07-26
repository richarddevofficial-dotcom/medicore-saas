"use client";

import { useEffect, useRef, useCallback } from "react";

const IDLE_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

/**
 * useIdleTimeout
 * @param {number} timeoutMs - Total idle time before logout (default 5 min)
 * @param {number} warningMs - Time before logout to show warning (default 1 min)
 * @param {Function} onWarning - Called when warning threshold is reached
 * @param {Function} onLogout - Called when idle timeout expires
 */
export default function useIdleTimeout({
  timeoutMs = 5 * 60 * 1000,
  warningMs = 1 * 60 * 1000,
  onWarning,
  onLogout,
}) {
  const logoutTimer = useRef(null);
  const warningTimer = useRef(null);
  const isWarningShown = useRef(false);

  const clearTimers = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    isWarningShown.current = false;

    warningTimer.current = setTimeout(() => {
      isWarningShown.current = true;
      onWarning?.();
    }, timeoutMs - warningMs);

    logoutTimer.current = setTimeout(() => {
      onLogout?.();
    }, timeoutMs);
  }, [clearTimers, timeoutMs, warningMs, onWarning, onLogout]);

  useEffect(() => {
    resetTimers();

    const handleActivity = () => {
      // Only reset if no warning is being shown
      if (!isWarningShown.current) {
        resetTimers();
      }
    };

    IDLE_EVENTS.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true }),
    );

    return () => {
      clearTimers();
      IDLE_EVENTS.forEach((event) =>
        window.removeEventListener(event, handleActivity),
      );
    };
  }, [resetTimers, clearTimers]);

  // Returns a function to reset the timer (e.g. when user clicks "Stay logged in")
  return { resetTimers };
}
