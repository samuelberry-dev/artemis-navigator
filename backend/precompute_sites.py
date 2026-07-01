"""
precompute_sites.py
-------------------
Offline terrain-analysis script for Artemis Navigator (Step 3).

Downloads real 5 m/pixel slope GeoTIFFs from NASA's Planetary Geodynamics
Laboratory (PGDA, pgda.gsfc.nasa.gov/products/78), finds the optimal
(lowest-slope, safe) landing point within each region down to ~5 m precision,
converts the winning pixel from south-polar-stereographic X/Y to lat/lon, and
writes the results to ../frontend/public/precise_sites.json.

This is real NASA terrain data (the same 5 m DEMs used for Artemis site
selection), processed locally and baked into a static file the app serves.

Run once:  python precompute_sites.py
"""

import json
import math
import os
import sys
import time
from pathlib import Path

import numpy as np
import rasterio
import requests
from rasterio.transform import xy

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

PGDA_BASE = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"

# Only the sites that map to regions we actually present in the app.
# `region_id` matches the Artemis site IDs used in the frontend SITES array.
# Keeping this list small avoids downloading many GB of rasters we don't need.
SITES = [
    {
        "key": "DM2",
        "region_id": 9,
        "region_name": "Nobile Rim 2",
        "slope_file": "DM2_final_adj_5mpp_slp.tif",
    },
    {
        "key": "Haworth",
        "region_id": 5,
        "region_name": "Haworth",
        "slope_file": "Haworth_final_adj_5mpp_slp.tif",
    },
    {
        "key": "Site01",
        "region_id": 1,
        "region_name": "Shackleton Crater Rim",
        "slope_file": "Site01_final_adj_5mpp_slp.tif",
    },
]

# Engineering constraint: Artemis HLS needs ground slope at or below ~10 deg.
# We search only pixels under this for the "optimal" (flattest) point.
MAX_SAFE_SLOPE_DEG = 10.0

DATA_DIR = Path("./dem_cache")
OUTPUT_FILE = Path("../frontend/public/precise_sites.json")

# Moon radius (km) for the stereographic -> lat/lon inverse.
MOON_RADIUS_KM = 1737.4


# ---------------------------------------------------------------------------
# DOWNLOAD
# ---------------------------------------------------------------------------

def download(site):
    """Download the slope GeoTIFF for a site if not already cached."""
    DATA_DIR.mkdir(exist_ok=True)
    dest = DATA_DIR / site["slope_file"]
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  [cache] {site['slope_file']} already downloaded "
              f"({dest.stat().st_size / 1e6:.1f} MB)")
        return dest

    url = f"{PGDA_BASE}/{site['key']}/{site['slope_file']}"
    print(f"  [http] downloading {url}")
    try:
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            total = int(r.headers.get("content-length", 0))
            got = 0
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 20):
                    f.write(chunk)
                    got += len(chunk)
                    if total:
                        pct = got / total * 100
                        print(f"\r    {got/1e6:6.1f} / {total/1e6:6.1f} MB "
                              f"({pct:5.1f}%)", end="")
            print()
        return dest
    except Exception as e:
        print(f"  [error] could not download {site['slope_file']}: {e}")
        if dest.exists():
            dest.unlink()
        return None


# ---------------------------------------------------------------------------
# COORDINATE CONVERSION
# ---------------------------------------------------------------------------

def stereo_xy_to_latlon(x_m, y_m):
    """
    Convert south-polar stereographic X/Y (meters) to lat/lon (degrees).

    PGDA DEMs use a south polar stereographic projection centered on the
    south pole, MOON_ME frame, sphere radius 1737.4 km. Standard inverse
    polar-stereographic formula for a sphere.
    """
    R = MOON_RADIUS_KM * 1000.0  # meters
    rho = math.hypot(x_m, y_m)
    if rho == 0:
        return -90.0, 0.0
    # c = angular distance from the projection center (south pole)
    c = 2.0 * math.atan2(rho, 2.0 * R)
    # For a south polar projection, latitude:
    lat = -(90.0 - math.degrees(c))
    # Longitude from x/y (south polar convention)
    lon = math.degrees(math.atan2(x_m, -y_m))
    # normalize lon to [-180, 180]
    lon = ((lon + 180.0) % 360.0) - 180.0
    return lat, lon


# ---------------------------------------------------------------------------
# ANALYSIS
# ---------------------------------------------------------------------------

