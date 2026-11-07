import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "#0b1019",
        color: "#e7b56c",
        fontSize: 114,
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
    </div>,
    size,
  );
}
