"use client";
import { useEffect, useRef, useState } from "react";

/** Opt-in measurement reads Phaser's own loop; it does not send telemetry. */
export default function BoardPerformance({
  getFps,
}: {
  getFps: () => number | undefined;
}) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState("");
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );
  function measure() {
    if (timer.current) return;
    if (getFps() === undefined) {
      setReport("Bàn cờ chưa tải xong.");
      return;
    }
    setRunning(true);
    setReport("");
    const started = performance.now(),
      samples: number[] = [];
    let hidden = document.hidden;
    timer.current = setInterval(() => {
      hidden ||= document.hidden;
      const fps = getFps();
      if (fps !== undefined && Number.isFinite(fps) && fps > 0)
        samples.push(fps);
      if (performance.now() - started < 5000) return;
      clearInterval(timer.current!);
      timer.current = null;
      setRunning(false);
      const sorted = [...samples].sort((a, b) => a - b);
      setReport(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            metric: "Phaser loop.actualFps sampled every 100ms",
            durationMs: performance.now() - started,
            samples: samples.length,
            meanFps: samples.length
              ? samples.reduce((sum, v) => sum + v, 0) / samples.length
              : null,
            p5SampleFps:
              sorted[Math.max(0, Math.ceil(sorted.length * 0.05) - 1)] ?? null,
            hiddenDuringMeasurement: hidden,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
              devicePixelRatio: window.devicePixelRatio,
            },
            reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches,
            userAgent: navigator.userAgent,
          },
          null,
          2,
        ),
      );
    }, 100);
  }
  return (
    <details className="max-w-xl w-full text-xs text-slate-400">
      <summary>Hiệu năng hiển thị</summary>
      <p className="my-2">
        Giữ trang ở phía trước khi đo. Kết quả chỉ phản ánh thiết bị và trình
        duyệt hiện tại.
      </p>
      <button
        disabled={running}
        onClick={measure}
        className="rounded bg-slate-800 px-3 py-2"
      >
        {running ? "Đang đo..." : "Đo FPS 5 giây"}
      </button>
      {report && (
        <pre
          data-testid="board-performance-report"
          className="mt-2 whitespace-pre-wrap break-words"
        >
          {report}
        </pre>
      )}
    </details>
  );
}
