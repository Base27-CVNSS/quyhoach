import * as maplibregl from "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs";
import { DATASET, SOURCE_PROJECT, BASEMAPS, DEFAULT_BASEMAP, DEFAULT_VISIBLE } from "./config.js";
import { readPMTilesMetadata } from "./pmtiles-meta.js";

const els = {
  layerList: document.getElementById("layerList"),
  search: document.getElementById("layerSearch"),
  status: document.getElementById("datasetStatus"),
  error: document.getElementById("errorBanner"),
  zoom: document.getElementById("zoomBadge"),
  statLayers: document.getElementById("statLayers"),
  statFeatures: document.getElementById("statFeatures"),
  statTiles: document.getElementById("statTiles"),
  statZoom: document.getElementById("statZoom"),
  layerSummary: document.getElementById("layerSummary"),
  groupFilters: document.getElementById("groupFilters"),
  basemapSelect: document.getElementById("basemapSelect"),
  adminToggle: document.getElementById("adminToggle"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  sidebar: document.getElementById("sidebar"),
  inspectPanel: document.getElementById("inspectPanel"),
  inspectClose: document.getElementById("inspectClose"),
  inspectLayer: document.getElementById("inspectLayer"),
  inspectTitle: document.getElementById("inspectTitle"),
  inspectBody: document.getElementById("inspectBody")
};

const runtime = {
  catalog: [],
  styleIds: new Map(),
  enabled: new Set(),
  metadata: null,
  activeGroup: "Tất cả",
  adminVisible: true,
  adminData: null,
  hoveredAdminId: null,
  pmtilesReady: false,
  source: null,
  diagnostics: null,
  sourceManifest: null
};

function setStatus(message, kind = "loading") {
  els.status.className = `status status-${kind}`;
  els.status.textContent = message;
}

function showError(message) {
  els.error.hidden = false;
  els.error.textContent = message;
}

function clearError() {
  els.error.hidden = true;
  els.error.textContent = "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyName(id) {
  return String(id || "")
    .replace(/_([PLA])$/i, " · $1")
    .replaceAll("_", " ")
    .replace(/([a-zà-ỹ])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function groupName(id) {
  if (/^HienTrang/i.test(id) || /^Hientrang/i.test(id)) return "Hiện trạng";
  if (/^DinhHuong/i.test(id)) return "Định hướng";
  if (/^PhuongAn/i.test(id)) return "Phương án";
  return "Khác";
}

function geometryKind(layer) {
  const g = String(layer?.geometry_type || layer?.geometry || "").toLowerCase();
  if (g.includes("polygon")) return "polygon";
  if (g.includes("line")) return "line";
  if (g.includes("point")) return "point";
  const suffix = String(layer?.id || "").match(/_([PLA])$/i)?.[1]?.toUpperCase();
  if (suffix === "A") return "polygon";
  if (suffix === "L") return "line";
  if (suffix === "P") return "point";
  return "unknown";
}

function geometryLabel(kind) {
  return kind === "polygon" ? "Vùng" : kind === "line" ? "Đường" : kind === "point" ? "Điểm" : "Khác";
}

function featureCount(layer) {
  if (layer?.feature_count === undefined || layer?.feature_count === null) return null;
  const n = Number(layer.feature_count);
  return Number.isFinite(n) ? n : null;
}

function hasData(layer) {
  const count = featureCount(layer);
  return count === null ? true : count > 0;
}

function semanticColor(id) {
  if (/HienTrangSuDungDatCapTinh/i.test(id)) return "#16835f";
  if (/PhuongAnPhanBoKhoanhVungDatDai/i.test(id)) return "#7c3aed";
  if (/^HienTrang/i.test(id) || /^Hientrang/i.test(id)) return "#0f766e";
  if (/^DinhHuong/i.test(id)) return "#d97706";
  if (/^PhuongAn/i.test(id)) return "#7c3aed";
  let hash = 0;
  for (const ch of String(id)) hash = ((hash << 5) - hash + ch.charCodeAt(0)) | 0;
  const palette = ["#2563eb", "#0369a1", "#0e7490", "#475569", "#4f46e5"];
  return palette[Math.abs(hash) % palette.length];
}

function buildBaseStyle() {
  const sources = {};
  const layers = [{
    id: "background",
    type: "background",
    paint: { "background-color": "#e9eff4" }
  }];

  const chosen = BASEMAPS[DEFAULT_BASEMAP] ? DEFAULT_BASEMAP : Object.keys(BASEMAPS)[0];
  for (const [key, cfg] of Object.entries(BASEMAPS)) {
    sources[`basemap:${key}`] = {
      type: "raster",
      tiles: cfg.tiles,
      tileSize: cfg.tileSize || 256,
      maxzoom: cfg.maxzoom || 19,
      attribution: cfg.attribution || ""
    };
    layers.push({
      id: `basemap:${key}`,
      type: "raster",
      source: `basemap:${key}`,
      layout: { visibility: key === chosen ? "visible" : "none" },
      paint: { "raster-opacity": 0.96 }
    });
  }
  return { version: 8, sources, layers };
}

function visibleByDefault(id) {
  return DEFAULT_VISIBLE.has(id);
}

function addPlanningStyleLayers(map, layer) {
  const kind = geometryKind(layer);
  if (!hasData(layer) || kind === "unknown") {
    runtime.styleIds.set(layer.id, []);
    return;
  }

  const color = semanticColor(layer.id);
  const visibility = visibleByDefault(layer.id) ? "visible" : "none";
  const ids = [];
  const common = {
    source: DATASET.id,
    "source-layer": layer.id,
    minzoom: layer.minzoom ?? DATASET.minZoom,
    maxzoom: (layer.maxzoom ?? DATASET.maxZoom) + 1,
    layout: { visibility }
  };

  if (kind === "polygon") {
    const fillId = `planning:${layer.id}:fill`;
    const lineId = `planning:${layer.id}:outline`;
    map.addLayer({
      id: fillId,
      type: "fill",
      ...common,
      paint: {
        "fill-color": color,
        "fill-opacity": /HienTrangSuDungDatCapTinh/i.test(layer.id)
          ? ["interpolate", ["linear"], ["zoom"], 10, 0.12, 15, 0.34]
          : 0.18
      }
    });
    map.addLayer({
      id: lineId,
      type: "line",
      ...common,
      paint: {
        "line-color": color,
        "line-opacity": 0.92,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.55, 15, 1.65]
      }
    });
    ids.push(fillId, lineId);
  } else if (kind === "line") {
    const id = `planning:${layer.id}:line`;
    map.addLayer({
      id,
      type: "line",
      ...common,
      paint: {
        "line-color": color,
        "line-opacity": 0.94,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.0, 15, 3.2]
      }
    });
    ids.push(id);
  } else if (kind === "point") {
    const id = `planning:${layer.id}:circle`;
    map.addLayer({
      id,
      type: "circle",
      ...common,
      paint: {
        "circle-color": color,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3.1, 15, 6.3],
        "circle-opacity": 0.92,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.1
      }
    });
    ids.push(id);
  }

  runtime.styleIds.set(layer.id, ids);
  if (visibleByDefault(layer.id)) runtime.enabled.add(layer.id);
}

