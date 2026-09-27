#!/usr/bin/env python3
import gzip
import hashlib
import json
import struct
import sys
from pathlib import Path

EXPECTED_SHA256 = "dd17f53abe450c6d31615a09fffd312a84a263381cdd23c117a87a22f0fd68bf"
EXPECTED_SIZE = 94357111

def u64(buf, offset):
    return struct.unpack_from("<Q", buf, offset)[0]

def main():
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/VinhLong.pmtiles")
    if not path.exists():
        raise SystemExit(f"ERROR: missing {path}")

    size = path.stat().st_size
    sha = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            sha.update(chunk)
    digest = sha.hexdigest()

    with path.open("rb") as f:
        header = f.read(127)
        if header[:7] != b"PMTiles":
            raise SystemExit("ERROR: wrong PMTiles magic")
        version = header[7]
        if version != 3:
            raise SystemExit(f"ERROR: expected PMTiles v3, got v{version}")

        metadata_offset = u64(header, 24)
        metadata_length = u64(header, 32)
        internal_compression = header[97]
        min_zoom, max_zoom = header[100], header[101]
        bounds = [
            struct.unpack_from("<i", header, 102)[0] / 1e7,
            struct.unpack_from("<i", header, 106)[0] / 1e7,
            struct.unpack_from("<i", header, 110)[0] / 1e7,
            struct.unpack_from("<i", header, 114)[0] / 1e7,
        ]

        f.seek(metadata_offset)
        raw = f.read(metadata_length)

    if internal_compression == 2:
        raw = gzip.decompress(raw)
    elif internal_compression != 1:
        raise SystemExit(f"ERROR: unsupported internal compression {internal_compression}")

    metadata = json.loads(raw)
    layers = metadata.get("vector_layers", [])
    features = sum(int(x.get("feature_count", 0) or 0) for x in layers)
    nonempty = sum(1 for x in layers if int(x.get("feature_count", 0) or 0) > 0)

    print(f"file:      {path}")
    print(f"size:      {size} bytes")
    print(f"sha256:    {digest}")
    print(f"spec:      v{version}")
    print(f"zoom:      {min_zoom}..{max_zoom}")
    print(f"bounds:    {bounds}")
    print(f"layers:    {len(layers)} ({nonempty} non-empty)")
    print(f"features:  {features}")

    ok = True
    if size != EXPECTED_SIZE:
        print(f"WARN: size differs from expected {EXPECTED_SIZE}")
        ok = False
    if digest != EXPECTED_SHA256:
        print("WARN: SHA-256 differs from expected")
        ok = False

    if len(layers) != 117 or features != 165017:
        print("WARN: metadata counts differ from baseline")
        ok = False

    if not ok:
        raise SystemExit(2)

    print("PASS")

if __name__ == "__main__":
    main()
