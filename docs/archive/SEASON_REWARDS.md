# Chi thưởng mùa trên testnet

Q12 được triển khai thành phân phối Merkle có danh sách công khai. Owner được tin cậy để xác định người nhận và số tiền; điểm ELO/season chưa chống Sybil, nên không tự quy đổi điểm sang tiền. Đây không phải yield và không phải lịch thưởng được bảo đảm.

Nguồn quỹ: `seasonPrizePool` từ phí spectator đã giải quyết hợp lệ hoặc `fundSeasonRewards()` của nhà tài trợ. Tiền gốc Vault và tiền cược khán giả chưa trả nằm ngoài ngân sách này. Spectator mặc định tắt; có thể thử rewards với quỹ tài trợ mà không bật cược.

Owner gọi `scheduleSeasonRewards(root, allocationHash, total)`: ngân sách trừ ngay khỏi pool khả dụng và chuyển thành `reservedSeasonRewards`, root/hash không sửa được, chờ **2 ngày**, nhận trong **90 ngày**. Một ví nhận một lần mỗi mùa bằng proof của chính ví; leaf bind chain, Meta, season, địa chỉ, số tiền. Khi hết hạn, bất kỳ ai gọi `closeRewardSeason` đưa phần dư về pool, không trả cho owner. Kiểm tra chuyển tiền thất bại sẽ revert toàn bộ cập nhật claim; có nonReentrant.

Tạo input sau khi công bố và duyệt chính sách phân bổ, ví dụ:

```json
{
  "chainId": 31337,
  "metaAddress": "0x1111111111111111111111111111111111111111",
  "seasonId": "0",
  "allocations": [
    {
      "address": "0x2222222222222222222222222222222222222222",
      "amountWei": "1000000000000000"
    }
  ]
}
```

```powershell
node scripts/season-rewards.mjs allocation.json claims.json
```

Script không ký hoặc gửi giao dịch; từ chối chain ngoài Anvil/Fuji, ví trùng/zero, số tiền không hợp lệ và ghi đè tệp đích. `totalWei` là tổng chính xác của các allocation. `allocationHash` băm JSON chuẩn hóa do script tạo (metadata và danh sách address/amountWei, giữ thứ tự); root dùng leaf double-hash và các cặp node sắp xếp. Công bố tệp claims trước khi schedule và giữ lâu dài. Kiểm tra `nextRewardSeason`, chain, Meta, tổng ngân sách trước khi schedule; chạy lại generator nếu ID mùa thay đổi. Root được publish không bảo đảm chính sách chia thưởng công bằng: đó vẫn là trách nhiệm quản trị.

Người chơi vào tab **Vault tiền gốc**, tải claims.json để xem phần thưởng rồi tự ký nhận. Web xác minh proof, mạng, hợp đồng, beneficiary và đối chiếu root/hash trên chain; hợp đồng quyết định hạn nhận và ngân sách còn lại. Chưa có mùa được cấp quỹ/công bố trong phiên local hiện tại; không tạo số tiền thưởng mẫu trên giao diện.

Cấu trúc leaf và kiểm proof dựa trên [OpenZeppelin MerkleProof](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography). Chưa audit độc lập cơ chế mới; không triển khai với tiền thật.