function bringAdministrativeLayerToTop(map) {
  for (const id of ["admin-fill", "admin-line"]) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}

function setLayerVisibility(map, layerId, visible) {
  for (const id of runtime.styleIds.get(layerId) || []) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
  if (visible) runtime.enabled.add(layerId);
  else runtime.enabled.delete(layerId);

  const checkbox = document.querySelector(`input[data-layer-id="${CSS.escape(layerId)}"]`);
  if (checkbox) checkbox.checked = visible;
  updateLayerSummary();
}

function updateLayerSummary(shown = null) {
  const visibleRows = shown ?? runtime.catalog.length;
  els.layerSummary.textContent = `${visibleRows}/${runtime.catalog.length || DATASET.sourceLayers} lớp · ${runtime.enabled.size} đang bật`;
}

function layerMatches(layer) {
  const q = els.search.value.trim().toLocaleLowerCase("vi");
  if (runtime.activeGroup !== "Tất cả" && groupName(layer.id) !== runtime.activeGroup) return false;
  if (!q) return true;
  return `${layer.id} ${prettyName(layer.id)}`.toLocaleLowerCase("vi").includes(q);
}

function renderLayerManager(map) {
  const filtered = runtime.catalog.filter(layerMatches);
  els.layerList.replaceChildren();

  for (const group of ["Hiện trạng", "Định hướng", "Phương án", "Khác"]) {
    const subset = filtered.filter((layer) => groupName(layer.id) === group);
    if (!subset.length) continue;

    const title = document.createElement("div");
    title.className = "layer-group-title";
    title.innerHTML = `<span>${group}</span><span>${subset.length}</span>`;
    els.layerList.appendChild(title);

    for (const layer of subset) {
      const kind = geometryKind(layer);
      const count = featureCount(layer);
      const row = document.createElement("label");
      row.className = `layer-row${hasData(layer) ? "" : " empty"}`;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.layerId = layer.id;
      checkbox.checked = runtime.enabled.has(layer.id);
      checkbox.disabled = !hasData(layer) || kind === "unknown";
      checkbox.addEventListener("change", () => setLayerVisibility(map, layer.id, checkbox.checked));

      const swatch = document.createElement("span");
      swatch.className = "layer-swatch";
      swatch.style.background = semanticColor(layer.id);

      const copy = document.createElement("span");
      copy.className = "layer-copy";
      copy.innerHTML = `<span class="layer-name">${escapeHtml(prettyName(layer.id))}</span><small>${geometryLabel(kind)} · z${layer.minzoom ?? "?"}–${layer.maxzoom ?? "?"}</small>`;
      copy.title = layer.id;

      const meta = document.createElement("span");
      meta.className = "layer-meta";
      meta.textContent = count === null ? "GIS" : count.toLocaleString("vi-VN");

      row.append(checkbox, swatch, copy, meta);
      els.layerList.appendChild(row);
    }
  }

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Không có lớp phù hợp với bộ lọc.";
    els.layerList.appendChild(empty);
  }
  updateLayerSummary(filtered.length);
}

