const query = new URLSearchParams(window.location.search);

export const DATASET = {
  id: "vinhlong-planning",
  name: "Quy hoạch tỉnh Vĩnh Long",
  localUrl: new URL("../data/VinhLong.pmtiles", import.meta.url).href,
  url: query.get("pmtiles") || new URL("../data/VinhLong.pmtiles", import.meta.url).href,
  adminUrl: new URL("../data/vinhlong-admin-2026.geojson", import.meta.url).href,
  bounds: [105.5898088, 9.3994054, 106.8586394, 10.4697316],
  center: [106.2242241, 9.9345685],
  initialZoom: 8.85,
  minZoom: 7,
  maxZoom: 15,
  sourceLayers: 117,
  nonEmptyLayers: 95,
  features: 165017,
  tiles: 7485,
  sizeBytes: 94357111,
  sha256: "dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf"
};

export const SOURCE_PROJECT = {
  repo: "https://github.com/webgis-vinhlong/webgis-vinhlong.github.io",
  adminFeatures: 124,
  note: "Giao diện và bộ lớp nền kế thừa tinh thần WebGIS Vĩnh Long 2026; dữ liệu quy hoạch được tách riêng thành PMTiles."
};

export const BASEMAPS = {
  osm: {
    label: "Đường phố",
    attribution: "© OpenStreetMap contributors",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 19
  },
  satellite: {
    label: "Ảnh vệ tinh",
    attribution: "Tiles © Esri",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    maxzoom: 19
  },
  topo: {
    label: "Địa hình",
    attribution: "© OpenTopoMap contributors",
    tiles: ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 17
  }
};

export const DEFAULT_BASEMAP = query.get("basemap") || "osm";

export const DEFAULT_VISIBLE = new Set([
  "HienTrangMangLuoiDuongBo_L",
  "DinhHuongPhatTrienMangLuoiDuongBo_L",
  "HienTrangHeThongDuLich_P",
  "DinhHuongPhatTrienHeThongDuLich_P",
  "PhuongAnPhanBoKhoanhVungDatDai_A"
]);
