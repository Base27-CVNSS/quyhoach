# Data

WebGIS mặc định tìm archive tại:

```text
data/VinhLong.pmtiles
```

Thông số file chuẩn hiện tại:

```text
size    94357111 bytes
sha256  dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf
spec    PMTiles v3
format  MVT/PBF + gzip
zoom    7..15
layers  117
feature 165017
```

Kiểm tra:

```bash
python tools/verify_pmtiles.py data/VinhLong.pmtiles
```

Production có thể không cần lưu archive trong repo; truyền URL R2/CDN qua tham số `?pmtiles=` hoặc đổi `DATASET.url` trong `src/config.js`.