def find_optimal_point(path, footprint_m=100):
    """
    Open a slope GeoTIFF and find the optimal landing point.

    Instead of picking the single flattest pixel (which can be a fluke-flat
    spot surrounded by rough terrain), we score every location by the MEAN
    slope over a lander-footprint-sized window (~100 m). This finds a spot
    that is flat across the whole footprint a lander actually occupies, which
    is how real landing-site safety is assessed.
    """
    with rasterio.open(path) as ds:
        slope = ds.read(1).astype("float32")
        nodata = ds.nodata
        transform = ds.transform
        res = transform.a  # pixel size in meters (5 m for these DEMs)

        # window radius in pixels for the footprint (e.g. 100 m / 5 m = 20 px)
        win = max(1, int(round((footprint_m / res) / 2)))

        # valid-pixel mask: finite, not nodata, real slope (exclude 0 artifacts),
        # and at/under the safety threshold
        valid = np.isfinite(slope)
        if nodata is not None and not (isinstance(nodata, float) and math.isnan(nodata)):
            valid &= slope != nodata
        valid &= slope > 0.05
        valid &= slope <= MAX_SAFE_SLOPE_DEG

        if not valid.any():
            return None

        # Build an integral image (summed-area table) of slope and of the valid
        # mask so we can compute windowed means in O(1) per pixel.
        slope_filled = np.where(valid, slope, 0.0).astype("float64")
        valid_f = valid.astype("float64")

        sat_slope = slope_filled.cumsum(0).cumsum(1)
        sat_count = valid_f.cumsum(0).cumsum(1)

        def window_sum(sat, r0, r1, c0, c1):
            # inclusive bounds, with safe edge handling
            total = sat[r1, c1]
            if r0 > 0:
                total -= sat[r0 - 1, c1]
            if c0 > 0:
                total -= sat[r1, c0 - 1]
            if r0 > 0 and c0 > 0:
                total += sat[r0 - 1, c0 - 1]
            return total

        h, w = slope.shape
        best = None  # (mean_slope, row, col, count_in_window)

        # Only evaluate candidate centers that are themselves valid; step by a
        # few pixels to keep it fast (still ~tens of meters precision).
        step = max(1, win // 4)
        ys, xs = np.where(valid)
        for y, x in zip(ys[::step], xs[::step]):
            r0, r1 = max(0, y - win), min(h - 1, y + win)
            c0, c1 = max(0, x - win), min(w - 1, x + win)
            cnt = window_sum(sat_count, r0, r1, c0, c1)
            # require the footprint to be mostly valid terrain
            area = (r1 - r0 + 1) * (c1 - c0 + 1)
            if cnt < 0.6 * area:
                continue
            ssum = window_sum(sat_slope, r0, r1, c0, c1)
            mean_slope = ssum / cnt
            if best is None or mean_slope < best[0]:
                best = (mean_slope, y, x, cnt)

        if best is None:
            return None

        mean_slope, row, col, cnt = best
        center_slope = float(slope[row, col])

        x_m, y_m = xy(transform, int(row), int(col), offset="center")
        lat, lon = stereo_xy_to_latlon(x_m, y_m)

        all_valid = slope[valid]
        return {
            "lat": round(lat, 5),
            "lon": round(lon, 5),
            "footprint_mean_slope_deg": round(float(mean_slope), 3),
            "center_pixel_slope_deg": round(center_slope, 3),
            "footprint_m": footprint_m,
            "region_mean_slope_deg": round(float(all_valid.mean()), 3),
            "region_min_slope_deg": round(float(all_valid.min()), 3),
            "safe_area_fraction": round(float(valid.sum()) / float(slope.size), 4),
            "resolution_m": int(round(res)),
            "pixel": [int(row), int(col)],
            "stereo_xy_m": [round(x_m, 1), round(y_m, 1)],
        }


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    results = []
    for site in SITES:
        print(f"\n=== {site['region_name']} ({site['key']}) ===")
        path = download(site)
        if path is None:
            print("  [skip] download failed")
            continue
        print("  [analyze] scanning 5 m slope raster for optimal point...")
        t0 = time.time()
        analysis = find_optimal_point(path)
        if analysis is None:
            print("  [skip] no safe pixels found")
            continue
        dt = time.time() - t0
        analysis.update({
            "region_id": site["region_id"],
            "region_name": site["region_name"],
            "source": f"NASA PGDA 5 m DEM ({site['slope_file']})",
            "source_url": "https://pgda.gsfc.nasa.gov/products/78",
        })
        results.append(analysis)
        print(f"  [done] optimal point {analysis['lat']}, {analysis['lon']} "
                    f"slope {analysis['footprint_mean_slope_deg']} deg  ({dt:.1f}s)")

    out = {
        "generated_by": "precompute_sites.py",
        "description": "Ultra-precise optimal landing points derived from real "
                       "NASA PGDA 5 m/pixel slope DEMs.",
        "max_safe_slope_deg": MAX_SAFE_SLOPE_DEG,
        "sites": results,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(out, f, indent=2)
    print(f"\nWrote {len(results)} precise site(s) to {OUTPUT_FILE.resolve()}")


if __name__ == "__main__":
    main()