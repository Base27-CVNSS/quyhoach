# Cloudflare R2 + CDN cho PMTiles

R2 là đích production khuyến nghị cho `VinhLong.pmtiles`. PMTiles cần **HTTP byte-range** và CORS đúng để trình duyệt chỉ tải tile cần thiết.

## 1. Object layout

Khuyến nghị không ghi đè object production đang cache:

```text
vietflex-pmtiles/
└─ quyhoach/
   └─ vinhlong/
      ├─ v1/
      │  └─ VinhLong.pmtiles
      └─ latest.json
```

Ứng dụng có thể trỏ trực tiếp tới version bất biến:

```text
https://cdn.example.vn/quyhoach/vinhlong/v1/VinhLong.pmtiles
```

## 2. CORS gợi ý

Trong R2, cho phép origin thực tế của WebGIS. Ví dụ:

```json
[
  {
    "AllowedOrigins": [
      "https://base27-cvnss.github.io"
    ],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["Range"],
    "ExposeHeaders": [
      "ETag",
      "Accept-Ranges",
      "Content-Length",
      "Content-Range"
    ],
    "MaxAgeSeconds": 86400
  }
]
```

Nếu có domain riêng, thêm domain đó thay vì mở `*` không cần thiết.

## 3. Cache

Với object versioned:

```text
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/octet-stream
```

Không dùng cache immutable cho URL `latest` nếu nội dung có thể thay đổi.

## 4. Kiểm tra byte-range

```bash
curl -I -H "Range: bytes=0-16383" \
  https://cdn.example.vn/quyhoach/vinhlong/v1/VinhLong.pmtiles
```

Kỳ vọng:
- HTTP `206 Partial Content`
- `Content-Range`
- `Accept-Ranges: bytes` hoặc hành vi range tương đương
- CORS cho origin WebGIS.

## 5. Chuyển WebGIS sang R2

Không cần sửa code. Mở:

```text
https://base27-cvnss.github.io/quyhoach/?pmtiles=https://cdn.example.vn/quyhoach/vinhlong/v1/VinhLong.pmtiles
```

Sau khi QA xong, cập nhật `src/config.js` để URL R2 trở thành mặc định.

## 6. Nguyên tắc

GitHub chứa:
- source code;
- tài liệu;
- checksum;
- có thể chứa PMTiles demo nếu dưới giới hạn GitHub.

R2 chứa:
- archive production;
- versioned objects;
- cache/CDN;
- dữ liệu lớn tăng dần theo thời gian.

Không biến GitHub repo thành kho master GIS dài hạn.
