import * as maplibregl from "https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs";
import { DATASET, BASE_STYLE_URL, DEFAULT_VISIBLE } from "./config.js";
import { readPMTilesMetadata } from "./pmtiles-meta.js";

const els = {
  layerList: document.getElementById("layerList"),
  search: document.getElementById("layerSearch"),
  status: document.getElementById("datasetStatus"),
  error: document.getElementById("errorBanner"),
  zoom: document.getElementById("zoomBadge"),
  statLayers: document.getElementById("statLayers"),
  statFeatures: document.getElementById("statFeatures"),
  statZoom: document.getElementById("statZoom")
};

const runtime = {
  catalog: [],
  styleIds: new Map(),
  enabled: new Set(),
  metadata: null
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
  return id
    .replace(/_([PLA])$/i, " · $1")
    .replaceAll("_", " ")
    .replace(/([a-zà-ỹ])([A-Z])/g, "$1 $2")
    .trim();
}

function groupName(id) {
  if (/^HienTrang/i.test(id) || /^Hientrang/i.test(id)) return "Hiện trạng";
  if (/^DinhHuong/i.test(id)) return "Định hướng";
  if (/^PhuongAn/i.test(id)) return "Phương án";
  return "Khác";
}

function semanticColor(id) {
  if (/HienTrangSuDungDatCapTinh/i.test(id)) return "#2f855a";
  if (/PhuongAnPhanBoKhoanhVungDatDai/i.test(id)) return "#7c3aed";
  if (/^HienTrang/i.test(id) || /^Hientrang/i.test(id)) return "#0f766e";
  if (/^DinhHuong/i.test(id)) return "#d97706";
  if (/^PhuongAn/i.test(id)) return "#7c3aed";
  return "#2563eb";
}

function geometryKind(layer) {
  const g = String(layer.geometry_type || "").toLowerCase();
  if (g.includes("polygon")) return "polygon";
  if (g.includes("line")) return "line";
  if (g.includes("point")) return "point";
  return "unknown";
}

function visibleByDefault(id) {
  return DEFAULT_VISIBLE.has(id);
}

function addStyleLayers(map, layer) {
  if (!layer.feature_count || geometryKind(layer) === "unknown") {
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

  if (geometryKind(layer) === "polygon") {
    const fillId = `vf:${layer.id}:fill`;
    const lineId = `vf:${layer.id}:outline`;

    map.addLayer({
      id: fillId,
      type: "fill",
      ...common,
      paint: {
        "fill-color": color,
        "fill-opacity": /HienTrangSuDungDatCapTinh/i.test(layer.id)
          ? ["interpolate", ["linear"], ["zoom"], 12, 0.18, 15, 0.34]
          : 0.18
      }
    });

    map.addLayer({
      id: lineId,
      type: "line",
      ...common,
      paint: {
        "line-color": color,
        "line-opacity": 0.86,
        "line-width": /HienTrangSuDungDatCapTinh/i.test(layer.id)
          ? ["interpolate", ["linear"], ["zoom"], 12, 0.35, 15, 1.05]
          : ["interpolate", ["linear"], ["zoom"], 7, 0.7, 15, 1.6]
      }
    });
    ids.push(fillId, lineId);
  } else if (geometryKind(layer) === "line") {
    const id = `vf:${layer.id}:line`;
    map.addLayer({
      id,
      type: "line",
      ...common,
      paint: {
        "line-color": color,
        "line-opacity": 0.92,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.0, 15, 3.0]
      }
    });
    ids.push(id);
  } else if (geometryKind(layer) === "point") {
    const id = `vf:${layer.id}:circle`;
    map.addLayer({
      id,
      type: "circle",
      ...common,
      paint: {
        "circle-color": color,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 15, 6],
        "circle-opacity": 0.9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1
      }
    });
    ids.push(id);
  }

  runtime.styleIds.set(layer.id, ids);
  if (visibleByDefault(layer.id)) runtime.enabled.add(layer.id);
}

function setLayerVisibility(map, layerId, visible) {
  const ids = runtime.styleIds.get(layerId) || [];
  for (const id of ids) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    }
  }

  if (visible) runtime.enabled.add(layerId);
  else runtime.enabled.delete(layerId);

  const checkbox = document.querySelector(`input[data-layer-id="${CSS.escape(layerId)}"]`);
  if (checkbox) checkbox.checked = visible;
}

