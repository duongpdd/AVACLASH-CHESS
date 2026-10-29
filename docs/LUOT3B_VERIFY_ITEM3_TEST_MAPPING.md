# Bảng Đối Chiếu Test Lượt 3a -> Vị Trí Hiện Tại

Lệnh trích xuất tên test lượt 3a:
`git show 2441952:contracts/test/ChessEscrowMetaTryCatch.t.sol | findstr /C:"function test"`

---

## Bảng Đối Chiếu Tên Test Thật (Lượt 3a) -> Vị Trí Hiện Tại

| STT | Tên test gốc (commit `2441952`) | Tên test hiện tại | Vị trí hiện tại (file:dòng) | Tình trạng & Ghi chú |
|---|---|---|---|---|
| 1 | `test_JoinRoom_RevertsWhenMetaRegisterMatchFails` | `test_JoinRoom_RevertsWhenMetaRegisterMatchFails` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:105` | Giữ nguyên. Kiểm tra `joinRoom` revert fail-closed khi `registerMatch` của Meta lỗi. |
| 2 | `test_JoinRoom_RevertsWhenMetaLockBettingFails` | `test_SignalGameStarted_EmitsMetaCallFailedWhenMetaLockBettingFails` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:116` | Cập nhật theo DECISIONS Q14: `lockBetting` chuyển từ `joinRoom` sang `signalGameStarted`. Khi `lockBetting` fail, escrow emit `MetaCallFailed` và tiếp tục hoạt động. |
| 3 | `test_AbortRoom_SuccessWhenMetaReverts` | `test_AbortRoom_SuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:135` | Giữ nguyên. Kiểm tra `abortRoom` thành công và hoàn tiền người chơi khi `cancelPrediction` của Meta lỗi. |
| 4 | `test_RefundOnTimeout_SuccessWhenMetaReverts` | `test_RefundOnTimeout_SuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:159` | Giữ nguyên. Kiểm tra `refundOnTimeout` thành công khi `cancelPrediction` của Meta lỗi. |
| 5 | `test_SubmitResult_SettleSuccessWhenMetaReverts` | `test_SubmitResult_SettleSuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:178` | Giữ nguyên. Kiểm tra trả thưởng người thắng thành công và ghi nhận cờ fallback khi `updateEloOnSettle` / `resolvePrediction` lỗi. |
| 6 | `test_SubmitResult_DrawSuccessWhenMetaReverts` | `test_SubmitResult_DrawSuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:215` | Giữ nguyên. Kiểm tra hòa trả tiền người chơi thành công khi Meta lỗi, ghi nhận option 3. |
| 7 | `test_RetryResolvePrediction_SuccessAndFailure` | `test_RetryResolvePrediction_SuccessAndFailure` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:241` | Giữ nguyên. Kiểm tra gọi lại giải quyết dự đoán khi Meta phục hồi. |
| 8 | `test_FallbackCancelPrediction_ConservesAllFundsAndSpectatorsRefunded` | `test_FallbackCancelPrediction_ConservesAllFundsAndSpectatorsRefunded` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:310` | Giữ nguyên. Kiểm tra hủy dự đoán cứu hộ hoàn tiền 100% cho khán giả và bảo toàn số dư. |

---

## Các Test Bổ Sung Mở Rộng Ở Lượt 3b (Commit `ec93898`)

Ngoài 8 test trên, bộ test `ChessEscrowMetaTryCatch.t.sol` đã được bổ sung thêm 5 test bảo đảm bao phủ toàn bộ các luồng Meta try-catch:

| STT | Tên test bổ sung | Vị trí hiện tại (file:dòng) | Mục đích kiểm thử |
|---|---|---|---|
| 9 | `test_FallbackCancelPrediction_Timelock` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:281` | Kiểm tra thời gian chờ tối thiểu 1 ngày trước khi được phép gọi `fallbackCancelPrediction`. |
| 10 | `test_FinalizeSingleSigned_SuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:388` | Kiểm tra `finalizeSingleSigned` thành công trả thưởng khi Meta revert. |
| 11 | `test_ResolveDefaultChallenge_SuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:431` | Kiểm tra trọng tài vắng mặt (`resolveDefaultChallenge`) thành công khi Meta revert. |
| 12 | `test_ResolveChallenge_SuccessWhenMetaReverts` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:478` | Kiểm tra trọng tài phán quyết (`resolveChallenge`) thành công khi Meta revert. |
| 13 | `test_ClaimSpectatorRefund_After7DaysOfJoinedAt` | `contracts/test/ChessEscrowMetaTryCatch.t.sol:524` | Khán giả rút hoàn tiền độc lập sau 7 ngày kể từ `joinedAt` mà không phụ thuộc escrow. |

