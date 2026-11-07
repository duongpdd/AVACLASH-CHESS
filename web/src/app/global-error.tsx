"use client";

import { useEffect } from "react";
import "./globals.css";

// Replaces the root layout, so the translation provider is unavailable here.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="vi" className="dark">
      <body className="font-sans antialiased">
        <title>AvaClash Chess</title>
        <main className="site-container play-page grid gap-4">
          <h1 className="text-2xl font-semibold">Đã có lỗi xảy ra</h1>
          <p lang="en" className="helper-text">
            Something went wrong
          </p>
          <button
            type="button"
            className="button-primary w-fit"
            onClick={() => retry()}
          >
            Thử lại / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
