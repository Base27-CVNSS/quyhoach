# Vĩnh Long · Cổng WebGIS Quy hoạch

WebGIS quy hoạch Vĩnh Long dùng **MapLibre GL JS + PMTiles v3 + Cloudflare R2**. Lớp nền hành chính được giữ độc lập để bản đồ vẫn hoạt động khi archive quy hoạch gặp sự cố.

## Production

- WebGIS: https://base27-cvnss.github.io/quyhoach/
- Repository: https://github.com/Base27-CVNSS/quyhoach
- R2 bucket: `vinhlong`
- Object: `VinhLong.pmtiles`
- Public PMTiles: `https://pub-455588dd8bc84c5bab992d0db75a3a93.r2.dev/VinhLong.pmtiles`
- R2 Data Catalog: `https://catalog.cloudflarestorage.com/9e48dfe45ae2d641363f0503fda3a32f/vinhlong`

> Data Catalog là endpoint Apache Iceberg metadata/analytics; MapLibre không đọc PMTiles từ Catalog URI. Runtime dùng public object URL của R2.

## Kiến trúc

```text
Master GIS
   │
   ├── data/vinhlong-admin-2026.geojson
   │       └── địa giới hành chính
   │
   └── VinhLong.pmtiles
           │
           ▼
    Cloudflare R2
    bucket: vinhlong
           │
           │ HTTP Range / CORS
           ▼
      PMTiles protocol
           │
           ▼
     MapLibre GL JS
           │
           ▼
 GitHub Pages WebGIS
```

## PMTiles contract

- PMTiles v3
- MVT/PBF + gzip
- 117 vector layers
- 95 lớp có dữ liệu
- 165.017 feature
- 7.485 vector tiles
- zoom z7–z15
- bounds `[105.5898088, 9.3994054, 106.8586394, 10.4697316]`
- size `94,357,111` bytes
- SHA-256 `dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf`

Metadata `vector_layers` trong PMTiles là source of truth cho danh mục lớp.

## Thứ tự chọn nguồn

```text
1. ?pmtiles=https://...             QA override
2. data/pmtiles-source.json
   └── delivery.publicUrl           production canonical
3. src/config.js
   └── productionUrl                emergency fallback
4. data/VinhLong.pmtiles            local fallback
```

Mỗi nguồn được preflight bằng byte-range trước khi đăng ký vào MapLibre.

## CORS R2 hiện tại

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

## Chức năng

- 3 basemap: đường phố, vệ tinh, địa hình.
- Địa giới hành chính độc lập, viền xanh và xem thuộc tính.
- Tự sinh danh mục lớp từ metadata PMTiles.
- Lọc Hiện trạng / Định hướng / Phương án / Khác.
- Tìm kiếm lớp, bật/tắt lớp, preset lớp chính và lớp phù hợp zoom.
- Click đối tượng quy hoạch để đọc thuộc tính.
- URL hash giữ vị trí/zoom bản đồ.
- Responsive desktop/mobile.
- Trạng thái nguồn hiển thị trực tiếp: R2/QA/local, HTTP 206 và contract.

## QA / integrity

Workflow `.github/workflows/verify-r2-production.yml` kiểm tra public R2 bằng range request 127 byte: HTTP 206, CORS, tổng size, magic PMTiles và spec v3.

Workflow `.github/workflows/bootstrap-pmtiles.yml` vẫn dùng để verify/bootstrap archive canonical nếu muốn lưu local.

## Local development

```bash
python -m http.server 8080
```

Không mở bằng `file://`.

## Vai trò hệ thống

- GitHub: mã nguồn, Pages, checksum, tài liệu, CI/QA.
- Cloudflare R2: archive PMTiles production.
- R2 Data Catalog: metadata/analytics Apache Iceberg.
- Master GIS: FileGDB/GeoPackage/PostGIS/GeoParquet quản lý ngoài artifact web.
- PMTiles: artifact phân phối web, không phải nơi biên tập master data.

Xem thêm `docs/ARCHITECTURE.md` và `docs/CLOUDFLARE_R2.md`.
