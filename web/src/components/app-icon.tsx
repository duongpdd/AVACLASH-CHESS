import type { SVGProps } from "react";

const paths = {
  crown: "M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7ZM6 22h12",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8-7.87a4 4 0 0 1 0 7.75",
  wallet:
    "M20 8V5H4a2 2 0 0 1 0-4h14v4M4 5H2v15a2 2 0 0 0 2 2h16V8H4Zm16 4h-5v6h5m-3-3h.01",
  check: "m5 12 4 4L19 6",
  refresh:
    "M20 7v5h-5M4 17v-5h5m-4.5-3a8 8 0 0 1 13-5L20 7M4 17l2.5 3A8 8 0 0 0 19.5 15",
  search: "m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 10 3 3 5-6",
  plus: "M12 5v14M5 12h14",
  copy: "M8 8h13v13H8V8Zm8-4V1H1v15h3",
  board: "M3 3h18v18H3V3Zm6 0v18m6-18v18M3 9h18M3 15h18",
  info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
} as const;
export default function Icon({
  name,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 ${className}`}
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
