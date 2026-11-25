import json
import sqlite3
import urllib.request
import urllib.error
import re
from datetime import datetime
from backend.database import get_db

# Curated repository of newly published/discoverable challenges from Smart India Hackathon,
# AICTE, and National Innovation portals ready for live fetching/syncing
DISCOVERABLE_CHALLENGES = [
    {
        "id": "sih-2041",
        "code": "SIH2041",
        "title": "Autonomous Acoustic Sensor Node for Railway Track Fracture and Rail Flaw Detection",
        "organization": "Ministry of Railways (RDSO)",
        "domain": "Smart Mobility & Transport",
        "category": "Both",
        "affected_group": "Train passengers, loco-pilots, and railway track maintenance gangmen",
        "summary": "Develop a ruggedized solar/vibration-energy harvesting sensor node clamped to rail joints that detects ultrasonic stress waves and micro-fractures in rail tracks before train passage.",
        "context": "Rail fractures caused by thermal contraction during extreme winter and summer derail several trains annually in India. Current track inspection trolleys operate on fixed schedules and cannot detect sudden fractures.",
        "constraints": "Zero external power wiring. Must harvest energy from train vibration or ambient solar. Must transmit critical fracture alert to the nearest station master within 10 seconds over GSM/Sub-GHz.",
        "required_skills": ["Signal Processing", "Piezoelectric Vibration Harvesting", "ESP32 / LoRa", "Python", "Dashboard UI"],
        "difficulty": "Advanced",
        "evidence_strength": "High",
        "builders_rating": 8.7,
        "feasibility_notes": "High impact for railway tracks. Students can demonstrate with a 1-meter steel rail sample, small piezoelectric sensor, and LED fracture indicator.",
        "sources": [
            {
                "name": "Smart India Hackathon Portal (Railway Track Safety Reference)",
                "url": "https://sih.gov.in",
                "checked_date": "2026-11-25"
            }
        ],
        "checked_date": "2026-11-25",
        "status": "Active",
        "hints": "Differentiate between normal train wheel clatter frequencies (10Hz - 2kHz) versus high-frequency acoustic emissions (>20kHz) caused by crystal micro-shearing in steel.",
        "previous_prototypes": [
            {
                "team_name": "Typical Student Prototype Pitfall",
                "year": "2023",
                "prototype_summary": "Mounted an optical camera on train engine.",
                "shortcoming": "Could not see internal rail hair-line fractures covered by dust or at night."
            }
        ],
        "sample_solution_direction": "Ultrasonic guided-wave transducer attached to rail web + threshold envelope detector triggering Sub-1GHz RF packet."
    },
    {
        "id": "sih-2055",
        "code": "SIH2055",
        "title": "Decentralized Carbon Credit Ledger and Verification for Rooftop Solar & Agro-Biomass Adopters",
        "organization": "Bureau of Energy Efficiency (BEE) & Ministry of Power",
        "domain": "Renewable Energy",
        "category": "Software",
        "affected_group": "Smallholder farmers converting crop stubble to biochar, and residential rooftop solar producers",
        "summary": "A transparent micro-carbon tokenization engine that automatically converts verified inverter energy generation and biochar production telemetry into tradable carbon offsets for corporate buyers.",
        "context": "Small farmers burning rice straw lack financial incentives to convert straw to biochar because traditional carbon auditing costs exceed the credit value by 80%.",
        "constraints": "Automated verification through IoT inverter logs and satellite NDVI ground truth. Low-gas or zero-fee blockchain state channel.",
        "required_skills": ["Web3 / Solidity", "Python", "FastAPI", "React", "Satellite Imagery / Sentinel-2"],
        "difficulty": "Intermediate",
        "evidence_strength": "High",
        "builders_rating": 9.0,
        "feasibility_notes": "Perfect for student teams combining green energy with modern software. Can ingest free Sentinel-2 multispectral imagery from Copernicus Open Access Hub.",
        "sources": [
            {
                "name": "BEE Carbon Credit Trading Scheme Framework",
                "url": "https://beeindia.gov.in",
                "checked_date": "2026-11-25"
            }
        ],
        "checked_date": "2026-11-25",
        "status": "Active",
        "hints": "Judges love automated auditing: if the inverter logs 100 kWh delivered to the grid, the smart contract mints 0.08 verified carbon tokens without manual paper audits.",
        "previous_prototypes": [
            {
                "team_name": "Typical Student Prototype Pitfall",
                "year": "2024",
                "prototype_summary": "Manual upload of PDF solar electricity bills for verification.",
                "shortcoming": "High human verification bottleneck and vulnerable to fake photoshopped PDF bills."
            }
        ],
        "sample_solution_direction": "Cryptographic inverter telemetry verification via MQTT + ERC-20 / ERC-1155 micro-credit issuance on Polygon or Arbitrum."
    },
    {
        "id": "sih-2080",
        "code": "SIH2080",
        "title": "AI Disaster Damage Assessment and Priority Evacuation Routing using Drone Video and Crowdsourced SOS",
        "organization": "National Disaster Management Authority (NDMA)",
        "domain": "Disaster Management",
        "category": "Software",
        "affected_group": "Flood-stranded citizens, rescue boats (NDRF/SDRF), and emergency relief coordinators",
        "summary": "Real-time flood water depth estimation and road passability classifier combining drone aerial video streams with geolocated citizen SOS messages to calculate safe rescue boat routing.",
        "context": "During Chennai and Kerala floods, rescue boats frequently get stranded or damage propellers on submerged vehicles and debris due to lack of real-time bathymetric hazard mapping.",
        "constraints": "Must operate when local cellular towers are submerged using ad-hoc Wi-Fi/Bluetooth mesh or satellite uplinks. Sub-second map rendering.",
        "required_skills": ["OpenCV", "YOLOv8", "Graph Algorithms (Dijkstra/A*)", "Leaflet/Mapbox", "Flutter"],
        "difficulty": "Intermediate",
        "evidence_strength": "High",
        "builders_rating": 9.2,
        "feasibility_notes": "Very compelling demo for student hackathons. Can simulate flood polygon maps with interactive safe routing between relief camps.",
        "sources": [
            {
                "name": "NDMA Standard Operating Procedure for Flood Management",
                "url": "https://ndma.gov.in",
                "checked_date": "2026-11-10"
            }
        ],
        "checked_date": "2026-11-23",
        "status": "Active",
        "hints": "Feature a dynamic graph router that dynamically marks road edges as impassable when water depth exceeds 0.5m based on video segmentation.",
        "previous_prototypes": [
            {
                "team_name": "Typical Student Prototype Pitfall",
                "year": "2023",
                "prototype_summary": "Static map showing pin drops of user locations.",
                "shortcoming": "Did not check whether the route between rescuer and stranded citizen was flooded or blocked by submerged electrical transformers."
            }
        ],
        "sample_solution_direction": "Semantic segmentation of water surfaces from aerial drone frames + cost-weighted Dijkstra navigation on OpenStreetMap road vectors."
    }
]

