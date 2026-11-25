import json
import re
from datetime import datetime


SKILL_ALIAS_GROUPS = {
    "ml": {"python", "tensorflow", "pytorch", "ml", "ai", "transformers", "nlp", "lightgbm", "prophet", "tinyml", "edge impulse", "librosa", "torchaudio", "1d-cnn", "acoustic"},
    "vision": {"opencv", "yolo", "yolov8", "yolov11", "mediapipe", "computer vision", "vision"},
    "embedded": {"embedded", "esp32", "arduino", "iot", "sensor", "sensors", "ble", "nrf", "lora", "lorawan", "piezoelectric", "modbus", "ros"},
    "geo": {"postgis", "gis", "leaflet", "mapbox", "sentinel", "satellite"},
    "frontend": {"react", "react native", "flutter", "pwa", "html5", "canvas", "phaser", "ui/ux", "figma", "dashboard", "indexeddb"},
    "backend": {"fastapi", "node", "node.js", "python", "sql", "sqlite", "postgres", "postgresql", "mqtt"},
    "security": {"web3", "cryptography", "solidity", "security", "forensics"},
    "dsp": {"signal processing", "dsp", "fft", "wavelets", "mne-python", "audio processing"},
    "systems": {"c++", "ros", "pcl", "gazebo", "docker"}
}


def _extract_skill_groups(skill_str):
    lower = skill_str.lower().strip()
    groups = set()
    for group_name, keywords in SKILL_ALIAS_GROUPS.items():
        if any(kw in lower for kw in keywords):
            groups.add(group_name)
    return lower, groups


def _parse_json_list(raw):
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else []
        except Exception:
            return [s.strip() for s in raw.split(',') if s.strip()]
    return []