function propertyRows(properties, limit = 36) {
  return Object.entries(properties || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, limit)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join("");
}

function openInspector(kind, title, properties) {
  els.inspectLayer.textContent = kind;
  els.inspectTitle.textContent = title;
  els.inspectBody.innerHTML = `<table>${propertyRows(properties) || "<tr><td>Không có thuộc tính.</td></tr>"}</table>`;
  els.inspectPanel.hidden = false;
}

const ADMIN_NAME_KEYS = ["name", "NAME", "ten", "TEN", "Ten", "ten_xa", "TEN_XA", "xa_phuong", "phuong_xa", "ten_don_vi", "TEN_DON_VI"];
function adminName(feature) {
  for (const key of ADMIN_NAME_KEYS) {
    const value = feature?.properties?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "Đơn vị hành chính";
}

async function addAdministrativeBaseline(map) {
  const response = await fetch(DATASET.adminUrl, { cache: "force-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status} khi tải địa giới hành chính`);
  const data = await response.json();
  if (!data || !Array.isArray(data.features)) throw new Error("GeoJSON địa giới không hợp lệ.");
  runtime.adminData = data;

  map.addSource("vinhlong-admin-2026", {
    type: "geojson",
    data,
    generateId: true
  });
  map.addLayer({
    id: "admin-fill",
    type: "fill",
    source: "vinhlong-admin-2026",
    paint: {
      "fill-color": "#dbeafe",
      "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.15, 0.025]
    }
  });
  map.addLayer({
    id: "admin-line",
    type: "line",
    source: "vinhlong-admin-2026",
    paint: {
      "line-color": ["case", ["boolean", ["feature-state", "hover"], false], "#00a3ff", "#0563c1"],
      "line-opacity": 0.96,
      "line-width": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        ["interpolate", ["linear"], ["zoom"], 7, 2.1, 15, 4.2],
        ["interpolate", ["linear"], ["zoom"], 7, 1.0, 15, 2.3]
      ]
    }
  });
}

function setAdminVisibility(map, visible) {
  runtime.adminVisible = visible;
  for (const id of ["admin-fill", "admin-line"]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
  els.adminToggle.classList.toggle("active", visible);
  els.adminToggle.setAttribute("aria-pressed", String(visible));
}

function installInteractions(map) {
  map.on("mousemove", (event) => {
    const planningHit = runtime.pmtilesReady
      ? map.queryRenderedFeatures(event.point).find((f) => f.source === DATASET.id)
      : null;
    const adminHit = runtime.adminVisible && map.getLayer("admin-fill")
      ? map.queryRenderedFeatures(event.point, { layers: ["admin-fill"] })[0]
      : null;

    map.getCanvas().style.cursor = planningHit || adminHit ? "pointer" : "";

    const nextAdminId = adminHit?.id ?? null;
    if (runtime.hoveredAdminId !== null && runtime.hoveredAdminId !== nextAdminId) {
      map.setFeatureState({ source: "vinhlong-admin-2026", id: runtime.hoveredAdminId }, { hover: false });
    }
    if (nextAdminId !== null && runtime.hoveredAdminId !== nextAdminId) {
      map.setFeatureState({ source: "vinhlong-admin-2026", id: nextAdminId }, { hover: true });
    }
    runtime.hoveredAdminId = nextAdminId;
  });

  map.on("mouseleave", () => {
    if (runtime.hoveredAdminId !== null && map.getSource("vinhlong-admin-2026")) {
      map.setFeatureState({ source: "vinhlong-admin-2026", id: runtime.hoveredAdminId }, { hover: false });
      runtime.hoveredAdminId = null;
    }
  });

  map.on("click", (event) => {
    if (runtime.pmtilesReady) {
      const planningHit = map.queryRenderedFeatures(event.point).find((f) => f.source === DATASET.id);
      if (planningHit) {
        openInspector("LỚP QUY HOẠCH", prettyName(planningHit.sourceLayer || "Đối tượng quy hoạch"), planningHit.properties);
        return;
      }
    }

    if (runtime.adminVisible && map.getLayer("admin-fill")) {
      const adminHit = map.queryRenderedFeatures(event.point, { layers: ["admin-fill"] })[0];
      if (adminHit) openInspector("ĐỊA GIỚI VĨNH LONG 2026", adminName(adminHit), adminHit.properties);
    }
  });

  map.on("zoom", () => {
    els.zoom.textContent = `z${map.getZoom().toFixed(1)}`;
  });
}

function initBasemapControl(map) {
  els.basemapSelect.replaceChildren();
  for (const [key, cfg] of Object.entries(BASEMAPS)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = cfg.label;
    option.selected = key === DEFAULT_BASEMAP;
    els.basemapSelect.appendChild(option);
  }

  if (!BASEMAPS[els.basemapSelect.value]) els.basemapSelect.value = Object.keys(BASEMAPS)[0];

  els.basemapSelect.addEventListener("change", () => {
    for (const key of Object.keys(BASEMAPS)) {
      const id = `basemap:${key}`;
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", key === els.basemapSelect.value ? "visible" : "none");
    }
  });
}

function installControls(map) {
  document.getElementById("fitBounds").addEventListener("click", () => {
    map.fitBounds([[DATASET.bounds[0], DATASET.bounds[1]], [DATASET.bounds[2], DATASET.bounds[3]]], {
      padding: 42,
      duration: 700
    });
  });

  document.getElementById("hideAll").addEventListener("click", () => {
    for (const layer of runtime.catalog) setLayerVisibility(map, layer.id, false);
  });

  document.getElementById("showDefaults").addEventListener("click", () => {
    for (const layer of runtime.catalog) setLayerVisibility(map, layer.id, DEFAULT_VISIBLE.has(layer.id));
  });

  document.getElementById("showAllAtZoom").addEventListener("click", () => {
    const zoom = map.getZoom();
    for (const layer of runtime.catalog) {
      const min = Number(layer.minzoom ?? DATASET.minZoom);
      const max = Number(layer.maxzoom ?? DATASET.maxZoom);
      setLayerVisibility(map, layer.id, hasData(layer) && geometryKind(layer) !== "unknown" && zoom >= min && zoom <= max);
    }
  });

  els.adminToggle.addEventListener("click", () => setAdminVisibility(map, !runtime.adminVisible));
  els.sidebarToggle.addEventListener("click", () => els.sidebar.classList.toggle("open"));
  els.inspectClose.addEventListener("click", () => { els.inspectPanel.hidden = true; });

  els.search.addEventListener("input", () => renderLayerManager(map));
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== els.search) {
      event.preventDefault();
      els.search.focus();
    }
    if (event.key === "Escape") {
      els.inspectPanel.hidden = true;
      if (window.innerWidth <= 820) els.sidebar.classList.remove("open");
    }
  });

  els.groupFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (!button) return;
    runtime.activeGroup = button.dataset.group;
    for (const item of els.groupFilters.querySelectorAll("[data-group]")) item.classList.toggle("active", item === button);
    renderLayerManager(map);
  });
}

