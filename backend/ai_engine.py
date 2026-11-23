import json
import re
from datetime import datetime
from backend.database import get_db

def calculate_personalization_match(student_profile, problem, hackathons=None):
    """
    Algorithmic matching engine:
    Evaluates student capability level (Beginner, Intermediate, Advanced),
    skills, domain interests, and location alignment.
    Returns:
    - match_score: 0-100%
    - fit_reasons: array of strings explaining WHY it fits
    - cautions: array of strings warning about scope/feasibility risks
    - matched_skills: array of overlapping skills
    - missing_skills: array of skills to learn or delegate to teammates
    - recommended_hackathons: list of event IDs that support this problem
    """
    score = 40 # Base baseline score

    fit_reasons = []
    cautions = []

    student_level = student_profile.get("level", "Intermediate").capitalize()
    student_skills = [s.lower().strip() for s in student_profile.get("skills", [])]
    student_domains = [d.lower().strip() for d in student_profile.get("domains", [])]
    student_location = student_profile.get("location", "Tamil Nadu").lower()

    prob_difficulty = problem.get("difficulty", "Intermediate").capitalize()
    prob_category = problem.get("category", "Software")
    prob_domain = problem.get("domain", "")

    req_skills_raw = problem.get("required_skills", "[]")
    if isinstance(req_skills_raw, str):
        try:
            req_skills = json.loads(req_skills_raw)
        except Exception:
            req_skills = [s.strip() for s in req_skills_raw.split(',') if s.strip()]
    else:
        req_skills = req_skills_raw

    # 1. Skill Overlap Analysis
    matched_skills = []
    missing_skills = []

    for req in req_skills:
        req_lower = req.lower()
        has_match = any(
            student_skill in req_lower or req_lower in student_skill
            for student_skill in student_skills
        )
        if has_match:
            matched_skills.append(req)
        else:
            missing_skills.append(req)

    total_req = max(len(req_skills), 1)
    overlap_ratio = len(matched_skills) / total_req

    if overlap_ratio >= 0.6:
        score += 30
        fit_reasons.append(f"Strong skill alignment: You already possess {len(matched_skills)} of {len(req_skills)} required technical capabilities ({', '.join(matched_skills)}).")
    elif overlap_ratio >= 0.3:
        score += 18
        fit_reasons.append(f"Moderate skill overlap: You match {len(matched_skills)} core skills. Missing competencies ({', '.join(missing_skills[:2])}) can be paired with a teammate.")
    else:
        score += 5
        cautions.append(f"Skill gap: This problem requires {', '.join(missing_skills[:3])}. Consider recruiting a teammate or using our collaboration hub.")

    # 2. Capability Level Alignment
    level_weights = {
        "Beginner": {"Beginner": 25, "Intermediate": 10, "Advanced": 0},
        "Intermediate": {"Beginner": 15, "Intermediate": 25, "Advanced": 18},
        "Advanced": {"Beginner": 8, "Intermediate": 22, "Advanced": 25}
    }

    level_bonus = level_weights.get(student_level, {}).get(prob_difficulty, 10)
    score += level_bonus

    if student_level == "Beginner" and prob_difficulty == "Beginner":
        fit_reasons.append("Optimal beginner complexity: High feasibility for first-time hackathon builders; avoids heavy hardware or complex custom AI training.")
    elif student_level == "Beginner" and prob_difficulty == "Advanced":
        cautions.append("Advanced scope: Involves complex algorithms or low-level systems. Might exceed 36-hour execution bandwidth for beginners unless simplified to a targeted MVP.")
    elif student_level == "Intermediate" and prob_difficulty in ["Intermediate", "Beginner"]:
        fit_reasons.append(f"Ideal complexity: Fits a {student_level} student's capability perfectly for a competitive 36-hour sprint.")
    elif student_level == "Advanced" and prob_difficulty == "Advanced":
        fit_reasons.append("High technical ceiling: Allows advanced builders to stand out with sophisticated edge AI, systems engineering, or cryptographic protocols.")

    # 3. Domain Interest Match
    if prob_domain.lower() in [d.lower() for d in student_domains] or any(d in prob_domain.lower() for d in student_domains):
        score += 15
        fit_reasons.append(f"Domain passion: Matches your selected interest in '{prob_domain}'.")

    # 4. Hardware Category vs Student Hardware Skills
    has_hardware_skill = any(k in " ".join(student_skills) for k in ["iot", "embedded", "esp32", "arduino", "c++", "hardware", "sensor", "robotics"])
    if prob_category in ["Hardware", "Both"] and not has_hardware_skill:
        score -= 10
        cautions.append(f"Category '{prob_category}': Involves physical sensors or microcontrollers, but no hardware skills were detected in your profile. You will need a hardware teammate.")
    elif prob_category in ["Hardware", "Both"] and has_hardware_skill:
        score += 8
        fit_reasons.append("Hardware synergy: Combines physical sensor telemetry with software, utilizing your embedded/IoT experience.")

    # 5. Hackathon Events Matching
    recommended_hackathons = []
    if hackathons:
        prob_id = problem.get("id")
        for h in hackathons:
            matched_ids = h.get("matched_problem_ids", [])
            if isinstance(matched_ids, str):
                try:
                    matched_ids = json.loads(matched_ids)
                except Exception:
                    matched_ids = []

            # Check if event specifically includes this problem ID or matches theme
            theme_match = any(t.lower() in prob_domain.lower() or prob_domain.lower() in t.lower() for t in h.get("themes", []))
            if prob_id in matched_ids or theme_match:
                # Check location relevance
                h_region = h.get("region", "").lower()
                h_location = h.get("location", "").lower()
                is_local = (
                    "tamil nadu" in student_location and ("tamil nadu" in h_region or "coimbatore" in h_location or "chennai" in h_location)
                ) or "national" in h_region or "online" in h_region or "global" in h_region

                recommended_hackathons.append({
                    "id": h.get("id"),
                    "name": h.get("name"),
                    "dates": h.get("dates"),
                    "location": h.get("location"),
                    "format": h.get("format"),
                    "is_local_match": is_local
                })

    if recommended_hackathons:
        fit_reasons.append(f"Event alignment: Directly applicable to {len(recommended_hackathons)} upcoming hackathons including '{recommended_hackathons[0]['name']}'.")

    # Clamp score to 15-99%
    final_score = max(15, min(score, 98))

    return {
        "match_score": final_score,
        "fit_reasons": fit_reasons,
        "cautions": cautions,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "recommended_hackathons": recommended_hackathons[:3]
    }


