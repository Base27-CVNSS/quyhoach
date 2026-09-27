# Kiến trúc Vietflex Quy hoạch

## 1. Nguyên tắc

Repo này tách **master GIS** khỏi **web distribution**.

```text
FileGDB / GeoPackage / GeoParquet
          │
          │ build / QA-QC
          ▼
   PMTiles v3 đa lớp
          │
          ├── GitHub Pages (demo / QA)
          └── Cloudflare R2 + CDN (production)
                         │
                         ▼
                   HTTP Range
                         │
                         ▼
                PMTiles protocol
                         │
                         ▼
                 MapLibre GL JS
```

PMTiles là **delivery artifact**, không phải nơi chỉnh sửa dữ liệu gốc.

## 2. Dataset contract

Archive hiện tại:

- `VinhLong.pmtiles`
- 94.357.111 bytes
- SHA-256 `dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf`
- 117 vector layers
- 165.017 feature
- z7–z15
- bounds `[105.5898088, 9.3994054, 106.8586394, 10.4697316]`

Metadata PMTiles là **source of truth** cho catalog lớp. Client không duy trì một danh sách 117 lớp thủ công.

## 3. Multi-scale contract

### Đất đai

`HienTrangSuDungDatCapTinh_A`
- 144.600 polygon
- minzoom 12
- maxzoom 15
- z15 ưu tiên giữ biên chi tiết.
- z12–z14 được generalize theo mức nhìn.

`PhuongAnPhanBoKhoanhVungDatDai_A`
- 12.332 polygon
- z10–z15.

Mục tiêu: không đưa toàn bộ polygon đất vào tile toàn tỉnh ở zoom thấp.

### Hạ tầng

- Point: chủ yếu z8–z15.
- Line: chủ yếu z7–z15.
- Polygon tổng hợp: chủ yếu z7–z15.
- Ba polygon cực phức tạp kết thúc ở z14.

## 4. Runtime contract

### Data source

```js
{
  type: "vector",
  url: "pmtiles://https://.../VinhLong.pmtiles",
  minzoom: 7,
  maxzoom: 15
}
```

### Metadata discovery

`src/pmtiles-meta.js` đọc:
1. 127 byte PMTiles v3 header.
2. offset/length của JSON metadata.
3. metadata qua Range Request.
4. giải nén gzip.
5. `vector_layers` → layer manager.

Do đó thay archive mới có cùng contract không cần sửa catalog JS.

## 5. UI rendering policy

Client chỉ bật mặc định một tập layer đại diện. Các lớp còn lại được tạo sẵn nhưng `visibility: none` cho tới khi người dùng bật.

Màu semantic:
- Hiện trạng: xanh lục lam.
- Định hướng: cam.
- Phương án: tím.
- Khác: xanh dương.

Đây là màu runtime khung, không thay thế bộ ký hiệu quy hoạch chính thức. Khi có style dictionary chuẩn, nên chuyển sang cấu hình style riêng theo mã đối tượng / mã loại đất.

## 6. Failure behavior

WebGIS phải cảnh báo rõ khi:
- file không tồn tại;
- sai magic PMTiles;
- không phải spec v3;
- server từ chối/không hỗ trợ Range;
- metadata hỏng;
- CDN CORS sai.

Không fallback âm thầm sang tải toàn bộ file trong production.

## 7. Versioning

Khuyến nghị:

```text
data/
  VinhLong.pmtiles
releases/
  v1.0.0 metadata/checksum
```

Mỗi lần thay archive:
1. chạy verify checksum/header;
2. QA zoom trọng yếu;
3. so feature count;
4. cập nhật checksum;
5. deploy R2;
6. purge CDN theo versioned object name hoặc immutable cache.
