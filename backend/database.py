import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'buildersframe.db')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Problems Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS problems (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE,
        title TEXT NOT NULL,
        organization TEXT NOT NULL,
        domain TEXT NOT NULL,
        category TEXT NOT NULL,
        affected_group TEXT NOT NULL,
        summary TEXT NOT NULL,
        context TEXT NOT NULL,
        constraints TEXT,
        required_skills TEXT, -- JSON array
        difficulty TEXT NOT NULL, -- Beginner, Intermediate, Advanced
        evidence_strength TEXT NOT NULL, -- High, Medium, Emerging
        builders_rating REAL DEFAULT 8.0,
        feasibility_notes TEXT,
        sources TEXT, -- JSON array
        checked_date TEXT NOT NULL,
        status TEXT NOT NULL, -- Active, Upcoming, Historical
        hints TEXT,
        previous_prototypes TEXT, -- JSON array
        sample_solution_direction TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Hackathons Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hackathons (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        organizer TEXT NOT NULL,
        location TEXT NOT NULL,
        city TEXT,
        state TEXT,
        country TEXT DEFAULT 'India',
        region TEXT NOT NULL, -- Tamil Nadu, South India, National, Global, Online
        format TEXT NOT NULL, -- In-person, Online, Hybrid
        dates TEXT NOT NULL,
        registration_deadline TEXT NOT NULL,
        status TEXT NOT NULL, -- Ongoing, Upcoming, Closed
        badge TEXT,
        eligibility TEXT,
        team_size TEXT,
        prize_pool TEXT,
        themes TEXT, -- JSON array
        judging_criteria TEXT, -- JSON array
        official_url TEXT NOT NULL,
        fallback_url TEXT,
        verification_status TEXT DEFAULT 'Verified Official Portal',
        checked_date TEXT NOT NULL,
        description TEXT,
        matched_problem_ids TEXT, -- JSON array
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # User Stack Table (Personalized lifecycle tracker: Exploring, Validating, Building, Accomplished)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS user_stacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        problem_id TEXT NOT NULL,
        stage TEXT NOT NULL, -- exploring, validating, building, accomplished
        notes TEXT,
        tags TEXT, -- JSON array
        target_hackathon_id TEXT,
        checklist TEXT, -- JSON object {evidence_checked: bool, affected_group_defined: bool, scope_36h_verified: bool, repo_created: bool}
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, problem_id)
    )
    ''')

    # Community Messages Table (Problem statement specific discussion group / room)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS community_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_college TEXT,
        author_level TEXT DEFAULT 'Intermediate', -- Beginner, Intermediate, Advanced
        message_type TEXT DEFAULT 'discussion', -- question, solution_hint, resource, verification
        content TEXT NOT NULL,
        upvotes INTEGER DEFAULT 0,
        is_verified_hint INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Collaboration Posts Table (Find teammates / form hackathon team)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS collaboration_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_id TEXT,
        problem_title TEXT,
        hackathon_id TEXT,
        hackathon_name TEXT,
        team_name TEXT NOT NULL,
        lead_name TEXT NOT NULL,
        lead_college TEXT NOT NULL,
        lead_level TEXT NOT NULL, -- Beginner, Intermediate, Advanced
        looking_for_skills TEXT NOT NULL, -- JSON array
        current_members INTEGER DEFAULT 1,
        max_members INTEGER DEFAULT 6,
        description TEXT NOT NULL,
        contact_handle TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Live Fetch Logs Table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS fetch_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        fetched_count INTEGER DEFAULT 0,
        new_count INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        message TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    conn.commit()

    # Seed problems if empty
    cursor.execute('SELECT COUNT(*) as count FROM problems')
    if cursor.fetchone()['count'] == 0:
        seed_problems_path = os.path.join(DATA_DIR, 'seed_problems.json')
        if os.path.exists(seed_problems_path):
            with open(seed_problems_path, 'r', encoding='utf-8') as f:
                problems = json.load(f)
                for p in problems:
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
                        p['id'],
                        p['code'],
                        p['title'],
                        p['organization'],
                        p['domain'],
                        p['category'],
                        p['affected_group'],
                        p['summary'],
                        p['context'],
                        p.get('constraints', ''),
                        json.dumps(p.get('required_skills', [])),
                        p['difficulty'],
                        p['evidence_strength'],
                        p.get('builders_rating', 8.5),
                        p.get('feasibility_notes', ''),
                        json.dumps(p.get('sources', [])),
                        p['checked_date'],
                        p['status'],
                        p.get('hints', ''),
                        json.dumps(p.get('previous_prototypes', [])),
                        p.get('sample_solution_direction', '')
                    ))
            conn.commit()
            print("Seeded problems successfully.")

    # Seed hackathons if empty
    cursor.execute('SELECT COUNT(*) as count FROM hackathons')
    if cursor.fetchone()['count'] == 0:
        seed_hackathons_path = os.path.join(DATA_DIR, 'seed_hackathons.json')
        if os.path.exists(seed_hackathons_path):
            with open(seed_hackathons_path, 'r', encoding='utf-8') as f:
                hackathons = json.load(f)
                for h in hackathons:
                    cursor.execute('''
                    INSERT INTO hackathons (
                        id, name, organizer, location, city, state, country,
                        region, format, dates, registration_deadline,
                        status, badge, eligibility, team_size, prize_pool,
                        themes, judging_criteria, official_url, checked_date,
                        description, matched_problem_ids
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        h['id'],
                        h['name'],
                        h['organizer'],
                        h['location'],
                        h.get('city', ''),
                        h.get('state', ''),
                        h.get('country', 'India'),
                        h['region'],
                        h['format'],
                        h['dates'],
                        h['registration_deadline'],
                        h['status'],
                        h.get('badge', ''),
                        h.get('eligibility', ''),
                        h.get('team_size', ''),
                        h.get('prize_pool', ''),
                        json.dumps(h.get('themes', [])),
                        json.dumps(h.get('judging_criteria', [])),
                        h['official_url'],
                        h['checked_date'],
                        h.get('description', ''),
                        json.dumps(h.get('matched_problem_ids', []))
                    ))
            conn.commit()
            print("Seeded hackathons successfully.")

    # Seed sample community messages if empty
    cursor.execute('SELECT COUNT(*) as count FROM community_messages')
    if cursor.fetchone()['count'] == 0:
        seed_community = [
            {
                "problem_id": "sih-1601",
                "author_name": "Arun Kumar",
                "author_college": "KPRIET, Coimbatore",
                "author_level": "Intermediate",
                "message_type": "solution_hint",
                "content": "For SIH1601 pest detection, don't use large ResNet models. We benchmarked MobileNetV3 quantized with TFLite on a Snapdragon 680—it inferences in 42ms with 91.4% top-1 accuracy on PlantVillage leaf blights!",
                "upvotes": 14,
                "is_verified_hint": 1
            },
            {
                "problem_id": "sih-1601",
                "author_name": "Pooja Sundaram",
                "author_college": "PSG Tech, Coimbatore",
                "author_level": "Advanced",
                "message_type": "question",
                "content": "How are you dealing with the macro lens attachment requirement? Has anyone 3D printed an optical clip that aligns with multi-camera smartphone modules?",
                "upvotes": 6,
                "is_verified_hint": 0
            },
            {
                "problem_id": "sih-1601",
                "author_name": "Karthik Raja",
                "author_college": "CIT Coimbatore",
                "author_level": "Intermediate",
                "message_type": "resource",
                "content": "Here is an open-source ICAR cotton bollworm dataset with regional Tamil Nadu annotations: https://github.com/icar-agri/pest-samples-tn (contains 4,200 labelled images).",
                "upvotes": 19,
                "is_verified_hint": 1
            },
            {
                "problem_id": "sih-1645",
                "author_name": "Vigneshwaran M",
                "author_college": "Kumaraguru College of Tech",
                "author_level": "Advanced",
                "message_type": "solution_hint",
                "content": "Pro-tip for NHAI Pothole SIH1645: Camera optical flow alone triggers false alarms on painted zebra crossings and wet road reflection shadows. You MUST cross-reference the phone accelerometer Z-axis spike with a 150ms buffer!",
                "upvotes": 22,
                "is_verified_hint": 1
            },
            {
                "problem_id": "sih-1645",
                "author_name": "Divya R",
                "author_college": "Thiagarajar College of Engg, Madurai",
                "author_level": "Intermediate",
                "message_type": "verification",
                "content": "We tested on-device face/number plate blurring using OpenCV Ultra-light Fast Face Detector before saving the telemetry packet. Adds only 18ms overhead.",
                "upvotes": 11,
                "is_verified_hint": 1
            },
            {
                "problem_id": "sih-1710",
                "author_name": "Siddharth N",
                "author_college": "IIT Madras",
                "author_level": "Advanced",
                "message_type": "solution_hint",
                "content": "For vaccine cold chain SIH1710, BLE beacon advertisement payload allows 31 bytes. You can pack Timestamp (4B) + MinTemp (1B) + MaxTemp (1B) + ExcursionCounter (1B) + HMAC-SHA256 digest (16B) in a single non-connectable broadcast!",
                "upvotes": 18,
                "is_verified_hint": 1
            },
            {
                "problem_id": "sih-1912",
                "author_name": "Meera Krishnan",
                "author_college": "Amrita Vishwa Vidyapeetham",
                "author_level": "Beginner",
                "message_type": "discussion",
                "content": "This tribal school STEM app is great for beginner teams. We are building it as an offline PWA with WebAudio API and localized folk tales for math lessons.",
                "upvotes": 9,
                "is_verified_hint": 0
            }
        ]
        for msg in seed_community:
            cursor.execute('''
            INSERT INTO community_messages (
                problem_id, author_name, author_college, author_level,
                message_type, content, upvotes, is_verified_hint
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                msg['problem_id'],
                msg['author_name'],
                msg['author_college'],
                msg['author_level'],
                msg['message_type'],
                msg['content'],
                msg['upvotes'],
                msg['is_verified_hint']
            ))
        conn.commit()

    # Seed sample collaboration posts if empty
    cursor.execute('SELECT COUNT(*) as count FROM collaboration_posts')
    if cursor.fetchone()['count'] == 0:
        seed_collab = [
            {
                "problem_id": "sih-1601",
                "problem_title": "Early Detection & Advisory for Crop Pest Infestations",
                "hackathon_id": "hack-sih-2026",
                "hackathon_name": "Smart India Hackathon 2026",
                "team_name": "AgriPulse Innovators",
                "lead_name": "Deekshith (Team Lead)",
                "lead_college": "KPR Institute of Engineering and Technology",
                "lead_level": "Intermediate",
                "looking_for_skills": json.dumps(["Embedded / ESP32 Hardware", "UI/UX Designer", "Female teammate (Mandatory for SIH rule)"]),
                "current_members": 4,
                "max_members": 6,
                "description": "We have working TFLite pest detection pipeline and Flutter frontend. We are building an optical macro clip prototype and need a passionate hardware/electronics builder and UI teammate for SIH 2026 college round!",
                "contact_handle": "deekshith.project@buildersframe.org"
            },
            {
                "problem_id": "sih-1645",
                "problem_title": "Real-time Detection & Volumetric Pothole Quantification",
                "hackathon_id": "hack-tnsic-2026",
                "hackathon_name": "Tamil Nadu Student Innovators 2026",
                "team_name": "RoadMatrix TN",
                "lead_name": "Kavitha Raman",
                "lead_college": "Government College of Technology, Coimbatore",
                "lead_level": "Intermediate",
                "looking_for_skills": json.dumps(["React Native", "FastAPI / PostGIS Specialist"]),
                "current_members": 2,
                "max_members": 4,
                "description": "Targeting TN State Innovators Challenge. We have the sensor calibration math ready and need a React Native mobile dev and PostGIS backend specialist to visualize the road hazard map.",
                "contact_handle": "kavitha.tnsic@gct.ac.in"
            },
            {
                "problem_id": "sih-1710",
                "problem_title": "Decentralized Cold-Chain Vaccine Verification",
                "hackathon_id": "hack-kpr-innovate-2026",
                "hackathon_name": "KPR National HackFest 2026",
                "team_name": "CryoChain Health",
                "lead_name": "Manojkumar S",
                "lead_college": "KPRIET, Coimbatore",
                "lead_level": "Advanced",
                "looking_for_skills": json.dumps(["Solidity / Smart Contracts", "BLE Hardware Hacker"]),
                "current_members": 3,
                "max_members": 5,
                "description": "Building tamper-proof cold-chain logger for PHC vaccines. Looking for an enthusiastic Web3 / Cryptography builder to join our KPR HackFest squad.",
                "contact_handle": "manoj.cryo@kpriet.ac.in"
            },
            {
                "problem_id": "sih-1912",
                "problem_title": "Offline Gamified STEM Learning for Tribal Schools",
                "hackathon_id": "hack-google-solution-2027",
                "hackathon_name": "Google Solution Challenge 2027",
                "team_name": "TribalTech Scholars",
                "lead_name": "Ananya Sharma",
                "lead_college": "Coimbatore Institute of Engineering & Tech",
                "lead_level": "Beginner",
                "looking_for_skills": json.dumps(["HTML5 Game / Phaser", "Illustration / Visual Art", "Fullstack Web"]),
                "current_members": 2,
                "max_members": 4,
                "description": "Beginner-friendly team targeting UN SDG #4 Quality Education. Welcoming 1st and 2nd year students who want to build high-impact social prototypes!",
                "contact_handle": "ananya.stem@buildersframe.org"
            }
        ]
        for col in seed_collab:
            cursor.execute('''
            INSERT INTO collaboration_posts (
                problem_id, problem_title, hackathon_id, hackathon_name,
                team_name, lead_name, lead_college, lead_level,
                looking_for_skills, current_members, max_members,
                description, contact_handle
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                col['problem_id'],
                col['problem_title'],
                col['hackathon_id'],
                col['hackathon_name'],
                col['team_name'],
                col['lead_name'],
                col['lead_college'],
                col['lead_level'],
                col['looking_for_skills'],
                col['current_members'],
                col['max_members'],
                col['description'],
                col['contact_handle']
            ))
        conn.commit()

    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized successfully at", DB_PATH)
