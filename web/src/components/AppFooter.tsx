import Link from "next/link";
export default function AppFooter() {
  return (
    <footer className="site-container app-footer">
      <span>
        AvaClash Chess <span className="text-slate-600">/</span> Chơi cờ, kết
        nối bạn bè.
      </span>
      <div className="flex items-center gap-5">
        <span>5 phút · Không cộng giờ</span>
        <Link href="/guide" className="hover:text-slate-200">
          Cách chơi
        </Link>
      </div>
    </footer>
  );
}