def calculate_personalization_match(student_profile, problem, hackathons=None, user_stack=None):
    """
    Explainable weighted personalization engine:
    Evaluates student capability level, normalized skill tokens & aliases,
    domain affinity, hardware readiness, team size, local hackathon alignment,
    and current saved stack context.
    """
    baseline = 30
    fit_reasons = []
    cautions = []

    student_level = (student_profile.get("level") or "Intermediate").capitalize()
    student_skills_raw = student_profile.get("skills") or []
    student_domains = [d.lower().strip() for d in (student_profile.get("domains") or [])]
    student_location = (student_profile.get("location") or "Tamil Nadu").lower()
    try:
        team_size = int(student_profile.get("team_size") or student_profile.get("teamSize") or 4)
    except (TypeError, ValueError):
        team_size = 4

    prob_difficulty = (problem.get("difficulty") or "Intermediate").capitalize()
    prob_category = problem.get("category") or "Software"
    prob_domain = problem.get("domain") or ""
    prob_id = problem.get("id")

    req_skills = _parse_json_list(problem.get("required_skills", "[]"))
    student_parsed = [_extract_skill_groups(s) for s in student_skills_raw]

    # 1. Normalized Skill Overlap & Alias Analysis (0..32 pts)
    matched_skills = []
    alias_matched_skills = []
    missing_skills = []
    overlap_credit = 0.0

    for req in req_skills:
        req_lower, req_groups = _extract_skill_groups(req)
        direct_hit = any(s_low in req_lower or req_lower in s_low for s_low, _ in student_parsed)
        if direct_hit:
            matched_skills.append(req)
            overlap_credit += 1.0
        else:
            alias_hit = any(bool(req_groups & s_groups) for _, s_groups in student_parsed if req_groups)
            if alias_hit:
                alias_matched_skills.append(req)
                overlap_credit += 0.6
            else:
                missing_skills.append(req)

    total_req = max(len(req_skills), 1)
    overlap_ratio = min(1.0, overlap_credit / total_req)
    skill_pts = round(32 * overlap_ratio)

    covered_list = matched_skills + [f"{s} (adjacent)" for s in alias_matched_skills]
    if overlap_ratio >= 0.6:
        fit_reasons.append(f"Strong technical coverage ({len(matched_skills)} direct, {len(alias_matched_skills)} adjacent of {len(req_skills)} required skills: {', '.join(covered_list[:4])}).")
    elif overlap_ratio >= 0.3:
        fit_reasons.append(f"Partial skill coverage ({', '.join(covered_list[:3])}); missing competencies ({', '.join(missing_skills[:2])}) can be paired via Team Matcher.")
    else:
        cautions.append(f"Notable skill gap: requires {', '.join(missing_skills[:3])}. Recruit a teammate or narrow scope before starting.")

    # 2. Capability Level Alignment (4..20 pts)
    level_weights = {
        "Beginner": {"Beginner": 20, "Intermediate": 10, "Advanced": 4},
        "Intermediate": {"Beginner": 14, "Intermediate": 20, "Advanced": 14},
        "Advanced": {"Beginner": 10, "Intermediate": 17, "Advanced": 20}
    }
    level_pts = level_weights.get(student_level, {}).get(prob_difficulty, 10)

    if student_level == "Beginner" and prob_difficulty == "Beginner":
        fit_reasons.append("Complexity matches a Beginner builder profile with manageable 1-loop MVP scope.")
    elif student_level == "Beginner" and prob_difficulty == "Advanced":
        cautions.append("Advanced technical ceiling: simplify to one verified input-to-output demo loop if tackling as a beginner.")
    elif student_level == prob_difficulty:
        fit_reasons.append(f"Complexity aligns directly with your {student_level} builder profile.")

    # 3. Domain Interest Alignment (0 or 12 pts)
    prob_dom_lower = prob_domain.lower()
    domain_pts = 0
    if any(
        d == prob_dom_lower
        or (d.startswith("smart mobility") and prob_dom_lower.startswith("smart mobility"))
        or (d.startswith("clean") and prob_dom_lower.startswith("clean"))
        or d in prob_dom_lower
        or prob_dom_lower in d
        for d in student_domains if d
    ):
        domain_pts = 12
        fit_reasons.append(f"Matches your selected domain interest in {prob_domain}.")

    # 4. Hardware vs Software Readiness (-8 to +6 pts)
    has_hardware_skill = any(
        k in " ".join(s.lower() for s in student_skills_raw)
        for k in ["iot", "embedded", "esp32", "arduino", "c++", "hardware", "sensor", "robotics", "lora"]
    )
    hardware_pts = 0
    if prob_category in ["Hardware", "Both"]:
        if has_hardware_skill:
            hardware_pts = 6
            fit_reasons.append("Hardware synergy: aligns with your embedded/IoT capability.")
        else:
            hardware_pts = -8
            cautions.append(f"Includes {prob_category} sensors/hardware, while your profile lists software-only skills.")

    # 5. Team Size Feasibility (-6 to +6 pts)
    team_pts = 0
    if team_size <= 1 and (prob_category == "Both" or prob_difficulty == "Advanced"):
        team_pts = -6
        cautions.append("Solo profile warning: multi-disciplinary Hardware+Software or Advanced problems are much easier with 3-6 teammates.")
    elif team_size >= 4 and prob_category in ["Both", "Hardware"]:
        team_pts = 6
        fit_reasons.append(f"Team size ({team_size} members) supports splitting software, hardware, and UI tracks in parallel.")
    elif team_size >= 2:
        team_pts = 2

    # 6. User Stack Synergy (-10 to +4 pts)
    stack_pts = 0
    if user_stack:
        existing_entry = next((s for s in user_stack if s.get("problem_id") == prob_id), None)
        if existing_entry and (existing_entry.get("stage") or "").lower() == "accomplished":
            stack_pts = -10
            cautions.append("Already marked Accomplished in My Stack.")
        elif any(
            (s.get("domain") or "").lower() == prob_dom_lower and (s.get("stage") or "").lower() in ("validating", "building")
            for s in user_stack
        ):
            stack_pts = 4
            fit_reasons.append(f"Complements your active {prob_domain} work in My Stack.")

    # 7. Hackathon Event Proximity (0..6 pts)
    recommended_hackathons = []
    event_pts = 0
    if hackathons:
        loc_tokens = [t.strip() for t in student_location.replace(",", " ").split() if len(t.strip()) > 2]
        for h in hackathons:
            matched_ids = _parse_json_list(h.get("matched_problem_ids", []))
            themes = _parse_json_list(h.get("themes", []))
            theme_match = any(t.lower() in prob_dom_lower or prob_dom_lower in t.lower() for t in themes)
            if prob_id in matched_ids or theme_match:
                h_loc_blob = f"{h.get('location', '')} {h.get('city', '')} {h.get('state', '')} {h.get('region', '')}".lower()
                is_local = any(tok in h_loc_blob for tok in loc_tokens)
                is_broad = (h.get("region") or "") in ("National", "Global", "Online")
                if is_local:
                    event_pts = max(event_pts, 6)
                elif is_broad:
                    event_pts = max(event_pts, 2)
                recommended_hackathons.append({
                    "id": h.get("id"),
                    "name": h.get("name"),
                    "dates": h.get("dates"),
                    "location": h.get("location"),
                    "format": h.get("format"),
                    "is_local_match": bool(is_local)
                })

        recommended_hackathons.sort(key=lambda x: not x["is_local_match"])
        if recommended_hackathons:
            top_evt = recommended_hackathons[0]
            local_tag = " (near your hub)" if top_evt["is_local_match"] else ""
            fit_reasons.append(f"Event alignment: maps to {len(recommended_hackathons)} listed events including '{top_evt['name']}'{local_tag}.")

    raw_total = baseline + skill_pts + level_pts + domain_pts + hardware_pts + team_pts + stack_pts + event_pts
    final_score = max(15, min(raw_total, 98))

    return {
        "match_score": final_score,
        "fit_reasons": fit_reasons,
        "cautions": cautions,
        "matched_skills": matched_skills,
        "alias_matched_skills": alias_matched_skills,
        "missing_skills": missing_skills,
        "recommended_hackathons": recommended_hackathons[:3],
        "score_breakdown": {
            "baseline": baseline,
            "skill_overlap": skill_pts,
            "level_fit": level_pts,
            "domain_fit": domain_pts,
            "hardware_fit": hardware_pts,
            "team_readiness": team_pts,
            "stack_synergy": stack_pts,
            "event_proximity": event_pts,
            "total": final_score
        },
        "scoring_method": "Profile-weighted heuristic (30 base + 32 skill/alias overlap + 20 level + 12 domain + hardware/team/stack/event adjustments)"
    }


