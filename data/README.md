# Data

## Lớp nền hành chính

```text
data/vinhlong-admin-2026.geojson
```

Đây là lớp địa giới Vĩnh Long 2026 dùng làm baseline độc lập với dữ liệu quy hoạch.

## PMTiles canonical contract

Runtime mặc định tìm:

```text
data/VinhLong.pmtiles
```

Nếu file không được commit trong repo, có thể truyền URL production:

```text
?pmtiles=https://cdn.example.vn/quyhoach/vinhlong/v1/VinhLong.pmtiles
```

Thông số archive chuẩn:

```text
size     94357111 bytes
sha256   dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf
spec     PMTiles v3
format   MVT/PBF + gzip
zoom     7..15
layers   117
nonempty 95
features 165017
tiles    7485
```

Kiểm tra archive local:

```bash
python tools/verify_pmtiles.py data/VinhLong.pmtiles
```

Production khuyến nghị R2/CDN với HTTP byte-range và object versioned. GitHub Pages phù hợp demo/QA; không nên biến repo Git thành kho master GIS.
