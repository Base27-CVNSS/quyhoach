# Vĩnh Long · Cổng WebGIS Quy hoạch

WebGIS này lấy **khung nền hành chính Vĩnh Long 2026** từ dự án `webgis-vinhlong/webgis-vinhlong.github.io` làm lớp định vị, sau đó chồng **toàn bộ dữ liệu quy hoạch trong `VinhLong.pmtiles`** lên MapLibre GL JS.

## Kiến trúc

```text
WebGIS Vĩnh Long 2026
        │
        ├─ địa giới 124 xã/phường
        │   data/vinhlong-admin-2026.geojson
        │
        ▼
   MapLibre GL JS
        ▲
        │ PMTiles protocol + HTTP Range
        │
 VinhLong.pmtiles
   117 lớp GIS
        │
        ├─ GitHub Pages  → demo / QA
        └─ R2 + CDN      → production dài hạn
```

### Nguyên tắc cốt lõi

- Không nhúng 117 lớp thành GeoJSON vào HTML.
- PMTiles là **artifact phân phối gốc**, metadata `vector_layers` là source of truth cho catalog.
- Runtime tự phát hiện toàn bộ lớp, min/max zoom, geometry và số feature khi có metadata.
- Lớp nền hành chính độc lập với PMTiles: PMTiles lỗi thì địa giới và basemap vẫn chạy.
- Có thể đổi PMTiles sang Cloudflare R2/CDN bằng tham số `?pmtiles=https://...` mà không sửa UI.
- Master GIS vẫn nên được giữ riêng ở FileGDB/GeoPackage/PostGIS/GeoParquet; PMTiles là bản web tối ưu, không phải nơi biên tập.

## Dataset PMTiles

- File: `data/VinhLong.pmtiles`
- Spec: PMTiles v3
- Vector tile: MVT/PBF + gzip
- 117 lớp GIS
- 95 lớp có dữ liệu
- 165.017 feature
- 7.485 vector tiles
- Zoom z7–z15
- Bounds: `105.5898088, 9.3994054, 106.8586394, 10.4697316`
- Size: `94,357,111` bytes
- SHA-256: `dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf`

## Chức năng

- 3 basemap: đường phố, vệ tinh, địa hình.
- Địa giới Vĩnh Long 2026 luôn độc lập, viền xanh nổi rõ.
- Danh mục tự sinh từ metadata PMTiles.
- Lọc theo Hiện trạng / Định hướng / Phương án / Khác.
- Tìm lớp, bật/tắt từng lớp, bật lớp chính hoặc lớp phù hợp zoom.
- Click đối tượng quy hoạch hoặc địa giới để xem thuộc tính.
- URL hash giữ vị trí bản đồ.
- Giao diện desktop/mobile.

## Chạy local

Không mở bằng `file://`; PMTiles cần HTTP Range.

```bash
python -m http.server 8080
```

Mở `http://localhost:8080`.

## R2/CDN production

```text
https://base27-cvnss.github.io/quyhoach/?pmtiles=https://cdn.example.vn/quyhoach/vinhlong/v1/VinhLong.pmtiles
```

Khuyến nghị object versioned + cache immutable. Xem `docs/CLOUDFLARE_R2.md`.

## Kiểm tra archive

```bash
python tools/verify_pmtiles.py data/VinhLong.pmtiles
```

## Nguồn

- Baseline hành chính: `webgis-vinhlong/webgis-vinhlong.github.io`.
- MapLibre GL JS: BSD-3-Clause.
- PMTiles: BSD-3-Clause.
- OpenStreetMap / OpenTopoMap / Esri basemap theo điều khoản nguồn tương ứng.
- Mã nguồn khung repo: MIT; dữ liệu GIS có thể có điều kiện cấp phép riêng.
