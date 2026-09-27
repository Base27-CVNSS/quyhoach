# Kiến trúc WebGIS Quy hoạch Vĩnh Long

## 1. Hai tầng dữ liệu độc lập

WebGIS tách **lớp nền hành chính** khỏi **archive quy hoạch**:

```text
webgis-vinhlong/webgis-vinhlong.github.io
              │
              ▼
data/vinhlong-admin-2026.geojson
      124 xã / phường
              │
              ├──────────────┐
              │              │
              ▼              ▼
        MapLibre GL JS   VinhLong.pmtiles
                            117 lớp GIS
                               │
                     PMTiles v3 / HTTP Range
                               │
              ┌────────────────┴──────────────┐
              ▼                               ▼
        GitHub Pages                     R2 + CDN
        demo / QA                        production
```

Lớp nền hành chính vẫn hoạt động nếu PMTiles chưa có hoặc CDN lỗi. PMTiles là **delivery artifact**; master GIS vẫn được quản lý riêng bằng FileGDB/GeoPackage/PostGIS/GeoParquet.

## 2. PMTiles contract

Archive canonical:

- tên: `VinhLong.pmtiles`
- size: `94,357,111` bytes
- SHA-256: `dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf`
- PMTiles v3
- MVT/PBF + gzip
- 117 vector layers
- 95 lớp có dữ liệu
- 165.017 feature
- 7.485 tiles
- zoom z7–z15
- bounds `[105.5898088, 9.3994054, 106.8586394, 10.4697316]`

Metadata `vector_layers` là **source of truth** cho layer catalog. Runtime không duy trì thủ công danh sách 117 lớp.

## 3. Runtime discovery

`src/pmtiles-meta.js` đọc trực tiếp PMTiles bằng byte range:

1. đọc 127 byte header PMTiles v3;
2. lấy offset/length JSON metadata;
3. đọc đúng range metadata;
4. giải nén gzip khi cần;
5. đọc `vector_layers`;
6. tạo source/layer MapLibre theo geometry, minzoom và maxzoom.

`src/app.js` còn có fallback nhận geometry từ hậu tố:

- `_A` → polygon;
- `_L` → line;
- `_P` → point.

Nhờ đó catalog vẫn hoạt động nếu metadata không chứa `geometry_type`.

## 4. Administrative baseline

`data/vinhlong-admin-2026.geojson` được nạp độc lập:

- fill gần trong suốt;
- viền xanh dương để làm rõ địa giới;
- hover tăng độ sáng/độ dày;
- click mở bảng thuộc tính;
- luôn được đưa lên trên các lớp quy hoạch để không bị che khuất.

Đây là phần kế thừa trực tiếp tinh thần lớp nền của WebGIS Vĩnh Long.

## 5. Multi-scale policy

- `HienTrangSuDungDatCapTinh_A`: z12–z15, 144.600 polygon.
- `PhuongAnPhanBoKhoanhVungDatDai_A`: z10–z15, 12.332 polygon.
- Điểm: chủ yếu z8–z15.
- Đường: chủ yếu z7–z15.
- Polygon tổng hợp: chủ yếu z7–z15.
- Các polygon rất phức tạp có thể dừng ở z14 để kiểm soát tile size.

Không đưa toàn bộ chi tiết đất đai lên zoom thấp.

## 6. Nguồn PMTiles

Runtime ưu tiên:

```text
?pmtiles=https://cdn.example.vn/.../VinhLong.pmtiles
```

Nếu không có tham số, runtime dùng:

```text
data/VinhLong.pmtiles
```

Do vậy production có thể dùng R2/CDN mà không phải sửa UI.

## 7. Failure behavior

- GeoJSON nền lỗi → PMTiles vẫn có thể chạy.
- PMTiles lỗi/404 → basemap + địa giới vẫn chạy và UI báo rõ.
- Sai magic/spec/metadata → dừng nạp archive, không fallback âm thầm.
- Server không hỗ trợ HTTP 206 → cảnh báo hiệu năng.
- CDN CORS sai → báo lỗi rõ để sửa origin/header.

## 8. Bootstrap và kiểm tra archive

Workflow `.github/workflows/bootstrap-pmtiles.yml`:

- nếu local archive đã tồn tại → verify;
- nếu chưa có → có thể chạy thủ công với `source_url` ổn định;
- kiểm tra size, SHA-256 và header trước khi commit.

Không lưu URL ký tạm thời trong repo.

## 9. Production long-term

Khuyến nghị object versioned:

```text
/quyhoach/vinhlong/
  v1/VinhLong.pmtiles
  v2/VinhLong.pmtiles
  latest.json
```

Mỗi lần phát hành mới:

1. build từ master GIS;
2. verify checksum/header;
3. so layer count và feature count;
4. QA các zoom quan trọng;
5. upload object versioned;
6. bật cache immutable;
7. QA bằng `?pmtiles=`;
8. mới đổi URL production mặc định nếu cần.