function buildLayerManager(map, catalog) {
  runtime.catalog = catalog;

  function render(filter = "") {
    const q = filter.trim().toLocaleLowerCase("vi");
    els.layerList.replaceChildren();

    const groups = ["Hiện trạng", "Định hướng", "Phương án", "Khác"];
    for (const group of groups) {
      const subset = catalog.filter((layer) => {
        if (groupName(layer.id) !== group) return false;
        return !q || prettyName(layer.id).toLocaleLowerCase("vi").includes(q);
      });

      if (!subset.length) continue;

      const title = document.createElement("div");
      title.className = "layer-group-title";
      title.textContent = `${group} · ${subset.length}`;
      els.layerList.appendChild(title);

      for (const layer of subset) {
        const row = document.createElement("label");
        row.className = `layer-row${layer.feature_count ? "" : " empty"}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.dataset.layerId = layer.id;
        checkbox.checked = runtime.enabled.has(layer.id);
        checkbox.disabled = !layer.feature_count || geometryKind(layer) === "unknown";
        checkbox.addEventListener("change", () => {
          setLayerVisibility(map, layer.id, checkbox.checked);
        });

        const name = document.createElement("span");
        name.className = "layer-name";
        name.textContent = prettyName(layer.id);
        name.title = layer.id;

        const meta = document.createElement("span");
        meta.className = "layer-meta";
        const count = Number(layer.feature_count || 0).toLocaleString("vi-VN");
        meta.textContent = `${count} · z${layer.minzoom ?? "?"}–${layer.maxzoom ?? "?"}`;

        row.append(checkbox, name, meta);
        els.layerList.appendChild(row);
      }
    }
  }

  render();
  els.search.addEventListener("input", () => render(els.search.value));
}

function propertiesTable(feature) {
  const rows = Object.entries(feature.properties || {})
    .filter(([, value]) => value !== null && value !== "" && value !== undefined)
    .slice(0, 30)
    .map(([key, value]) =>
      `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `
    <div class="feature-popup">
      <strong>${escapeHtml(prettyName(feature.sourceLayer || "Đối tượng"))}</strong>
      <table>${rows || "<tr><td>Không có thuộc tính.</td></tr>"}</table>
    </div>
  `;
}

function installInteractions(map) {
  map.on("mousemove", (event) => {
    const hits = map.queryRenderedFeatures(event.point).filter((f) => f.source === DATASET.id);
    map.getCanvas().style.cursor = hits.length ? "pointer" : "";
  });

  map.on("click", (event) => {
    const hit = map.queryRenderedFeatures(event.point).find((f) => f.source === DATASET.id);
    if (!hit) return;

    new maplibregl.Popup({ maxWidth: "390px" })
      .setLngLat(event.lngLat)
      .setHTML(propertiesTable(hit))
      .addTo(map);
  });

  map.on("zoom", () => {
    els.zoom.textContent = `z${map.getZoom().toFixed(1)}`;
  });
}

function installButtons(map) {
  document.getElementById("fitBounds").addEventListener("click", () => {
    map.fitBounds(
      [[DATASET.bounds[0], DATASET.bounds[1]], [DATASET.bounds[2], DATASET.bounds[3]]],
      { padding: 36, duration: 650 }
    );
  });

  document.getElementById("hideAll").addEventListener("click", () => {
    for (const layer of runtime.catalog) setLayerVisibility(map, layer.id, false);
  });

  document.getElementById("showDefaults").addEventListener("click", () => {
    for (const layer of runtime.catalog) {
      setLayerVisibility(map, layer.id, DEFAULT_VISIBLE.has(layer.id));
    }
  });
}

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE_URL,
  center: DATASET.center,
  zoom: DATASET.initialZoom,
  maxZoom: 19,
  hash: true,
  attributionControl: true
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

const protocol = new window.pmtiles.Protocol({ metadata: true });
maplibregl.addProtocol("pmtiles", protocol.tile);

const archive = new window.pmtiles.PMTiles(DATASET.url);
protocol.add(archive);

map.once("load", async () => {
  try {
    clearError();
    setStatus("Đang đọc header và metadata PMTiles…", "loading");

    const [header, parsed] = await Promise.all([
      archive.getHeader(),
      readPMTilesMetadata(DATASET.url)
    ]);

    runtime.metadata = parsed.metadata;
    const catalog = Array.isArray(parsed.metadata.vector_layers)
      ? parsed.metadata.vector_layers
      : [];

    map.addSource(DATASET.id, {
      type: "vector",
      url: `pmtiles://${DATASET.url}`,
      minzoom: header.minZoom,
      maxzoom: header.maxZoom
    });

    for (const layer of catalog) addStyleLayers(map, layer);

    buildLayerManager(map, catalog);
    installInteractions(map);
    installButtons(map);

    const nonempty = catalog.filter((x) => Number(x.feature_count) > 0).length;
    const totalFeatures = catalog.reduce((sum, x) => sum + Number(x.feature_count || 0), 0);

    els.statLayers.textContent = String(catalog.length || 117);
    els.statFeatures.textContent = totalFeatures.toLocaleString("vi-VN");
    els.statZoom.textContent = `z${header.minZoom}–${header.maxZoom}`;

    if (parsed.rangeSupported) {
      setStatus(`PMTiles OK · ${nonempty}/${catalog.length} lớp có dữ liệu · HTTP Range OK`, "ok");
    } else {
      setStatus("PMTiles đọc được nhưng server không trả HTTP 206 Range.", "warn");
      showError("Server đang bỏ qua Range Request. Demo vẫn có thể chạy nhưng sẽ tải dữ liệu không hiệu quả; production phải bật byte-range.");
    }
  } catch (error) {
    console.error(error);
    setStatus("Không thể mở VinhLong.pmtiles", "error");
    showError(
      `Không đọc được PMTiles: ${error.message}. Kiểm tra data/VinhLong.pmtiles hoặc truyền ?pmtiles=https://... tới nguồn R2/CDN.`
    );
  }
});

map.on("error", (event) => {
  if (event?.error) console.warn("MapLibre:", event.error);
});