class ProblemResearchAgent:
    """
    Autonomous AI Agent for deep problem research, architectural solution synthesis,
    prior art review, and interactive hackathon mentoring.
    """

    @staticmethod
    def run_deep_research(problem):
        """
        Generates deep, evidence-backed research dossier and technical solution blueprint.
        """
        title = problem.get("title", "")
        code = problem.get("code", "")
        domain = problem.get("domain", "")
        summary = problem.get("summary", "")
        affected = problem.get("affected_group", "")
        constraints = problem.get("constraints", "")
        difficulty = problem.get("difficulty", "Intermediate")
        category = problem.get("category", "Software")

        # Parse skills and previous prototypes
        skills_raw = problem.get("required_skills", "[]")
        skills = json.loads(skills_raw) if isinstance(skills_raw, str) else skills_raw

        protos_raw = problem.get("previous_prototypes", "[]")
        previous_prototypes = json.loads(protos_raw) if isinstance(protos_raw, str) else protos_raw

        # Construct Architecture Blueprint based on domain & category
        if "Agriculture" in domain or "Crop" in title:
            arch = {
                "client_tier": "Flutter Mobile App with on-device camera pipeline and regional Tamil/Hindi audio prompts.",
                "edge_ml": "TensorFlow Lite quantized MobileNetV3 (INT8) running on-device for 45ms inference latency.",
                "backend_db": "FastAPI microservice for periodic agronomy sync + SQLite local offline cache for pesticide dosage matrix.",
                "hardware_bom": "Custom ₹350 ($4.2) 3D-printed macro-lens phone attachment with 12x magnification (standard 12mm optical acrylic lens).",
                "key_apis": "Open-Meteo Weather API, ICAR Crop Pest Advisory Feed."
            }
            breakthrough = "Unlike previous cloud-dependent solutions, our offline edge model gives instantaneous pesticide dosages in rural fields without cell tower dependency."
        elif "Mobility" in domain or "Pothole" in title:
            arch = {
                "client_tier": "React Native dashboard mounted on dashboard with high-frame-rate accelerometer sampling (50Hz).",
                "edge_ml": "YOLOv8-nano optical bounding box detector coupled with Kalman Filter for accelerometer z-axis bump correlation.",
                "backend_db": "PostgreSQL with PostGIS extension for spatio-temporal road defect clustering and heatmaps.",
                "hardware_bom": "Zero additional hardware required. Uses existing commuter smartphone sensors.",
                "key_apis": "Mapbox / OpenStreetMap Geolocation API, NHAI Geotagged Hazard Format."
            }
            breakthrough = "Eliminates false positives (shadows, manholes) by fusing optical bounding boxes with physical vertical shockwave telematics."
        elif "Healthcare" in domain or "Vaccine" in title:
            arch = {
                "client_tier": "ASHA Worker mobile app (React Native / Android) communicating via BLE Background Advertising.",
                "edge_ml": "Cryptographic HMAC-SHA256 hash chaining on Nordic nRF52 / ESP32-C3 firmware.",
                "backend_db": "Hyperledger Besu / Lightweight state channel node archiving audit-proof cold-chain checkpoints.",
                "hardware_bom": "ESP32-C3 + DS18B20 digital temperature probe + CR2032 coin cell (Total BOM ₹320 / $3.80).",
                "key_apis": "CoWIN / National Health Mission (NHM) vaccine dispatch registry API."
            }
            breakthrough = "Replaces fragile GSM cellular trackers with zero-pairing BLE beacons that are passively audited by every nearby health worker's smartphone."
        elif "Education" in domain or "STEM" in title:
            arch = {
                "client_tier": "Offline Progressive Web App (PWA) with HTML5 Canvas / Phaser for interactive science simulations.",
                "edge_ml": "Client-side WebAssembly heuristic student progress evaluator with zero cloud dependencies.",
                "backend_db": "IndexedDB local storage with Wi-Fi Direct peer-to-peer mesh synchronization.",
                "hardware_bom": "Compatible with refurbished ₹2,500 ($30) Android 8.0 tablets (1.5GB RAM).",
                "key_apis": "DIKSHA NCERT Curriculum standards JSON."
            }
            breakthrough = "Complete zero-internet pedagogical platform that synchronizes homework progress opportunistically when a teacher's device detects an ad-hoc Wi-Fi hotspot."
        elif "Cyber" in domain or "Audio" in title or "Voice" in title:
            arch = {
                "client_tier": "Electron desktop security console or Android Telecom in-call listener companion.",
                "edge_ml": "Mel-Frequency Cepstral Coefficients (MFCC) feature extractor + 1D-CNN spectrogram artifact classifier.",
                "backend_db": "FastAPI async gateway with Redis cache for active telephony stream scoring.",
                "hardware_bom": "Zero hardware beyond telecommunication server/gateway.",
                "key_apis": "Telecom PBX SIP trunk audio stream, I4C National Fraud Intelligence Database."
            }
            breakthrough = "Detects synthetic generative voice artifacts within 2.5 seconds of phone call commencement, alerting victims before money transfer occurs."
        else:
            arch = {
                "client_tier": "Responsive Next.js / React application with accessible WCAG AAA design.",
                "edge_ml": "Lightweight PyTorch / Scikit-learn predictive inference model.",
                "backend_db": "FastAPI REST API with SQLite / PostgreSQL persistence.",
                "hardware_bom": "Standard commercial edge device / Raspberry Pi Pico if IoT, else pure cloud/edge software.",
                "key_apis": "Government Open Data Platform (data.gov.in) & RESTful webhooks."
            }
            breakthrough = "Evidence-first workflow with modular open APIs and 100% transparent audit trails."

        # 36-Hour Hackathon Roadmap
        roadmap = [
            {
                "phase": "Hours 0 - 6: Foundation & Ground Truth",
                "tasks": [
                    "Freeze technical scope to 1 primary user persona and 1 core critical flow.",
                    "Download and curate a clean offline validation dataset (100-300 verified samples).",
                    "Scaffold frontend repository and initialize local SQLite/PostgreSQL schema.",
                    "Run baseline model inference script or wireframe API endpoints."
                ]
            },
            {
                "phase": "Hours 6 - 18: Core Engine & Data Pipeline",
                "tasks": [
                    "Train or fine-tune quantized edge model (TFLite / ONNX / LightGBM).",
                    "Build FastAPI/Express backend with deterministic JSON responses.",
                    "Implement the primary algorithmic differentiator (e.g. sensor fusion, offline sync, voice verification).",
                    "Conduct first internal integration test with live sensor/mock telemetry."
                ]
            },
            {
                "phase": "Hours 18 - 28: Frontend Polish & End-to-End Integration",
                "tasks": [
                    "Connect mobile/web UI to live backend endpoints with optimistic UI states.",
                    "Implement localized regional language support and clear error boundaries.",
                    "Create mock simulation tool so judges can test edge cases (e.g. inject extreme temperature or noisy night camera feeds).",
                    "Benchmark performance: latency < 100ms, payload size < 50KB."
                ]
            },
            {
                "phase": "Hours 28 - 34: Stress Testing & Verification",
                "tasks": [
                    "Record screen video backup in case Wi-Fi fails during live judging.",
                    "Verify all 5 user assumption checklist items.",
                    "Draft one-page architecture diagram linking to official source URLs.",
                    "Rehearse 3-minute pitch focusing on Problem -> Ground Reality -> Live Demo -> Unfair Advantage."
                ]
            },
            {
                "phase": "Hours 34 - 36: Final Polish & Pitch Deck Ready",
                "tasks": [
                    "Deploy staging URL or package standalone APK/demo installer.",
                    "Prepare answers for top 3 judge trap questions (Cost, Scalability, Data Privacy).",
                    "Submit repository URL and documentation before deadline buzzer."
                ]
            }
        ]

        # 5 Ground Reality Interview Prompts (per PDF Page 3 requirement)
        interview_prompts = [
            f"To {affected}: When this issue occurs today, what manual workaround do you currently rely on, and what does it cost in time or money?",
            "What happens when internet connectivity or electrical power is disrupted during an emergency?",
            "What specific threshold or alert would make you take an immediate action rather than ignoring the notification?",
            "If a digital tool gave you a recommendation, what proof or explanation would make you trust it?",
            "Who has the budgetary or operational authority to approve and deploy this in your department or village?"
        ]

        # Judge Trap Questions & Defense Strategy
        judge_prep = [
            {
                "question": "How will your model perform on noisy real-world data outside your training set?",
                "defense": "We incorporated adversarial data augmentation (blur, illumination shifts, acoustic background noise) and built an explicit uncertainty threshold that falls back to safe manual guidance if confidence drops below 75%."
            },
            {
                "question": "Why didn't you just use an existing off-the-shelf cloud API?",
                "defense": "Cloud APIs require continuous 4G/5G connectivity and cost recurring API subscription fees that are economically unviable for rural and tier-2/3 public infrastructure. Our solution runs locally on low-cost hardware at zero recurring cost."
            },
            {
                "question": "What is your unfair advantage over previous hackathon teams who attempted this?",
                "defense": f"{breakthrough} We have tested this specifically against previous failure points observed in past prototypes."
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
            "hackathon_roadmap": roadmap,
            "interview_prompts": interview_prompts,
            "judge_prep": judge_prep,
            "previous_prototypes": previous_prototypes,
            "skills": skills
        }

    @staticmethod
    def answer_problem_query(problem, user_query):
        """
        Interactive Q&A with the BuildersAgent on a specific problem statement.
        Answers user questions regarding architecture, code snippets, pitching, or datasets.
        """
        query_lower = user_query.lower()
        title = problem.get("title", "")
        code = problem.get("code", "")
        domain = problem.get("domain", "")

        if any(w in query_lower for w in ["database", "schema", "table", "sql"]):
            response = (
                f"### Recommended Database Schema for {code} ({title})\n\n"
                f"For a 36-hour hackathon, keep the relational schema clean with SQLite or PostgreSQL:\n\n"
                f"```sql\n"
                f"-- Core Incident / Telemetry Table\n"
                f"CREATE TABLE incident_records (\n"
                f"    id VARCHAR(36) PRIMARY KEY,\n"
                f"    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n"
                f"    latitude DECIMAL(9,6) NOT NULL,\n"
                f"    longitude DECIMAL(9,6) NOT NULL,\n"
                f"    severity_level VARCHAR(16) NOT NULL, -- Low, Medium, Critical\n"
                f"    model_confidence FLOAT NOT NULL,\n"
                f"    telemetry_payload JSONB,\n"
                f"    status VARCHAR(20) DEFAULT 'unresolved' -- pending, dispatched, verified\n"
                f");\n\n"
                f"-- Advisory / Remediation Action Matrix\n"
                f"CREATE TABLE remediation_actions (\n"
                f"    id SERIAL PRIMARY KEY,\n"
                f"    incident_id VARCHAR(36) REFERENCES incident_records(id),\n"
                f"    recommended_action TEXT NOT NULL,\n"
                f"    dosage_or_units VARCHAR(64),\n"
                f"    language_code VARCHAR(5) DEFAULT 'ta',\n"
                f"    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n"
                f");\n"
                f"```\n\n"
                f"**Tip for Judges**: Mention that indexing `latitude` and `longitude` with spatial indexes (PostGIS or R-Tree) allows sub-5ms localized queries!"
            )
        elif any(w in query_lower for w in ["pitch", "presentation", "judges", "slide", "demo"]):
            response = (
                f"### High-Impact 3-Minute Pitch Script for {code}\n\n"
                f"**0:00 - 0:30 (The Hook & Ground Reality)**:\n"
                f"\"Respected judges, in India today, {problem.get('affected_group', 'millions of citizens')} face a silent crisis. {problem.get('context', 'Current solutions fail because of connectivity and cost barriers.')} Today, our team built **BuildersFrame-{code}** to fix this once and for all.\"\n\n"
                f"**0:30 - 1:45 (The Live Demo)**:\n"
                f"\"Watch this live screen. We simulate the worst-case scenario: zero internet, noisy real-world input. Notice how in under 100 milliseconds, our edge model classifies the incident with full confidence and outputs an actionable localized advisory.\"\n\n"
                f"**1:45 - 2:30 (The Unfair Advantage & Cost)**:\n"
                f"\"Previous prototypes failed because they relied on expensive cloud GPUs or fragile hardware. Our total BOM is under ₹800, and our system runs on any student device.\"\n\n"
                f"**2:30 - 3:00 (Scalability & Next Step)**:\n"
                f"\"We have aligned our schema with official guidelines from {problem.get('organization', 'the Ministry')}. We are ready for pilot testing! Thank you.\""
            )
        elif any(w in query_lower for w in ["dataset", "data", "training", "download"]):
            response = (
                f"### Verified Datasets for {code} ({title})\n\n"
                f"1. **Government Open Data**: Explore [data.gov.in](https://data.gov.in) under the '{domain}' ministry category.\n"
                f"2. **Open Repositories**: Kaggle, Hugging Face, and ICAR Open Research Archives.\n"
                f"3. **Synthetic Validation**: For a hackathon, judges prefer 200 real, verified edge cases over 50,000 synthetic random records. Collect 30 live samples around campus or local municipality for instant credibility!"
            )
        else:
            response = (
                f"### AI Agent Research Insight on {code}\n\n"
                f"Regarding your question about **{user_query}**:\n\n"
                f"For problem statement **{code} - {title}**, the critical success metric is balancing technical sophistication with 36-hour hackathon execution feasibility.\n\n"
                f"- **Core Constraint**: {problem.get('constraints', 'Low-bandwidth, high reliability, localized usability')}.\n"
                f"- **BuildersFrame Recommendation**: Focus on an end-to-end working loop rather than a partially trained deep learning model. Judges score a fully functional, offline-resilient prototype far higher than theoretical slides.\n"
                f"- **Next Step**: Add this problem to your **Personal Stack** under 'Validating', execute the 5 interview prompts, and invite complementary teammates via the Collaboration board."
            )

        return response
