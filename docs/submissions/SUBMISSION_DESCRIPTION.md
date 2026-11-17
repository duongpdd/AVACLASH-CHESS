# Mô tả nộp bài AvaClash Cup

Dán vào biểu mẫu của từng cổng. Điền các ô `[...]` trước khi gửi. Mỗi bản có một câu ngắn để dùng khi biểu mẫu giới hạn độ dài.

## Câu một dòng (tagline)

> Giải cờ miễn phí tham dự, quỹ thưởng khóa trong hợp đồng trên Avalanche, kỳ thủ tự nhận thưởng không qua tay ban tổ chức.

English: *Free-entry chess tournaments with sponsor-funded prize pools locked in an Avalanche contract; winners claim directly.*

## Bản tiếng Việt (BK Fintech Hackday S15)

**Vấn đề.** Ở các giải cờ của CLB, trường học và cộng đồng, người tổ chức phải tự đối soát bảng điểm, xử lý khiếu nại và chuyển khoản thưởng bằng tay. Nhà tài trợ khó kiểm tra tiền đã đến đúng người, kỳ thủ không biết khi nào được nhận thưởng.

**Giải pháp.** AvaClash Cup tách quyền và đưa phần tiền lên chuỗi:
- Nhà tài trợ nạp quỹ trước vào hợp đồng `TournamentPrizePool` trên Avalanche Fuji.
- Kỳ thủ tham dự miễn phí, không đặt cược. Nước đi và đồng hồ chạy ngoài chuỗi qua relay.
- Relay ký biên bản ván theo chuẩn EIP-712. Trọng tài độc lập duyệt kết quả và xử lý khiếu nại.
- Hết thời gian khiếu nại, hợp đồng tự chia thưởng theo điểm đã duyệt (70/30 hoặc 60/30/10). Kỳ thủ tự nhận trong 30 ngày, phần không ai nhận hoàn lại nhà tài trợ theo tỷ lệ góp quỹ.

**Kết quả đã đạt.** Giải #4 chạy thật trên Fuji ngày 15–16/11/2026: nạp 1 AVAX → 2 kỳ thủ → trọng tài duyệt → hợp đồng chia 70/30 → kỳ thủ thắng tự nhận 0,7 AVAX. Mỗi giao dịch tốn dưới 0,0001 AVAX phí. Hợp đồng đã xác minh mã nguồn, 189/189 test hợp đồng và 241/241 test web đạt.

**Mô hình kinh doanh.** Thu phí phần mềm theo từng giải từ đơn vị tổ chức. Quỹ thưởng không tính là doanh thu. Mức phí sẽ thử với CLB pilot trong 90 ngày.

**Giới hạn.** Chỉ chạy testnet, hợp đồng chưa audit độc lập. Relay và trọng tài là bên được tin cậy; hệ thống chưa phát hiện việc dùng engine.

**Liên kết.** Demo: https://avaclash-chess.vercel.app · Giải #4: https://avaclash-chess.vercel.app/tournaments?id=4 · Mã nguồn: https://github.com/duongpdd/AVACLASH-CHESS · Slide: [link Canva chỉ xem] · Video: [link video]

## English version (Team1 UniHack)

**Problem.** Small chess clubs and school tournaments settle prizes by hand: the organizer reconciles scores, handles disputes and wires money manually. Sponsors cannot verify where funds went; players do not know when they will be paid.

**Solution.** AvaClash Cup puts only the money flow on-chain:
- Sponsors lock the prize pool in the `TournamentPrizePool` contract on Avalanche Fuji C-Chain before registration opens.
- Players join for free with no wagering. Moves and clocks run off-chain through a relay.
- The relay signs each game result with EIP-712; an independent referee approves results and resolves appeals on-chain.
- After the appeal window, the contract splits the pool by approved points (70/30 or 60/30/10). Winners claim within 30 days; unclaimed funds are refunded to sponsors pro rata.

**Avalanche integration.** Solidity 0.8.24 with OpenZeppelin (EIP712, ECDSA, ReentrancyGuard) on Fuji C-Chain (43113). Contract `0x268F6034175750791AAaA20FD04F658BDDAcB9F9`, source verified on Sourcify. Wallet sign-in, funding, registration, result reporting, review, finalization and claims are all real Fuji transactions; fees were below 0.0001 AVAX each.

**Proof.** Tournament #4 ran end to end on Fuji on 15–16 Nov 2026: 1 AVAX funded → 2 players → referee approval → 70/30 split → winner claimed 0.7 AVAX. The README lists all nine transactions. Tests: 189/189 contract tests (Foundry) and 241/241 web tests pass.

**Built during the hackathon.** Prize-pool contract, referee and appeal flow, tournament UI, Elo table and puzzles. Reused from before: the board, relay and wallet layer of our earlier 1v1 prototype.

**Limitations.** Testnet only, no independent audit yet. The relay and referee are trusted parties; engine use is not detected automatically.

**Links.** Demo: https://avaclash-chess.vercel.app · Tournament #4: https://avaclash-chess.vercel.app/tournaments?id=4 · Repo: https://github.com/duongpdd/AVACLASH-CHESS · Slides: [Canva view link] · Video: [video link]