class ProblemResearchAgent:
    """
    Profile-aware, template-guided research assistant for problem scoping,
    suggested starter architectures, historical prototype context, and sprint planning.
    Uses deterministic domain templates and user-profile matching (not a live LLM).
    """

    @staticmethod
    def run_deep_research(problem, student_profile=None):
        """
        Generates a profile-tailored, template-guided research dossier and starter plan.
        """
        title = problem.get("title", "")
        code = problem.get("code", "")
        domain = problem.get("domain", "")
        summary = problem.get("summary", "")
        affected = problem.get("affected_group", "")
        constraints = problem.get("constraints", "")
        difficulty = problem.get("difficulty", "Intermediate")
        category = problem.get("category", "Software")

        skills = _parse_json_list(problem.get("required_skills", "[]"))
        previous_prototypes = _parse_json_list(problem.get("previous_prototypes", "[]"))

        profile = student_profile or {}
        user_level = (profile.get("level") or "Intermediate").capitalize()
        user_skills = profile.get("skills") or []
        try:
            team_size = int(profile.get("team_size") or profile.get("teamSize") or 4)
        except (TypeError, ValueError):
            team_size = 4

        # Compute profile-specific overlap for tailored plan notes
        matched_skills = []
        missing_skills = []
        parsed_user_skills = [_extract_skill_groups(s) for s in user_skills]
        for req in skills:
            r_low, r_grp = _extract_skill_groups(req)
            if any(u_low in r_low or r_low in u_low or bool(r_grp & u_grp) for u_low, u_grp in parsed_user_skills):
                matched_skills.append(req)
            else:
                missing_skills.append(req)

        # Construct Architecture Blueprint based on domain & category
        if "Agriculture" in domain or "Crop" in title:
            arch = {
                "client_tier": "Flutter mobile interface with on-device camera capture and regional audio prompts.",
                "edge_ml": "Quantized MobileNetV3 (TFLite INT8) running locally on-device for low-latency classification.",
                "backend_db": "FastAPI sync endpoint + local SQLite lookup matrix for pesticide dosage guidance.",
                "hardware_bom": "Low-cost clip-on macro lens attachment paired with an ordinary student smartphone.",
                "key_apis": "Open-Meteo Weather API, ICAR crop advisory guidelines."
            }
            breakthrough = "Focus on offline on-device inference and acreage-calibrated dosage tables rather than cloud-only image uploads."
        elif "Mobility" in domain or "Pothole" in title or "SLAM" in title:
            arch = {
                "client_tier": "React Native telemetry logger capturing camera frames paired with smartphone IMU readings.",
                "edge_ml": "Lightweight detector (YOLOv8-nano) fused with accelerometer Z-axis spike filtering to curb shadow false positives.",
                "backend_db": "PostgreSQL + PostGIS (or SQLite spatial bounding boxes) for prioritizing road repair segments.",
                "hardware_bom": "Uses standard commuter phone sensors for road telemetry (or Jetson Nano/LiDAR simulation for AGV track).",
                "key_apis": "OpenStreetMap / Leaflet vector tiles."
            }
            breakthrough = "Combine vision bounding boxes with physical inertial/telemetry signals to cut down visual false positives."
        elif "Healthcare" in domain or "Vaccine" in title or "EEG" in title or "Sign" in title:
            arch = {
                "client_tier": "Accessible web or mobile verifier tailored for clinical triage / field health workers.",
                "edge_ml": "Compact on-device signal classifier (TFLite / ONNX / MediaPipe landmarks) keeping latency low without GPU servers.",
                "backend_db": "Lightweight local audit log (SQLite / state checkpoints) syncing when connectivity resumes.",
                "hardware_bom": "ESP32-C3 + digital temperature probe for cold-chain track, or standard webcam/OpenBCI simulation.",
                "key_apis": "Public health/clinical benchmark datasets (PhysioNet, ISLRTC, NHM guidelines)."
            }
            breakthrough = "Prioritize low-latency offline edge verification over continuous cellular connections or heavy cloud calls."
        elif "Education" in domain or "STEM" in title:
            arch = {
                "client_tier": "Offline-first Progressive Web App (PWA) with lightweight interactive Canvas simulations.",
                "edge_ml": "Local heuristic progress tracker with zero cloud runtime dependency.",
                "backend_db": "IndexedDB browser cache with opportunistic batch upload when a teacher connects online.",
                "hardware_bom": "Runs directly on entry-level Android tablets or classroom browsers.",
                "key_apis": "NCERT / DIKSHA syllabus topic outlines."
            }
            breakthrough = "Keep total bundle size tiny and store student progress locally first so lessons never block on network availability."
        elif "Cyber" in domain or "Audio" in title or "Voice" in title:
            arch = {
                "client_tier": "Desktop or web forensic inspector with live audio waveform & spectrogram comparison.",
                "edge_ml": "MFCC / Mel-spectrogram feature extraction feeding a compact 1D-CNN spoofing classifier.",
                "backend_db": "FastAPI streaming inference worker + SQLite alert log.",
                "hardware_bom": "Pure software pipeline using standard microphone / test audio input.",
                "key_apis": "ASVspoof benchmark samples & I4C fraud safety guidelines."
            }
            breakthrough = "Show clear visual spectrogram evidence and latency metrics within the first 2-3 seconds of sample audio."
        else:
            arch = {
                "client_tier": "Responsive web interface with accessible keyboard navigation and clear error states.",
                "edge_ml": "Lightweight PyTorch / Scikit-learn baseline model.",
                "backend_db": "FastAPI or Tornado REST API with SQLite / PostgreSQL persistence.",
                "hardware_bom": "Standard ESP32 / microcontroller node if IoT sensors are needed, else pure software.",
                "key_apis": "Government Open Data Platform (data.gov.in) & open public APIs."
            }
            breakthrough = "Focus on one complete end-to-end verifiable workflow with clear source attribution."

        # Profile-tailored recommendation note
        if user_skills:
            coverage_note = (
                f"Tailored for your {user_level} profile (Team of {team_size}): "
                f"you already cover {', '.join(matched_skills) if matched_skills else 'core general engineering'}. "
                + (f"Plan extra time or recruit teammates for: {', '.join(missing_skills)}." if missing_skills else "Your listed skills cover every stated requirement.")
            )
        else:
            coverage_note = f"Tailored for a {user_level} profile (Team of {team_size}): select your skills in Matchmaker for exact gap notes."

        if team_size <= 1:
            team_split = "Solo build plan: pick 1 narrow input-to-output flow and use mock/replay sensor data rather than building custom hardware + mobile + backend simultaneously."
        elif team_size <= 3:
            team_split = f"Small squad ({team_size} builders): split into (1) Model/Data pipeline, (2) API + UI prototype, and (3) Validation & Demo script."
        else:
            team_split = f"Full squad ({team_size} builders): assign dedicated owners to Core Engine/ML, Frontend UX, Hardware/Data Integration, and Field Validation/Brief."

        roadmap = [
            {
                "phase": "Hours 0 - 6: Scope & Validation Set",
                "tasks": [
                    f"Freeze scope to 1 primary user flow for {affected}.",
                    "Assemble 50-200 clean local test samples before training or tuning models.",
                    f"{team_split}"
                ]
            },
            {
                "phase": "Hours 6 - 18: Core Engine & API",
                "tasks": [
                    f"Build baseline logic using your existing strengths ({', '.join(matched_skills[:3]) if matched_skills else 'selected stack'}).",
                    "Create deterministic API responses and persist sample outputs in SQLite.",
                    "Handle offline/fallback edge cases explicitly."
                ]
            },
            {
                "phase": "Hours 18 - 30: End-to-End UI & Edge Cases",
                "tasks": [
                    "Connect frontend controls cleanly with loading, empty, and error states.",
                    "Add a sample/test input switcher so reviewers can test noisy inputs live.",
                    "Measure actual inference latency and payload footprint."
                ]
            },
            {
                "phase": "Hours 30 - 36: Testing & Brief Export",
                "tasks": [
                    "Run through all 5 user-validation assumptions with realistic edge inputs.",
                    "Record a short local fallback video in case demo hardware/network drops.",
                    "Export your Markdown project brief and align Q&A defense notes."
                ]
            }
        ]

        interview_prompts = [
            f"To {affected}: When this issue occurs today, what manual workaround do you rely on, and what does it cost?",
            "What happens when internet connectivity or electrical power is unavailable during real use?",
            "What specific signal or alert threshold would actually prompt immediate action rather than being ignored?",
            "If a tool displays a recommendation, what evidence or explanation would make you trust it?",
            "Who has operational authority to test or adopt a pilot in your department or community?"
        ]

        judge_prep = [
            {
                "question": "How does your system handle noisy real-world inputs outside clean test data?",
                "defense": "Suggested angle: include explicit confidence thresholds and safe fallback guidance when sensor/camera inputs degrade."
            },
            {
                "question": "Why not rely on a generic cloud API?",
                "defense": "Suggested angle: highlight offline constraints, recurring cost limits, and privacy/latency constraints stated in the brief."
            },
            {
                "question": "What distinguishes your approach from earlier student attempts?",
                "defense": f"Suggested angle: {breakthrough}"
            }
        ]

        return {
            "problem_id": problem.get("id"),
            "problem_code": code,
            "title": title,
            "affected_group": affected,
            "summary": summary,
            "constraints": constraints,
            "architecture_blueprint": arch,
            "breakthrough_advantage": breakthrough,
            "profile_tailoring": {
                "user_level": user_level,
                "team_size": team_size,
                "matched_skills": matched_skills,
                "missing_skills": missing_skills,
                "coverage_note": coverage_note,
                "team_split": team_split
            },
            "hackathon_roadmap": roadmap,
            "interview_prompts": interview_prompts,
            "judge_prep": judge_prep,
            "previous_prototypes": previous_prototypes,
            "skills": skills,
            "assistant_mode": "template-guided"
        }

    @staticmethod
    def answer_problem_query(problem, user_query, student_profile=None):
        """
        Profile-aware template-guided Q&A helper for a specific problem statement.
        """
        query_lower = user_query.lower()
        title = problem.get("title", "")
        code = problem.get("code", "")
        domain = problem.get("domain", "")
        profile = student_profile or {}
        user_level = (profile.get("level") or "Intermediate").capitalize()
        user_skills = profile.get("skills") or []
        try:
            team_size = int(profile.get("team_size") or profile.get("teamSize") or 4)
        except (TypeError, ValueError):
            team_size = 4

        if any(w in query_lower for w in ["database", "schema", "table", "sql"]):
            response = (
                f"### Suggested Database Schema (Starting Point) for {code} ({title})\n\n"
                f"For a {user_level} team of {team_size}, start with a clean SQLite or PostgreSQL schema:\n\n"
                f"```sql\n"
                f"CREATE TABLE incident_records (\n"
                f"    id VARCHAR(36) PRIMARY KEY,\n"
                f"    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n"
                f"    latitude DECIMAL(9,6) NOT NULL,\n"
                f"    longitude DECIMAL(9,6) NOT NULL,\n"
                f"    severity_level VARCHAR(16) NOT NULL,\n"
                f"    model_confidence FLOAT NOT NULL,\n"
                f"    telemetry_payload TEXT,\n"
                f"    status VARCHAR(20) DEFAULT 'unresolved'\n"
                f");\n\n"
                f"CREATE TABLE remediation_actions (\n"
                f"    id INTEGER PRIMARY KEY AUTOINCREMENT,\n"
                f"    incident_id VARCHAR(36) REFERENCES incident_records(id),\n"
                f"    recommended_action TEXT NOT NULL,\n"
                f"    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n"
                f");\n"
                f"```\n\n"
                f"**Suggested starting note**: Index `latitude`/`longitude` (or `status` + `timestamp`) to keep queries fast."
            )
        elif any(w in query_lower for w in ["skill", "team", "role", "stack", "gap", "member"]):
            req_skills = _parse_json_list(problem.get("required_skills", "[]"))
            parsed_user = [_extract_skill_groups(s) for s in user_skills]
            matched = [r for r in req_skills if any(u_low in r.lower() or r.lower() in u_low or bool(_extract_skill_groups(r)[1] & u_grp) for u_low, u_grp in parsed_user)]
            missing = [r for r in req_skills if r not in matched]
            response = (
                f"### Profile-Tailored Skill & Role Plan for {code}\n\n"
                f"- **Your Profile**: {user_level} level, team of {team_size}, listed skills: {', '.join(user_skills) if user_skills else 'None saved yet'}\n"
                f"- **Already Covered**: {', '.join(matched) if matched else 'None directly matched — consider scoping around your primary stack'}\n"
                f"- **Missing / Recruit via Team Matcher**: {', '.join(missing) if missing else 'All core required skills are covered!'}\n\n"
                f"**Suggested Split**: Keep one person focused on the end-to-end working UI loop while others wire data ingestion and validation tests."
            )
        elif any(w in query_lower for w in ["pitch", "presentation", "judges", "slide", "demo"]):
            response = (
                f"### Suggested 3-Minute Pitch Outline for {code}\n\n"
                f"**0:00 - 0:30 (Problem & Affected Group)**:\n"
                f"\"Today, {problem.get('affected_group', 'affected groups')} encounter a concrete bottleneck: {problem.get('context', 'existing tools miss local constraints.')} Here is what our team scoped for {code}.\"\n\n"
                f"**0:30 - 1:45 (Working Demo)**:\n"
                f"\"Walk through one complete flow under realistic constraints (such as offline operation or noisy inputs), showing exact measured latency and outputs.\"\n\n"
                f"**1:45 - 2:30 (Stack Trade-offs & Cost)**:\n"
                f"\"Explain why your {user_level} squad selected this architecture and how it respects the stated cost/hardware bounds.\"\n\n"
                f"**2:30 - 3:00 (Next Validation Step)**:\n"
                f"\"Note what still needs field testing with {problem.get('organization', 'stakeholders')} beyond the prototype.\""
            )
        elif any(w in query_lower for w in ["dataset", "data", "training", "download"]):
            response = (
                f"### Suggested Public Dataset Places to Check for {code} ({title})\n\n"
                f"1. **Government Open Data**: Search [data.gov.in](https://data.gov.in) under '{domain}'.\n"
                f"2. **Public Archives**: Check Kaggle, Hugging Face Datasets, or domain academic sets and verify licensing before use.\n"
                f"3. **Local Test Set**: Gather 30-100 realistic samples under noisy lighting/audio conditions to test failure modes."
            )
        else:
            response = (
                f"### Profile-Aware Research Note for {code} (Template Suggestion)\n\n"
                f"Regarding **{user_query}** for a **{user_level}** profile (team of {team_size}):\n\n"
                f"- **Stated Constraint**: {problem.get('constraints', 'Check the problem dossier constraints before scoping.')}\n"
                f"- **Your Covered Skills**: {', '.join(user_skills[:5]) if user_skills else 'Update your skills in Matchmaker for tighter guidance.'}\n"
                f"- **Suggested Next Step**: Save {code} to **My Stack** under 'Validating', test the 5 field prompts, and check **Team Matcher** for any missing skills.\n\n"
                f"*Note: Generated by BuildersFrame's profile-aware template rules rather than a live LLM.*"
            )

        return response
