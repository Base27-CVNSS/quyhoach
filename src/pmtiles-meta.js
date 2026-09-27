function u64(view, offset) {
  const n = view.getBigUint64(offset, true);
  if (n > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("PMTiles offset vượt quá giới hạn Number an toàn của trình duyệt.");
  }
  return Number(n);
}

function parseTotalSize(contentRange) {
  const match = String(contentRange || "").match(/\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

function responseDiagnostics(response) {
  const contentRange = response.headers.get("content-range");
  return {
    status: response.status,
    contentRange,
    acceptRanges: response.headers.get("accept-ranges"),
    contentLength: Number(response.headers.get("content-length") || 0) || null,
    totalSize: parseTotalSize(contentRange),
    etag: response.headers.get("etag")
  };
}

async function fetchRange(url, start, end) {
  const response = await fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    headers: { Range: `bytes=${start}-${end}` },
    cache: "no-store"
  });

  if (response.status !== 200 && response.status !== 206) {
    throw new Error(`HTTP ${response.status} khi đọc PMTiles`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const diagnostics = responseDiagnostics(response);

  if (response.status === 200 && bytes.length >= end + 1) {
    return {
      bytes: bytes.slice(start, end + 1),
      rangeSupported: false,
      diagnostics
    };
  }

  if (response.status === 206 && bytes.length !== end - start + 1) {
    throw new Error(`HTTP Range trả sai kích thước: cần ${end - start + 1} byte, nhận ${bytes.length} byte.`);
  }

  return {
    bytes,
    rangeSupported: response.status === 206,
    diagnostics
  };
}

async function gunzip(bytes) {
  if (!("DecompressionStream" in window)) {
    throw new Error("Trình duyệt không hỗ trợ DecompressionStream(gzip).");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readPMTilesMetadata(url) {
  const head = await fetchRange(url, 0, 126);
  const view = new DataView(head.bytes.buffer, head.bytes.byteOffset, head.bytes.byteLength);
  const magic = new TextDecoder().decode(head.bytes.slice(0, 7));

  if (magic !== "PMTiles") throw new Error("Sai magic header: không phải PMTiles.");
  const specVersion = view.getUint8(7);
  if (specVersion !== 3) throw new Error(`PMTiles spec v${specVersion}; khung này yêu cầu v3.`);

  const metadataOffset = u64(view, 24);
  const metadataLength = u64(view, 32);
  const internalCompression = view.getUint8(97);
  if (!metadataLength) throw new Error("PMTiles metadata rỗng.");

  const metaPart = await fetchRange(url, metadataOffset, metadataOffset + metadataLength - 1);
  let raw = metaPart.bytes;

  if (internalCompression === 2) raw = await gunzip(raw);
  else if (internalCompression !== 1) {
    throw new Error(`Internal compression ${internalCompression} chưa được hỗ trợ.`);
  }

  let metadata;
  try {
    metadata = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new Error("Metadata PMTiles không phải JSON hợp lệ.");
  }

  return {
    header: {
      specVersion,
      minZoom: view.getUint8(100),
      maxZoom: view.getUint8(101),
      minLon: view.getInt32(102, true) / 1e7,
      minLat: view.getInt32(106, true) / 1e7,
      maxLon: view.getInt32(110, true) / 1e7,
      maxLat: view.getInt32(114, true) / 1e7,
      centerZoom: view.getUint8(118),
      centerLon: view.getInt32(119, true) / 1e7,
      centerLat: view.getInt32(123, true) / 1e7
    },
    metadata,
    rangeSupported: head.rangeSupported && metaPart.rangeSupported,
    diagnostics: {
      header: head.diagnostics,
      metadata: metaPart.diagnostics,
      totalSize: head.diagnostics.totalSize || metaPart.diagnostics.totalSize || null
    }
  };
}
