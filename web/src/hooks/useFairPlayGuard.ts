import { useEffect, useRef } from "react";

/**
 * Anti-Cheat Focus & Visibility Guard Hook.
 * Monitors window blur and document visibility changes.
 * When the player is away for more than 2 seconds (>2000ms) during an active game,
 * triggers onViolation with current warning count and duration.
 */
export function useFairPlayGuard(
  isGameActive: boolean,
  onViolation: (warningCount: number, durationMs: number) => void
) {
  const warningsRef = useRef(0);
  const blurTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isGameActive) {
      blurTimestampRef.current = null;
      return;
    }

    const checkAwayAndReport = () => {
      if (blurTimestampRef.current !== null) {
        const awayMs = Date.now() - blurTimestampRef.current;
        blurTimestampRef.current = null;

        // Nếu rời cửa sổ quá 2 giây khi đang đánh cờ
        if (awayMs > 2000) {
          warningsRef.current += 1;
          onViolation(warningsRef.current, awayMs);
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
  }, [isGameActive, onViolation]);
}
