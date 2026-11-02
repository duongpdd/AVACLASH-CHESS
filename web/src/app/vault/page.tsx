import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import FujiTestnetBanner from "@/components/FujiTestnetBanner";
import ConfigErrorBanner from "@/components/ConfigErrorBanner";
import VaultWidget from "@/components/VaultWidget";
import Icon from "@/components/Icon";
import Link from "next/link";
import { CURRENCY_SYMBOL } from "@/config/env";
export default function VaultPage() {
  return (
    <div className="app-shell">
      <FujiTestnetBanner />
      <AppHeader active="vault" />
      <ConfigErrorBanner />
      <main className="site-container play-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">VỐN & PHẦN THƯỞNG</p>
            <h1>
              Vault <span>tiền gốc.</span>
            </h1>
            <p className="intro-description">
              Quản lý khoản gửi của bạn và kiểm tra phần thưởng theo từng mùa.
            </p>
          </div>
        </section>
        <div className="vault-layout">
          <div className="surface-card">
            <VaultWidget />
          </div>
          <aside className="vault-explainer">
            <span className="icon-tile">
              <Icon name="shield" />
            </span>
            <h2>Hiểu rõ trước khi gửi</h2>
            <p>
              Gửi từ 0.5 {CURRENCY_SYMBOL} mỗi lần. Bạn có thể rút toàn bộ tiền
              gốc về ví qua giao dịch trên mạng.
            </p>
            <ul>
              <li>Vault hiện chưa tạo lợi suất.</li>
              <li>Điểm mùa không tự đổi thành tiền.</li>
              <li>Chỉ có thưởng khi mùa được cấp quỹ và công bố danh sách.</li>
              <li>Phí mạng do ví hiển thị trước khi xác nhận.</li>
            </ul>
            <Link href="/guide#vault" className="text-link">
              Tìm hiểu về Vault
              <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
