# Cloudflare R2 + PMTiles · Vĩnh Long

## Trạng thái hiện tại

- Account: `9e48dfe45ae2d641363f0503fda3a32f`
- Bucket: `vinhlong`
- Object key: `VinhLong.pmtiles`
- Public development URL: `https://pub-455588dd8bc84c5bab992d0db75a3a93.r2.dev/VinhLong.pmtiles`
- Data Catalog URI: `https://catalog.cloudflarestorage.com/9e48dfe45ae2d641363f0503fda3a32f/vinhlong`
- WebGIS origin: `https://base27-cvnss.github.io`

R2 Data Catalog và PMTiles delivery là hai lớp khác nhau. Catalog URI dành cho Apache Iceberg metadata/analytics; MapLibre + PMTiles phải đọc public object URL.

## CORS đang dùng

```json
[
  {
    "AllowedOrigins": ["https://base27-cvnss.github.io"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Accept-Ranges", "Content-Range", "Content-Length", "ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

## Kiểm tra HTTP Range

```bash
curl -sS -D headers.txt -o header.bin \
  -H "Origin: https://base27-cvnss.github.io" \
  -H "Range: bytes=0-126" \
  "https://pub-455588dd8bc84c5bab992d0db75a3a93.r2.dev/VinhLong.pmtiles"
```

Kỳ vọng: HTTP 206, body 127 byte, magic `PMTiles`, spec v3, `Content-Range` tổng size `94357111`, và CORS đúng origin.

## Runtime

Production URL được khai báo ở hai nơi có chủ đích:

1. `data/pmtiles-source.json -> delivery.publicUrl`: canonical;
2. `src/config.js -> productionUrl`: emergency fallback.

Ứng dụng ưu tiên:

```text
?pmtiles= → manifest delivery.publicUrl → config productionUrl → local
```

Runtime preflight bằng HTTP Range trước khi tạo vector source.

## CI

`.github/workflows/verify-r2-production.yml` kiểm tra public delivery mà không tải toàn bộ archive.

## Custom Domain

`r2.dev` đang hoạt động cho QA/triển khai hiện tại. Khi có domain riêng, gắn Custom Domain trực tiếp vào bucket `vinhlong`, QA bằng `?pmtiles=`, rồi thay `delivery.publicUrl` + `productionUrl`. UI và logic MapLibre không cần đổi.