async function loadSourceManifest() {
  try {
    const response = await fetch(DATASET.sourceManifestUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const manifest = await response.json();
    runtime.sourceManifest = manifest;
    return manifest;
  } catch (error) {
    console.warn("Không đọc được pmtiles-source.json:", error);
    return null;
  }
}

function uniqueCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const url = String(candidate?.url || "").trim();
    if (!url || seen.has(url)) return false;
    seen.add(url);
    candidate.url = url;
    return true;
  });
}

function sourceLabel(resolved) {
  if (resolved.source === "query") return "QA";
  if (resolved.source === "local") return "LOCAL";
  if (resolved.manifest?.provider === "cloudflare-r2" || /\.r2\.dev\//i.test(resolved.url)) return "R2";
  return "CDN";
}

function validateArchiveContract(parsed, manifest) {
  const expected = manifest?.expected || DATASET;
  const warnings = [];
  const layers = Array.isArray(parsed.metadata?.vector_layers) ? parsed.metadata.vector_layers.length : 0;

  if (expected.layers && layers && layers !== Number(expected.layers)) warnings.push(`layer count ${layers}/${expected.layers}`);
  if (expected.minZoom !== undefined && parsed.header.minZoom !== Number(expected.minZoom)) warnings.push(`minzoom z${parsed.header.minZoom}/z${expected.minZoom}`);
  if (expected.maxZoom !== undefined && parsed.header.maxZoom !== Number(expected.maxZoom)) warnings.push(`maxzoom z${parsed.header.maxZoom}/z${expected.maxZoom}`);

  const totalSize = parsed.diagnostics?.totalSize;
  if (totalSize && expected.sizeBytes && totalSize !== Number(expected.sizeBytes)) warnings.push(`size ${totalSize}/${expected.sizeBytes}`);
  return warnings;
}

async function resolvePlanningSource() {
  if (DATASET.queryUrl) {
    const parsed = await readPMTilesMetadata(DATASET.queryUrl);
    return { url: DATASET.queryUrl, source: "query", manifest: null, parsed };
  }

  const manifest = await loadSourceManifest();
  const candidates = uniqueCandidates([
    { source: "manifest", url: manifest?.delivery?.publicUrl || manifest?.url || "", manifest },
    { source: "config-production", url: DATASET.productionUrl || "", manifest },
    { source: "local", url: DATASET.localUrl, manifest }
  ]);

  const failures = [];
  for (const candidate of candidates) {
    try {
      const parsed = await readPMTilesMetadata(candidate.url);
      return { ...candidate, parsed };
    } catch (error) {
      failures.push(`${candidate.source}: ${error.message}`);
      console.warn("PMTiles candidate failed:", candidate.source, candidate.url, error);
    }
  }

  throw new Error(`Không có nguồn PMTiles khả dụng. ${failures.join(" | ")}`);
}

async function initPlanningArchive(map, resolved) {
  const planningUrl = resolved.url;
  const parsed = resolved.parsed || await readPMTilesMetadata(planningUrl);
  const header = parsed.header;
  const protocol = new window.pmtiles.Protocol({ metadata: true });
  maplibregl.addProtocol("pmtiles", protocol.tile);
  const archive = new window.pmtiles.PMTiles(planningUrl);
  protocol.add(archive);

  runtime.metadata = parsed.metadata;
  runtime.catalog = Array.isArray(parsed.metadata.vector_layers) ? parsed.metadata.vector_layers : [];
  runtime.source = resolved;
  runtime.diagnostics = parsed.diagnostics;

  if (!runtime.catalog.length) throw new Error("PMTiles không có vector_layers metadata.");

  map.addSource(DATASET.id, {
    type: "vector",
    url: `pmtiles://${planningUrl}`,
    minzoom: header.minZoom,
    maxzoom: header.maxZoom
  });

  for (const layer of runtime.catalog) addPlanningStyleLayers(map, layer);
  runtime.pmtilesReady = true;
  bringAdministrativeLayerToTop(map);

  const nonempty = runtime.catalog.filter(hasData).length;
  const counted = runtime.catalog.map(featureCount).filter((n) => n !== null);
  const totalFeatures = counted.length ? counted.reduce((sum, n) => sum + n, 0) : DATASET.features;
  const warnings = validateArchiveContract(parsed, resolved.manifest);
  const label = sourceLabel(resolved);

  els.statLayers.textContent = String(runtime.catalog.length);
  els.statFeatures.textContent = Number(totalFeatures).toLocaleString("vi-VN");
  els.statTiles.textContent = Number(DATASET.tiles).toLocaleString("vi-VN");
  els.statZoom.textContent = `z${header.minZoom}–${header.maxZoom}`;

  const rangeText = parsed.rangeSupported ? "HTTP 206" : "Range chưa tối ưu";
  const statusText = warnings.length
    ? `PMTiles ${label} · ${runtime.catalog.length} lớp · cần kiểm tra contract`
    : `PMTiles ${label} OK · ${nonempty}/${runtime.catalog.length} lớp · ${rangeText}`;

  setStatus(statusText, warnings.length || !parsed.rangeSupported ? "warn" : "ok");
  els.status.title = [
    planningUrl,
    `Source: ${resolved.source}`,
    `Range: ${parsed.rangeSupported ? "206 Partial Content" : "không xác nhận 206"}`,
    parsed.diagnostics?.header?.contentRange ? `Content-Range: ${parsed.diagnostics.header.contentRange}` : "",
    parsed.diagnostics?.header?.etag ? `ETag: ${parsed.diagnostics.header.etag}` : "",
    warnings.length ? `Contract: ${warnings.join(", ")}` : "Contract: OK"
  ].filter(Boolean).join("\n");

  if (warnings.length) console.warn("PMTiles contract warnings:", warnings);
}

const map = new maplibregl.Map({
  container: "map",
  style: buildBaseStyle(),
  center: DATASET.center,
  zoom: DATASET.initialZoom,
  minZoom: 5,
  maxZoom: 19,
  hash: true,
  attributionControl: true,
  pitchWithRotate: true,
  dragRotate: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

map.once("load", async () => {
  clearError();
  initBasemapControl(map);
  installInteractions(map);
  installControls(map);

  try {
    await addAdministrativeBaseline(map);
  } catch (error) {
    console.error(error);
    showError(`Lớp nền hành chính chưa tải được: ${error.message}`);
  }

  try {
    const resolved = await resolvePlanningSource();
    await initPlanningArchive(map, resolved);
    console.info("PMTiles source:", resolved.source, resolved.url);
    if (resolved.manifest?.catalog?.uri) console.info("R2 Data Catalog:", resolved.manifest.catalog.uri);
  } catch (error) {
    console.error(error);
    setStatus("Địa giới OK · PMTiles lỗi", "error");
    showError(`Không mở được VinhLong.pmtiles: ${error.message}. Kiểm tra R2 Public URL/CORS/HTTP Range hoặc dùng ?pmtiles=https://... để QA.`);
  }

  renderLayerManager(map);
  bringAdministrativeLayerToTop(map);
  console.info("Baseline:", SOURCE_PROJECT.repo);
});

map.on("error", (event) => {
  if (event?.error) console.warn("MapLibre:", event.error);
});
