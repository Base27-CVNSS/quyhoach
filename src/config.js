const query = new URLSearchParams(window.location.search);

export const DATASET = {
  id: "vinhlong",
  name: "Vĩnh Long",
  localUrl: new URL("../data/VinhLong.pmtiles", import.meta.url).href,
  url: query.get("pmtiles") || new URL("../data/VinhLong.pmtiles", import.meta.url).href,
  bounds: [105.5898088, 9.3994054, 106.8586394, 10.4697316],
  center: [106.2242241, 9.9345685],
  initialZoom: 9,
  minZoom: 7,
  maxZoom: 15,
  sizeBytes: 94357111,
  sha256: "dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf"
};

export const BASE_STYLE_URL =
  query.get("style") || "https://demotiles.maplibre.org/style.json";

export const DEFAULT_VISIBLE = new Set([
  "DinhHuongPhanVungKinhTeXaHoi_A",
  "HienTrangMangLuoiDuongBo_L",
  "DinhHuongPhatTrienMangLuoiDuongBo_L",
  "HienTrangHeThongDuLich_P",
  "DinhHuongPhatTrienHeThongDuLich_P",
  "PhuongAnPhanBoKhoanhVungDatDai_A",
  "HienTrangSuDungDatCapTinh_A"
]);
