import { useEffect, useRef } from "react";

/**
 * Anti-Cheat Focus & Visibility Guard Hook.
 * Monitors window blur and document visibility changes.
 * When the player is away for more than 2 seconds (>2000ms) during an active game,
 * triggers onViolation with current warning count and duration.
 */
export function useFairPlayGuard(
  isGameActive: boolean,
  onViolation: (warningCount: number, durationMs: number) => void,
) {
  const warningsRef = useRef(0);
  const blurTimestampRef = useRef<number | null>(null);
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    if (!isGameActive) {
      blurTimestampRef.current = null;
      return;
    }
    if (document.hidden) blurTimestampRef.current = Date.now();

    const checkAwayAndReport = () => {
      if (blurTimestampRef.current !== null) {
        const awayMs = Date.now() - blurTimestampRef.current;
        blurTimestampRef.current = null;

        // Telemetry is advisory; the relay never applies a clock penalty.
        if (awayMs > 2000) {
          warningsRef.current += 1;
          onViolationRef.current(warningsRef.current, awayMs);
        }
      }
    };

    const handleBlur = () => {
      if (blurTimestampRef.current === null) {
        blurTimestampRef.current = Date.now();
      }
    };

    const handleFocus = () => {
      checkAwayAndReport();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (blurTimestampRef.current === null) {
          blurTimestampRef.current = Date.now();
        }
      } else {
        checkAwayAndReport();
      }
    };

    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isGameActive]);
}
