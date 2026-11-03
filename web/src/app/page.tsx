import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import Icon from "@/components/Icon";
import RoomLobbyWidget from "@/components/RoomLobbyWidget";
import FujiTestnetBanner from "@/components/FujiTestnetBanner";
import ConfigErrorBanner from "@/components/ConfigErrorBanner";
import { redirect } from "next/navigation";
import { tournamentEnabled } from "@/config/env";

export default function HomePage() {
  if (tournamentEnabled) redirect("/tournaments");
  return (
    <div className="app-shell">
      <FujiTestnetBanner />
      <AppHeader />
      <ConfigErrorBanner />
      <main className="site-container play-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">BẠN ĐÃ SẴN SÀNG CHƯA?</p>
            <h1>
              Một bàn cờ. <span>Hai kỳ thủ.</span>
            </h1>
            <p className="intro-description">
              Cờ nhanh 5+0 cùng bạn bè. Tạo phòng hoặc nhập mã để bắt đầu.
            </p>
          </div>
          <div className="intro-meta">
            <span>
              <Icon name="clock" />5 phút mỗi bên
            </span>
            <span>
              <Icon name="shield" />
              Luật cờ tiêu chuẩn
            </span>
          </div>
        </section>
        <div className="mode-switch" aria-label="Chế độ chơi">
          <span className="mode-active">
            <Icon name="users" />
            Chơi đối kháng
          </span>
          <Link href="/hotseat">
            <Icon name="board" />
            Cùng thiết bị
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        </div>
        <RoomLobbyWidget />
        <section className="play-notes" aria-label="Thông tin trước khi chơi">
          <div>
            <Icon name="shield" />
            <p>
              <strong>Tiền cược được ký quỹ</strong>
              <span>
                Thắng nhận 95% tổng cược; hòa hoàn đủ tiền cược mỗi bên. Phí
                mạng tính riêng.
              </span>
            </p>
          </div>
          <div>
            <Icon name="info" />
            <p>
              <strong>Mỗi địa chỉ, một chỗ ngồi</strong>
              <span>
                Thử với bạn bè bằng hai ví và hai profile trình duyệt khác nhau.
              </span>
            </p>
          </div>
          <Link href="/guide">
            Xem hướng dẫn
            <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
