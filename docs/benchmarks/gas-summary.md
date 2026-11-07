# Gas đo trên local

Nguồn: receipt của 20 trận trong local-campaign.json; chỉ Anvil, không phải chi phí AVAX trên Fuji.

| Thao tác | Mẫu | Min gas | Median gas | Max gas |
| --- | ---: | ---: | ---: | ---: |
| create | 20 | 79603 | 89559 | 116615 |
| join | 20 | 199826 | 199838 | 199838 |
| settle | 20 | 105510 | 105558 | 122611 |
| withdraw | 27 | 32646 | 32646 | 32646 |

Bảng gas theo function, gồm challenge và reward, nằm ở [contracts-gas.txt](contracts-gas.txt). Không so sánh trực tiếp gas trong fuzz/test với toàn bộ phí giao dịch trên Fuji.
