import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import FujiTestnetBanner from "@/components/FujiTestnetBanner";
import Icon from "@/components/Icon";
import { CURRENCY_SYMBOL, NETWORK_NAME, CHAIN_ID, RPC_URL } from "@/config/env";
export default function GuidePage() {
  return (
    <div className="app-shell">
      <FujiTestnetBanner />
      <AppHeader active="guide" />
      <main className="site-container play-page">
        <section className="page-intro">
          <div>
            <p className="eyebrow">BẮT ĐẦU TRONG VÀI BƯỚC</p>
            <h1>
              Vào phòng. <span>Tới lượt bạn.</span>
            </h1>
            <p className="intro-description">
              Phân biệt bước nối ví, giao dịch tiền cược và ký vào trận.
            </p>
          </div>
        </section>
        <div className="guide-layout">
          <section className="surface-card">
            <ol className="guide-steps">
              <li>
                <span>01</span>
                <div>
                  <h2>Nối ví đúng mạng</h2>
                  <p>
                    Dùng MetaMask hoặc Core trên {NETWORK_NAME}. Nối ví không
                    mất phí. Bạn cần {CURRENCY_SYMBOL} thử nghiệm để nạp tiền
                    cược và trả phí mạng.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h2>Tạo hoặc tham gia phòng</h2>
                  <p>
                    Người tạo chọn màu và mức cược, sau đó chia sẻ mã phòng.
                    Người thứ hai xem màu, số tiền rồi xác nhận giao dịch tham
                    gia. Mỗi người dùng một địa chỉ riêng.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h2>Ký vào trận</h2>
                  <p>
                    Khi cả hai đã tham gia, mở cùng phòng và ký yêu cầu vào trận
                    trong ví. Đây là chữ ký xác thực, không mất phí mạng. Mỗi
                    địa chỉ chỉ giữ một tab trận đấu.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h2>Chơi, xác nhận kết quả và rút tiền</h2>
                  <p>
                    Nước đi không cần giao dịch. Sau trận, ký và gửi kết quả;
                    khi giao dịch được xác nhận, rút số dư khả dụng về ví. Thắng
                    nhận 95% tổng cược; hòa hoàn đủ tiền cược mỗi bên. Phí mạng
                    tính riêng.
                  </p>
                </div>
              </li>
            </ol>
            <Link href="/" className="button-primary mt-6">
              Tới phòng chờ
              <Icon name="arrow" />
            </Link>
          </section>
          <aside className="space-y-4">
            <details className="surface-card">
              <summary className="section-title !text-base">
                Thêm mạng vào ví
              </summary>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-400">Tên mạng</dt>
                  <dd className="mt-1">{NETWORK_NAME}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">RPC</dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {RPC_URL}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400">Chain ID · Ký hiệu tiền</dt>
                  <dd className="mt-1">
                    {CHAIN_ID} · {CURRENCY_SYMBOL}
                  </dd>
                </div>
              </dl>
              <p className="helper-text mt-4">
                Trong ví, chọn thêm mạng tùy chỉnh rồi nhập các thông số trên.
              </p>
            </details>
            <section className="surface-card">
              <h2 className="section-title">Chỉ muốn chơi cờ?</h2>
              <p className="helper-text my-3">
                Hai người cùng thiết bị có thể chơi ngay, không cần ví hay tiền
                cược.
              </p>
              <Link href="/hotseat" className="button-secondary w-full">
                Chơi cùng thiết bị
                <Icon name="board" />
              </Link>
            </section>
            <section className="surface-card" id="vault">
              <h2 className="section-title">Vault & thưởng mùa</h2>
              <p className="helper-text mt-3">
                Vault giữ tiền gốc và chưa tạo lợi suất. Thưởng theo danh sách
                từng mùa được cấp quỹ, không tự động phát sinh từ điểm hoặc
                khoản gửi.
              </p>
            </section>
          </aside>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
