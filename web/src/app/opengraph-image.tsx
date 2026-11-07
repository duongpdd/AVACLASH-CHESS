import { ImageResponse } from "next/og";
import { siteName } from "@/lib/metadata";

export const alt = siteName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#0b1019",
        color: "#e7b56c",
      }}
    >
      <svg
        width={116}
        height={116}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#e7b56c"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7ZM6 22h12" />
      </svg>
      <span style={{ fontSize: 76, fontWeight: 700 }}>{siteName}</span>
      <span style={{ fontSize: 32, color: "#e8edf5" }}>
        AvaClash Cup · Play · Practice
      </span>
    </div>,
    size,
  );
}
