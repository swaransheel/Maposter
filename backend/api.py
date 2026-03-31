#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MAPOSTER Backend API

Flask REST API for the MAPOSTER application.
Provides endpoints for map generation, theme listing, and poster management.
"""

import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from flask import Flask, jsonify, request, send_file, render_template_string
from flask_cors import CORS
from dotenv import load_dotenv

# Add parent directory to path to import create_map_poster functions
sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_DIR = Path(__file__).parent.parent
THEMES_DIR = BASE_DIR / "themes"
POSTERS_DIR = BASE_DIR / "posters"

load_dotenv(BASE_DIR / ".env")
load_dotenv(Path(__file__).parent / ".env")
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
SUPABASE_REST_URL = f"{SUPABASE_URL}/rest/v1" if SUPABASE_URL else ""

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
CORS(app)  # Enable CORS for frontend communication

# Configuration
POSTERS_DIR.mkdir(exist_ok=True)
METADATA_FILE = POSTERS_DIR / "metadata.json"


# ──────── Root & Static Routes ────────

@app.route("/")
def serve_editor():
    """Serve the editor.html file."""
    editor_path = BASE_DIR / "editor.html"
    if editor_path.exists():
        with open(editor_path, "r", encoding="utf-8") as f:
            return f.read()
    return jsonify({"error": "editor.html not found"}), 404


@app.route("/<path:filename>")
def serve_static(filename):
    """Serve static files from the base directory."""
    try:
        file_path = BASE_DIR / filename
        if file_path.exists() and file_path.is_file():
            return send_file(str(file_path))
    except Exception as e:
        pass
    return jsonify({"error": "file not found"}), 404


# ──────── Metadata helpers ────────

def _load_metadata() -> Dict:
    """Load poster metadata from JSON file."""
    if METADATA_FILE.exists():
        try:
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"posters": []}


def _save_metadata(data: Dict) -> None:
    """Persist poster metadata to JSON file."""
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _add_poster_metadata(filename: str, params: Dict) -> None:
    """Append metadata for a newly generated poster."""
    meta = _load_metadata()
    poster_path = POSTERS_DIR / filename
    meta["posters"].append({
        "filename": filename,
        "user_id": params.get("user_id"),
        "city": params.get("city", ""),
        "country": params.get("country", ""),
        "latitude": params.get("latitude"),
        "longitude": params.get("longitude"),
        "theme": params.get("theme", ""),
        "dpi": params.get("dpi", 150),
        "distance_km": round(params.get("distance", 18000) / 1000, 1),
        "width": params.get("width", 12),
        "height": params.get("height", 16),
        "created_at": datetime.now().isoformat(),
        "file_size_kb": round(poster_path.stat().st_size / 1024) if poster_path.exists() else 0,
    })
    _save_metadata(meta)


def _remove_poster_metadata(filename: str) -> None:
    """Remove metadata entry for a deleted poster."""
    meta = _load_metadata()
    meta["posters"] = [p for p in meta["posters"] if p["filename"] != filename]
    _save_metadata(meta)


def _sync_metadata() -> None:
    """Ensure metadata.json is in sync with actual files on disk.
    Removes orphan entries and adds untracked files."""
    meta = _load_metadata()
    on_disk = {p.name for p in POSTERS_DIR.glob("*.png")}
    tracked = {p["filename"] for p in meta["posters"]}

    # Remove entries whose file no longer exists
    meta["posters"] = [p for p in meta["posters"] if p["filename"] in on_disk]

    # Build set of known theme IDs from theme files
    known_themes = {t.stem for t in THEMES_DIR.glob("*.json")} if THEMES_DIR.exists() else set()

    # Regex to match timestamp portion: dd-mm-yyyy_HHMMSS or yyyymmdd_HHMMSS
    ts_pattern = re.compile(r'_(\d{2}-\d{2}-\d{4}_\d{6}|\d{8}_\d{6})$')

    # Add untracked files with info parsed from filename
    for fname in sorted(on_disk - tracked):
        stem = Path(fname).stem
        fpath = POSTERS_DIR / fname

        # Strip timestamp suffix to get "city_theme" prefix
        m = ts_pattern.search(stem)
        if m:
            prefix = stem[:m.start()]  # e.g. "tokyo_japanese_ink"
        else:
            prefix = stem

        # Try to find a known theme at the end of the prefix
        city = prefix
        theme = "unknown"
        for tid in sorted(known_themes, key=len, reverse=True):
            if prefix.endswith(f"_{tid}"):
                city = prefix[:-(len(tid) + 1)]
                theme = tid
                break

        city = city.replace("_", " ").title()

        meta["posters"].append({
            "filename": fname,
            "user_id": None,
            "city": city,
            "country": "",
            "theme": theme,
            "dpi": 150,
            "distance_km": 18,
            "width": 12,
            "height": 16,
            "created_at": datetime.fromtimestamp(fpath.stat().st_mtime).isoformat(),
            "file_size_kb": round(fpath.stat().st_size / 1024),
        })

    _save_metadata(meta)


def load_themes() -> List[Dict]:
    """Load all available themes from the themes directory."""
    themes = []
    
    if not THEMES_DIR.exists():
        return themes
    
    for theme_file in THEMES_DIR.glob("*.json"):
        try:
            with open(theme_file, "r", encoding="utf-8") as f:
                theme_data = json.load(f)
                
                # Extract theme name from filename
                theme_id = theme_file.stem
                
                # Extract theme colors for preview
                # Order: road_motorway (dominant), bg, road_primary (accent), water
                # This shows the actual map's dominant colors better than bg first
                colors = []
                if "road_motorway" in theme_data:
                    colors.append(theme_data["road_motorway"])
                if "bg" in theme_data:
                    colors.append(theme_data["bg"])
                if "road_primary" in theme_data:
                    colors.append(theme_data["road_primary"])
                if "water" in theme_data:
                    colors.append(theme_data["water"])
                
                # Create theme object
                theme = {
                    "id": theme_id,
                    "name": theme_data.get("name", theme_id.replace("_", " ").title()),
                    "colors": colors[:4],  # Limit to 4 colors for display
                    "description": theme_data.get("description", "")
                }
                
                themes.append(theme)
        except Exception as e:
            print(f"Error loading theme {theme_file}: {e}")
            continue
    
    return sorted(themes, key=lambda x: x["name"])


def _find_poster_metadata(filename: str) -> Optional[Dict]:
    meta = _load_metadata()
    for entry in meta["posters"]:
        if entry.get("filename") == filename:
            return entry
    return None


def _get_bearer_token() -> Optional[str]:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1].strip()
    return token or None


def _supabase_rest_request(
    path: str,
    method: str,
    token: str,
    query: str = "",
    body: Optional[Dict] = None,
    prefer: Optional[str] = None,
) -> Tuple[int, object]:
    """Call Supabase PostgREST with the user's bearer token and return status/data."""
    if not SUPABASE_REST_URL or not SUPABASE_ANON_KEY:
        return 500, {"error": "Supabase is not configured on backend"}

    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {token}",
    }
    data_bytes = None

    if body is not None:
        headers["Content-Type"] = "application/json"
        data_bytes = json.dumps(body).encode("utf-8")

    if prefer:
        headers["Prefer"] = prefer

    req = urllib.request.Request(
        f"{SUPABASE_REST_URL}{path}{query}",
        headers=headers,
        method=method,
        data=data_bytes,
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = resp.read().decode("utf-8")
            return resp.status, json.loads(payload) if payload else {}
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode("utf-8") if exc.fp else ""
        try:
            parsed = json.loads(payload) if payload else {}
        except Exception:
            parsed = {"error": payload or str(exc)}
        return exc.code, parsed
    except Exception as exc:
        return 500, {"error": str(exc)}


def _get_authenticated_user_id() -> Optional[str]:
    """Resolve Supabase user id from bearer token by validating with Supabase Auth."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return None

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None

    try:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_ANON_KEY,
            },
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("id")
    except Exception:
        return None


def _require_auth() -> Tuple[Optional[str], Optional[str], Optional[Tuple[Dict, int]]]:
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None, None, ({"success": False, "error": "Supabase auth is not configured on backend"}, 500)

    token = _get_bearer_token()
    if not token:
        return None, None, ({"success": False, "error": "Unauthorized"}, 401)

    user_id = _get_authenticated_user_id()
    if not user_id:
        return None, None, ({"success": False, "error": "Unauthorized"}, 401)
    return user_id, token, None


def get_generated_posters(token: str) -> List[Dict]:
    """Get user-scoped generated posters from Supabase and map to local file URLs."""
    status, data = _supabase_rest_request(
        "/posters",
        "GET",
        token,
        query="?select=id,city,country,latitude,longitude,theme,image_path,created_at&order=created_at.desc",
    )

    if status >= 400 or not isinstance(data, list):
        return []

    posters = []
    for row in data:
        fname = row.get("image_path")
        if not fname:
            continue
        fpath = POSTERS_DIR / fname
        if not fpath.exists():
            continue
        stat = fpath.stat()
        posters.append({
            "id": row.get("id"),
            "city": row.get("city", ""),
            "country": row.get("country", ""),
            "latitude": row.get("latitude"),
            "longitude": row.get("longitude"),
            "theme": row.get("theme", ""),
            "filename": fname,
            "url": f"/api/posters/{fname}",
            "timestamp": int(stat.st_mtime * 1000),
            "size": stat.st_size,
            "dpi": 150,
            "distance_km": 18,
            "width": 12,
            "height": 16,
            "created_at": row.get("created_at", ""),
            "file_size_kb": round(stat.st_size / 1024),
        })

    return posters


@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "message": "Maposter API is running",
        "version": "1.0.0"
    })


@app.route("/api/themes", methods=["GET"])
def get_themes():
    """Get all available themes."""
    try:
        themes = load_themes()
        return jsonify({
            "success": True,
            "themes": themes,
            "count": len(themes)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/posters", methods=["GET"])
def get_posters():
    """Get list of all generated posters."""
    try:
        user_id, token, auth_error = _require_auth()
        if auth_error:
            return jsonify(auth_error[0]), auth_error[1]

        posters = get_generated_posters(token=token)
        return jsonify({
            "success": True,
            "posters": posters,
            "count": len(posters)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/posters/<filename>", methods=["GET", "DELETE"])
def poster_file(filename: str):
    """Get or delete a specific poster file."""
    try:
        poster_path = POSTERS_DIR / filename
        
        if not poster_path.exists():
            return jsonify({
                "success": False,
                "error": "Poster not found"
            }), 404
        
        if request.method == "DELETE":
            user_id, token, auth_error = _require_auth()
            if auth_error:
                return jsonify(auth_error[0]), auth_error[1]

            quoted_name = urllib.parse.quote(filename, safe="")
            status, rows = _supabase_rest_request(
                "/posters",
                "GET",
                token,
                query=f"?select=id,image_path&image_path=eq.{quoted_name}&limit=1",
            )
            if status >= 400:
                return jsonify({
                    "success": False,
                    "error": "Failed to check poster ownership"
                }), 500

            if not rows:
                return jsonify({
                    "success": False,
                    "error": "Poster not found"
                }), 404

            poster_id = rows[0].get("id")
            if not poster_id:
                return jsonify({
                    "success": False,
                    "error": "Poster id is missing"
                }), 500

            del_status, del_rows = _supabase_rest_request(
                "/posters",
                "DELETE",
                token,
                query=f"?id=eq.{poster_id}&select=id",
                prefer="return=representation",
            )
            if del_status >= 400:
                return jsonify({
                    "success": False,
                    "error": "Failed to delete poster record"
                }), 500

            if not del_rows:
                return jsonify({
                    "success": False,
                    "error": "Poster not found"
                }), 404

            # Delete the poster file and its metadata
            if poster_path.exists():
                poster_path.unlink()
            return jsonify({
                "success": True,
                "message": f"Poster {filename} deleted successfully"
            })
        
        # GET request - return the file
        return send_file(
            poster_path,
            mimetype="image/png",
            as_attachment=False,
            download_name=filename
        )
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/posters/bulk-delete", methods=["POST"])
def bulk_delete_posters():
    """Delete multiple posters at once."""
    try:
        user_id, token, auth_error = _require_auth()
        if auth_error:
            return jsonify(auth_error[0]), auth_error[1]

        data = request.get_json()
        filenames = data.get("filenames", [])
        
        if not filenames:
            return jsonify({
                "success": False,
                "error": "No filenames provided"
            }), 400
        
        deleted = []
        errors = []
        
        for filename in filenames:
            try:
                poster_path = POSTERS_DIR / filename
                quoted_name = urllib.parse.quote(filename, safe="")
                status, rows = _supabase_rest_request(
                    "/posters",
                    "GET",
                    token,
                    query=f"?select=id,image_path&image_path=eq.{quoted_name}&limit=1",
                )
                if status >= 400:
                    errors.append(f"{filename}: failed ownership check")
                    continue

                if not rows:
                    errors.append(f"{filename}: not found")
                    continue

                poster_id = rows[0].get("id")
                if not poster_id:
                    errors.append(f"{filename}: missing id")
                    continue

                del_status, del_rows = _supabase_rest_request(
                    "/posters",
                    "DELETE",
                    token,
                    query=f"?id=eq.{poster_id}&select=id",
                    prefer="return=representation",
                )
                if del_status >= 400 or not del_rows:
                    errors.append(f"{filename}: failed to delete")
                    continue

                if poster_path.exists():
                    poster_path.unlink()
                deleted.append(filename)
            except Exception as e:
                errors.append(f"{filename}: {str(e)}")
        
        return jsonify({
            "success": True,
            "deleted": deleted,
            "errors": errors,
            "deleted_count": len(deleted)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/generate", methods=["POST"])
def generate_map():
    """Generate a new map poster."""
    try:
        user_id, token, auth_error = _require_auth()
        if auth_error:
            return jsonify(auth_error[0]), auth_error[1]

        data = request.get_json()
        
        # Validate required fields
        if not data.get("city"):
            return jsonify({
                "success": False,
                "error": "City is required"
            }), 400
        
        if not data.get("theme"):
            return jsonify({
                "success": False,
                "error": "Theme is required"
            }), 400
        
        # Extract parameters
        city = data["city"]
        country = data.get("country", "")
        theme = data["theme"]
        latitude = data.get("latitude")
        longitude = data.get("longitude")
        distance = data.get("distance", 15000)  # Balanced distance for good context and performance
        width = data.get("width", 12)
        height = data.get("height", 16)
        dpi = data.get("dpi", 150)
        layers = data.get("layers", ["roads", "water"])  # Removed parks layer for faster generation
        road_thickness = data.get("road_thickness", 1.0)
        custom_label = data.get("custom_label", "")
        font_family = data.get("font_family", "")
        
        # Build command
        script_path = BASE_DIR / "create_map_poster.py"
        python_path = sys.executable
        
        cmd = [
            python_path,
            str(script_path),
            "--city", city,
            "--theme", theme,
            "--distance", str(distance),
            "--width", str(width),
            "--height", str(height),
            "--dpi", str(dpi),
            "--layers", ",".join(layers) if isinstance(layers, list) else str(layers),
            "--road-thickness", str(road_thickness),
        ]
        
        if country:
            cmd.extend(["--country", country])
        
        if latitude and longitude:
            cmd.extend(["--latitude", str(latitude), "--longitude", str(longitude)])

        if custom_label:
            cmd.extend(["--custom-label", custom_label])

        if font_family:
            cmd.extend(["--font-family", font_family])
        
        # Execute map generation
        print(f"Executing: {' '.join(cmd)}")
        
        # Snapshot existing posters before generation
        posters_before = set(p.name for p in POSTERS_DIR.glob("*.png"))
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd=str(BASE_DIR),
            encoding='utf-8',
            errors='replace'
        )
        
        # Log the output for debugging
        if result.stdout:
            print("STDOUT:", result.stdout)
        if result.stderr:
            print("STDERR:", result.stderr)
        
        if result.returncode != 0:
            error_msg = result.stderr or result.stdout or "Unknown error occurred during map generation"
            print(f"Map generation failed with return code {result.returncode}: {error_msg}")
            return jsonify({
                "success": False,
                "error": f"Map generation failed: {error_msg[:500]}"  # Limit error message length
            }), 500
        
        # Find the generated poster — diff with pre-generation snapshot
        posters_after_files = set(p.name for p in POSTERS_DIR.glob("*.png"))
        new_files = posters_after_files - posters_before
        
        # If diff is empty, the file may have existed already; fall back to latest by mtime
        if new_files:
            new_filename = next(iter(new_files))
        else:
            all_pngs = sorted(POSTERS_DIR.glob("*.png"), key=lambda p: p.stat().st_mtime, reverse=True)
            new_filename = all_pngs[0].name if all_pngs else None
        
        if new_filename:
            poster_path = POSTERS_DIR / new_filename
            stat = poster_path.stat()

            ins_status, inserted = _supabase_rest_request(
                "/posters",
                "POST",
                token,
                query="?select=id,created_at",
                body={
                    "user_id": user_id,
                    "city": city,
                    "country": country,
                    "latitude": latitude,
                    "longitude": longitude,
                    "theme": theme,
                    "image_path": new_filename,
                },
                prefer="return=representation",
            )
            if ins_status >= 400:
                print(f"Supabase poster insert failed: status={ins_status}, response={inserted}")
                setup_hint = None
                if isinstance(inserted, dict):
                    code = str(inserted.get("code", ""))
                    message = str(inserted.get("message", ""))
                    details = str(inserted.get("details", ""))
                    combined = f"{message} {details}".lower()
                    if code == "42P01" or "relation" in combined or "does not exist" in combined:
                        setup_hint = "Supabase tables are not initialized. Run supabase/schema.sql in your Supabase SQL editor."
                return jsonify({
                    "success": False,
                    "error": "Generated file but failed to persist poster metadata in Supabase",
                    "status": ins_status,
                    "details": inserted,
                    "hint": setup_hint,
                }), 500

            if not inserted:
                print("Supabase poster insert succeeded but returned no representation")

            poster_row = inserted[0] if isinstance(inserted, list) and inserted else {}
            latest_poster = {
                "id": poster_row.get("id"),
                "city": city,
                "theme": theme,
                "filename": new_filename,
                "url": f"/api/posters/{new_filename}",
                "timestamp": int(stat.st_mtime * 1000),
                "size": stat.st_size
            }
        else:
            latest_poster = None
        
        return jsonify({
            "success": True,
            "message": f"Map generated successfully for {city}",
            "poster": latest_poster
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error": "Map generation timed out (exceeded 5 minutes). Try disabling buildings layer or reducing distance."
        }), 504
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/api/cities/search", methods=["GET"])
def search_cities():
    """Search for cities using Nominatim geocoding service."""
    query = request.args.get("q", "").strip()
    
    if not query:
        return jsonify({
            "success": True,
            "cities": [],
            "count": 0
        })
    
    try:
        import urllib.request
        import urllib.parse
        
        # Use Nominatim API (OpenStreetMap's geocoding service)
        base_url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": query,
            "format": "json",
            "limit": 10,
            "addressdetails": 1,
            "featuretype": "city"
        }
        
        url = f"{base_url}?{urllib.parse.urlencode(params)}"
        
        # Add required User-Agent header
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "MAPOSTER/1.0 (https://github.com/yourusername/maposter)"
            }
        )
        
        with urllib.request.urlopen(req, timeout=5) as response:
            results = json.loads(response.read().decode("utf-8"))
        
        # Parse and format results
        cities = []
        seen = set()  # Avoid duplicates
        
        for idx, result in enumerate(results):
            # Extract city name and country
            address = result.get("address", {})
            
            # Try to get city name from various fields
            city_name = (
                address.get("city") or
                address.get("town") or
                address.get("village") or
                address.get("municipality") or
                result.get("name")
            )
            
            country = address.get("country", "")
            
            if not city_name:
                continue
            
            # Create unique key to avoid duplicates
            key = f"{city_name.lower()}_{country.lower()}"
            if key in seen:
                continue
            seen.add(key)
            
            cities.append({
                "id": str(idx + 1),
                "name": city_name,
                "country": country,
                "latitude": float(result["lat"]),
                "longitude": float(result["lon"]),
                "display_name": result.get("display_name", "")
            })
        
        return jsonify({
            "success": True,
            "cities": cities[:10],  # Limit to 10 results
            "count": len(cities)
        })
        
    except Exception as e:
        print(f"Error searching cities: {e}")
        return jsonify({
            "success": False,
            "error": f"Failed to search cities: {str(e)}"
        }), 500


if __name__ == "__main__":
    print("=" * 60)
    print("MAPOSTER Backend API")
    print("=" * 60)
    print(f"Base Directory: {BASE_DIR}")
    print(f"Themes Directory: {THEMES_DIR}")
    print(f"Posters Directory: {POSTERS_DIR}")
    print(f"Available Themes: {len(load_themes())}")
    print("Generated Posters: requires authenticated user context")
    print(f"Supabase Auth Configured: {bool(SUPABASE_URL and SUPABASE_ANON_KEY)}")
    print("=" * 60)
    print("\nStarting Flask server on http://localhost:5000")
    print("API Endpoints:")
    print("  GET  /api/health           - Health check")
    print("  GET  /api/themes           - List themes")
    print("  GET  /api/posters          - List posters")
    print("  GET  /api/posters/<file>   - Download poster")
    print("  POST /api/generate         - Generate map")
    print("  GET  /api/cities/search    - Search cities")
    print("=" * 60)
    
    app.run(debug=True, host="0.0.0.0", port=5000)
