# Vietflex Quy hoạch — Vĩnh Long PMTiles WebGIS

WebGIS quy hoạch Vĩnh Long theo kiến trúc **single-file vector tiles**: dữ liệu gốc được biên dịch thành một PMTiles v3 đa lớp và phân phối bằng HTTP Range Request tới MapLibre GL JS.

```text
                 MASTER DATA
                 VinhLong.gdb
                      │
                      ▼
                VinhLong.pmtiles
              94,357,111 bytes
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
   GitHub Pages              Cloudflare R2
                                 + CDN
         │                         │
         └────────────┬────────────┘
                      ▼
              PMTiles Protocol
                      │
                      ▼
             MapLibre GL JS
                      │
                      ▼
              Vietflex WebGIS
```

## Dataset

- PMTiles: `data/VinhLong.pmtiles`
- PMTiles spec: v3
- Vector tile: MVT/PBF + gzip
- 117 lớp GIS
- 95 lớp có dữ liệu, 22 lớp rỗng
- 165.017 feature
- 7.485 vector tiles
- Zoom: z7–z15
- Bounds: `105.5898088, 9.3994054, 106.8586394, 10.4697316`
- SHA-256: `dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf`

### Multi-scale policy

- `HienTrangSuDungDatCapTinh_A`: z12–z15, 144.600 polygon; z15 giữ chi tiết cao.
- `PhuongAnPhanBoKhoanhVungDatDai_A`: z10–z15, 12.332 polygon.
- Điểm: chủ yếu z8–z15.
- Đường: chủ yếu z7–z15.
- Polygon nền: chủ yếu z7–z15.
- Ba vùng hình học cực phức tạp dùng z10–z14 để kiểm soát dung lượng.

## Cấu trúc

```text
/
├─ index.html
├─ assets/
│  └─ styles.css
├─ src/
│  ├─ app.js
│  ├─ config.js
│  └─ pmtiles-meta.js
├─ data/
│  ├─ VinhLong.pmtiles
│  ├─ VinhLong.pmtiles.sha256
│  └─ README.md
├─ docs/
│  ├─ ARCHITECTURE.md
│  └─ CLOUDFLARE_R2.md
├─ tools/
│  └─ verify_pmtiles.py
├─ .gitattributes
└─ .nojekyll
```

## Chạy

Không mở bằng `file://`. Hãy phục vụ qua HTTP để Range Request hoạt động.

```bash
python -m http.server 8080
```

Mở `http://localhost:8080`.

Mặc định ứng dụng dùng `./data/VinhLong.pmtiles`. Có thể thử nguồn R2/CDN mà không sửa code:

```text
https://base27-cvnss.github.io/quyhoach/?pmtiles=https://cdn.example.com/VinhLong.pmtiles
```

## Thiết kế runtime

Ứng dụng đọc metadata `vector_layers` trực tiếp từ PMTiles bằng Range Request, sau đó tự tạo layer manager cho toàn bộ lớp. Lớp rỗng vẫn xuất hiện trong catalog nhưng bị vô hiệu hóa. Chỉ một nhóm lớp quan trọng được bật mặc định để giảm tải render.

MapLibre GL JS được ghim major version; PMTiles JS được ghim version cụ thể. Không cần API key để đọc PMTiles.

## Phân phối

- **GitHub Pages**: phù hợp demo/QA.
- **Cloudflare R2 + CDN**: khuyến nghị production; xem `docs/CLOUDFLARE_R2.md`.
- Client chỉ tải header/directory và các byte range của tile đang nhìn, không tải toàn bộ ~90 MB.

## Kiểm tra dữ liệu

```bash
python tools/verify_pmtiles.py data/VinhLong.pmtiles
```

## Nguồn mở

- MapLibre GL JS: BSD-3-Clause
- PMTiles: BSD-3-Clause
- Basemap demo MapLibre chỉ dùng cho khung thử nghiệm; production nên thay bằng basemap/CDN do đơn vị quản lý.

## License

Mã nguồn khung: MIT. Dữ liệu GIS có thể có điều kiện cấp phép riêng và không mặc nhiên theo MIT.
