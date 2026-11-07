# Vận hành relay và local

Phương án hosting hiện tại là [Render Free + Neon Free + Vercel](RENDER_DEPLOY.md). Các lệnh sao lưu JSON dưới đây dành cho local/VPS dùng file; không sao lưu PostgreSQL bằng `relay-storage.mjs`. Render lấy snapshot/kết quả từ Neon, không từ disk tạm. Với migration mới, tạo nhánh kiểm thử, áp dụng và xác minh trước production; giữ credentials trong secret manager.

## Khởi động và dữ liệu

`pnpm dev:local` tạo Anvil riêng ở 127.0.0.1:8545 và deploy khi chưa có state. Anvil lưu `.local/anvil-state.json` mỗi 5 giây. Chạy lại sẽ tải state và kiểm tra signer khớp cấu hình, không tự redeploy khi state/config không khớp. Mất state không thể phục hồi các phòng cũ chỉ từ snapshot relay. Sau khi thay bytecode, môi trường đã có state cần kế hoạch triển khai/migration riêng, không tự nâng cấp hợp đồng cũ.

Mỗi chain local mới có thư mục `RESULTS_DIR` riêng trong `.local/relay/<session>/results` để không nạp nhầm kết quả của chain cũ có cùng địa chỉ hợp đồng. Sao lưu đồng bộ state, env tương ứng và relay data; env/khóa nằm trong kho bí mật riêng. Dừng tiến trình có trật tự; relay lưu snapshot các phòng chưa kết thúc trước shutdown. Khoảng giữa hai lần dump vẫn là cửa sổ có thể mất dữ liệu local khi máy tắt đột ngột.

Relay mặc định bind `127.0.0.1`; dùng reverse proxy TLS cho WSS trên máy chủ. Chỉ đặt `TRUST_PROXY=true` khi proxy ghi đè header và chặn truy cập trực tiếp. Giữ danh sách `ALLOWED_ORIGINS` chính xác, không cho origin rỗng ở môi trường người dùng. `HOST=0.0.0.0` chỉ khi hạ tầng triển khai cần và đã có rào chắn mạng phù hợp.

## Giám sát

- `GET /healthz`: tiến trình HTTP còn phản hồi.
- `GET /readyz`: 200 khi RPC đúng chain, Escrow có bytecode, signer đúng, số dư gas đạt `RELAY_MIN_BALANCE`, thư mục kết quả/active có thể ghi và atomic rename. 503 khi thiếu một phụ thuộc; phản hồi không lộ khóa/RPC credential.
- Startup từ chối cấu hình sai hoặc thiếu gas; không tiếp tục nghe khi readiness thất bại.
- Theo dõi readiness, dung lượng đĩa, lỗi ghi snapshot/result, retry RPC, signalGameStarted receipt và gas relay. Cảnh báo chỉ khi có sự cố; chưa cấu hình dịch vụ cảnh báo bên ngoài thay người vận hành.

## Sao lưu và phục hồi

Dừng relay trước khi sao lưu để có bộ tệp nhất quán; copy state Anvil riêng nếu dùng local. Công cụ chỉ sao lưu các tệp JSON, không lấy env/private key, không theo symlink và không ghi đè đích đã tồn tại.

```powershell
node scripts/relay-storage.mjs backup PATH_TO_RESULTS .local/backups/relay-2026-11-01
node scripts/relay-storage.mjs restore .local/backups/relay-2026-11-01 .local/restored-results
```

Manifest SHA-256 được kiểm tra trước khi restore. Restore vào thư mục mới rồi cấu hình `RESULTS_DIR`; giữ nguyên `active` bên dưới trừ khi cấu hình `ACTIVE_DIR` riêng. Nếu `ACTIVE_DIR` nằm ngoài results, sao lưu/phục hồi nó riêng. Không ghi đè kết quả terminal bằng active cũ. Manifest phát hiện thay đổi ngoài ý muốn, không thay thế chữ ký xác thực hoặc bản sao bất biến ngoài máy. Mất toàn bộ ổ vẫn cần off-host backup do bên vận hành thiết lập.

## Nâng cấp hợp đồng/Meta

Không tự chuyển Meta khi còn principal, pool, season reward hoặc pending withdrawal chưa xử lý. Lập inventory từng chain/địa chỉ, đóng nhận cược mới, cho rút/claim/refund các nghĩa vụ, lưu event và đối chiếu số dư. Contract Meta gắn Escrow một lần, không thể tùy ý đổi. Deploy phiên bản mới và công bố địa chỉ mới; timelock đổi Meta của Escrow không tự di chuyển tiền hoặc ELO. Chỉ cân nhắc migration khi đã có đặc tả và kiểm chứng riêng.