def fetch_and_ingest_problems(source_name="Curated Sample Catalog", custom_url=None):
    """
    Loads challenges from a user-provided JSON feed URL (if valid and reachable)
    or falls back to the local curated catalog (DISCOVERABLE_CHALLENGES).
    Checks for duplicates and persists new records to SQLite.
    """
    conn = get_db()
    cursor = conn.cursor()

    clean_url = (custom_url or "").strip()
    url = clean_url if clean_url else "local://curated-discoverable-catalog"
    fetched_count = 0
    new_count = 0
    new_problems = []
    remote_error = None
    used_remote = False

    # If user provided a custom JSON feed URL, attempt a bounded remote fetch
    remote_data = None
    if clean_url:
        if clean_url.startswith("http://") or clean_url.startswith("https://"):
            try:
                req = urllib.request.Request(
                    clean_url,
                    headers={'User-Agent': 'BuildersFrame-Harvester/1.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    raw_bytes = response.read(512 * 1024)
                    content = raw_bytes.decode('utf-8')
                    parsed = json.loads(content)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        remote_data = parsed
                        used_remote = True
                    else:
                        remote_error = "Remote JSON was empty or not a list; used local curated catalog instead."
            except Exception as e:
                remote_error = f"Remote feed unreachable ({str(e)[:80]}); loaded local curated catalog instead."
        else:
            remote_error = "Invalid URL scheme (must be http:// or https://); loaded local curated catalog instead."

    pool = remote_data if used_remote else DISCOVERABLE_CHALLENGES
    effective_source = source_name if used_remote else f"{source_name} (Curated Local Catalog)"
    fetched_count = len(pool)

    for item in pool:
        if not isinstance(item, dict):
            continue
        code = (item.get("code") or "").strip()
        title = (item.get("title") or "").strip()
        if not title:
            continue

        # Check if code or title already exists
        cursor.execute("SELECT id FROM problems WHERE code = ? OR title = ?", (code, title))
        existing = cursor.fetchone()

        if not existing:
            new_id = item.get("id", f"sih-{code.lower() if code else 'new'}")
            cursor.execute('''
            INSERT INTO problems (
                id, code, title, organization, domain, category,
                affected_group, summary, context, constraints,
                required_skills, difficulty, evidence_strength,
                builders_rating, feasibility_notes, sources,
                checked_date, status, hints, previous_prototypes,
                sample_solution_direction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                new_id,
                code or new_id.upper(),
                title,
                item.get("organization", "Central Ministry"),
                item.get("domain", "General Innovation"),
                item.get("category", "Software"),
                item.get("affected_group", "Public citizens & students"),
                item.get("summary", ""),
                item.get("context", ""),
                item.get("constraints", ""),
                json.dumps(item.get("required_skills", [])),
                item.get("difficulty", "Intermediate"),
                item.get("evidence_strength", "High"),
                item.get("builders_rating", 8.8),
                item.get("feasibility_notes", ""),
                json.dumps(item.get("sources", [{"name": effective_source, "url": url, "checked_date": datetime.now().strftime("%Y-%m-%d")}])),
                datetime.now().strftime("%Y-%m-%d"),
                item.get("status", "Active"),
                item.get("hints", ""),
                json.dumps(item.get("previous_prototypes", [])),
                item.get("sample_solution_direction", "")
            ))
            new_count += 1
            new_problems.append({
                "code": code or new_id.upper(),
                "title": title,
                "domain": item.get("domain"),
                "difficulty": item.get("difficulty")
            })

    log_status = "Partial" if remote_error else "Success"
    base_msg = f"Checked {fetched_count} catalog entries. Added {new_count} new items, skipped {fetched_count - new_count} existing duplicates."
    full_msg = f"{remote_error} {base_msg}" if remote_error else base_msg

    # Log the fetch operation
    cursor.execute('''
    INSERT INTO fetch_logs (source_name, source_url, fetched_count, new_count, status, message)
    VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        effective_source,
        url,
        fetched_count,
        new_count,
        log_status,
        full_msg
    ))

    conn.commit()
    conn.close()

    return {
        "status": "success",
        "source_name": effective_source,
        "source_url": url,
        "used_remote": used_remote,
        "notice": remote_error,
        "fetched_count": fetched_count,
        "new_count": new_count,
        "new_problems": new_problems,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
