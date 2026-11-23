import os
import sys
import json
import sqlite3
import tornado.ioloop
import tornado.web
from datetime import datetime

# Add project root to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.database import get_db, init_db
from backend.ai_engine import calculate_personalization_match, ProblemResearchAgent
from backend.fetcher import fetch_and_ingest_problems

STATIC_DIR = os.path.join(BASE_DIR, 'static')

class BaseHandler(tornado.web.RequestHandler):
    def set_default_headers(self):
        self.set_header("Access-Control-Allow-Origin", "*")
        self.set_header("Access-Control-Allow-Headers", "x-requested-with, content-type, authorization")
        self.set_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE, PUT")

    def options(self, *args, **kwargs):
        self.set_status(204)
        self.finish()

    def get_json_body(self):
        try:
            return json.loads(self.request.body.decode('utf-8'))
        except Exception:
            return {}

    def write_json(self, data, status=200):
        self.set_status(status)
        self.set_header("Content-Type", "application/json")
        self.write(json.dumps(data))


class ProblemsListHandler(BaseHandler):
    def get(self):
        conn = get_db()
        cursor = conn.cursor()

        query = self.get_argument('q', '').strip().lower()
        domain = self.get_argument('domain', '').strip()
        difficulty = self.get_argument('difficulty', '').strip()
        category = self.get_argument('category', '').strip()
        status = self.get_argument('status', '').strip()

        sql = "SELECT * FROM problems WHERE 1=1"
        params = []

        if query:
            sql += " AND (LOWER(title) LIKE ? OR LOWER(code) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(organization) LIKE ? OR LOWER(required_skills) LIKE ?)"
            q_param = f"%{query}%"
            params.extend([q_param, q_param, q_param, q_param, q_param])

        if domain:
            sql += " AND domain = ?"
            params.append(domain)

        if difficulty:
            sql += " AND difficulty = ?"
            params.append(difficulty)

        if category:
            sql += " AND (category = ? OR category = 'Both')"
            params.append(category)

        if status:
            sql += " AND status = ?"
            params.append(status)

        sql += " ORDER BY builders_rating DESC, created_at DESC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            d = dict(r)
            d['required_skills'] = json.loads(d['required_skills']) if d['required_skills'] else []
            d['sources'] = json.loads(d['sources']) if d['sources'] else []
            d['previous_prototypes'] = json.loads(d['previous_prototypes']) if d['previous_prototypes'] else []
            results.append(d)

        conn.close()
        self.write_json({"status": "success", "count": len(results), "problems": results})


class ProblemDetailHandler(BaseHandler):
    def get(self, problem_id):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM problems WHERE id = ? OR code = ?", (problem_id, problem_id))
        row = cursor.fetchone()
        if not row:
            conn.close()
            self.write_json({"status": "error", "message": "Problem not found"}, status=404)
            return

        problem = dict(row)
        problem['required_skills'] = json.loads(problem['required_skills']) if problem['required_skills'] else []
        problem['sources'] = json.loads(problem['sources']) if problem['sources'] else []
        problem['previous_prototypes'] = json.loads(problem['previous_prototypes']) if problem['previous_prototypes'] else []

        # Fetch community message count
        cursor.execute("SELECT COUNT(*) as msg_count FROM community_messages WHERE problem_id = ?", (problem['id'],))
        problem['community_msg_count'] = cursor.fetchone()['msg_count']

        # Fetch active team postings count
        cursor.execute("SELECT COUNT(*) as team_count FROM collaboration_posts WHERE problem_id = ?", (problem['id'],))
        problem['collaboration_count'] = cursor.fetchone()['team_count']

        conn.close()
        self.write_json({"status": "success", "problem": problem})


class ProblemFetchHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        source_name = body.get('source_name', 'Smart India Hackathon Live Portal')
        custom_url = body.get('custom_url', None)

        report = fetch_and_ingest_problems(source_name=source_name, custom_url=custom_url)
        self.write_json(report)


class HackathonsListHandler(BaseHandler):
    def get(self):
        conn = get_db()
        cursor = conn.cursor()

        location = self.get_argument('location', '').strip().lower()
        region = self.get_argument('region', '').strip()
        format_type = self.get_argument('format', '').strip()
        status = self.get_argument('status', '').strip()

        sql = "SELECT * FROM hackathons WHERE 1=1"
        params = []

        if region and region != 'All':
            sql += " AND region = ?"
            params.append(region)

        if format_type:
            sql += " AND format = ?"
            params.append(format_type)

        if status:
            sql += " AND status = ?"
            params.append(status)

        # Smart multi-token location proximity filter
        if location and location != 'all':
            # Extract tokens like 'coimbatore', 'tamil nadu', 'chennai', 'bengaluru'
            tokens = [t.strip() for t in location.replace(',', ' ').split() if len(t.strip()) > 2]
            if tokens:
                token_clauses = []
                for token in tokens:
                    token_clauses.append("(LOWER(location) LIKE ? OR LOWER(city) LIKE ? OR LOWER(state) LIKE ? OR LOWER(region) LIKE ?)")
                    t_param = f"%{token}%"
                    params.extend([t_param, t_param, t_param, t_param])
                # Also include National, Global, Online hackathons as universally accessible
                sql += f" AND ({' OR '.join(token_clauses)} OR region IN ('National', 'Global', 'Online'))"

        sql += " ORDER BY registration_deadline ASC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()

        results = []
        for r in rows:
            d = dict(r)
            d['themes'] = json.loads(d['themes']) if d['themes'] else []
            d['judging_criteria'] = json.loads(d['judging_criteria']) if d['judging_criteria'] else []
            d['matched_problem_ids'] = json.loads(d['matched_problem_ids']) if d['matched_problem_ids'] else []
            results.append(d)

        conn.close()
        self.write_json({"status": "success", "count": len(results), "hackathons": results})

    def post(self):
        body = self.get_json_body()
        name = body.get('name', '').strip()
        organizer = body.get('organizer', '').strip()
        location = body.get('location', '').strip()
        city = body.get('city', '')
        state = body.get('state', '')
        region = body.get('region', 'Tamil Nadu')
        format_type = body.get('format', 'Hybrid')
        dates = body.get('dates', '').strip()
        deadline = body.get('registration_deadline', '').strip()
        official_url = body.get('official_url', '').strip()
        fallback_url = body.get('fallback_url', '')
        prize_pool = body.get('prize_pool', 'Certificate & Awards')
        eligibility = body.get('eligibility', 'College Students')
        description = body.get('description', '')
        themes = body.get('themes', ['Open Innovation'])

        if not name or not organizer or not official_url:
            self.write_json({"status": "error", "message": "Name, organizer, and official URL are required"}, status=400)
            return

        new_id = f"hack-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO hackathons (
            id, name, organizer, location, city, state, country,
            region, format, dates, registration_deadline,
            status, badge, eligibility, team_size, prize_pool,
            themes, judging_criteria, official_url, fallback_url,
            verification_status, checked_date, description, matched_problem_ids
        ) VALUES (?, ?, ?, ?, ?, ?, 'India', ?, ?, ?, ?, 'Upcoming', 'Community Submitted', ?, '2 to 5 members', ?, ?, '[]', ?, ?, 'Community Verified', ?, ?, '[]')
        ''', (
            new_id, name, organizer, location, city, state,
            region, format_type, dates, deadline or datetime.now().strftime('%Y-%m-%dT23:59:59'),
            eligibility, prize_pool, json.dumps(themes),
            official_url, fallback_url, datetime.now().strftime('%Y-%m-%d'), description
        ))
        conn.commit()
        conn.close()

        self.write_json({"status": "success", "message": "Hackathon submitted and published successfully!", "id": new_id})


class HackathonReportHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        hack_id = body.get('hackathon_id')
        issue_type = body.get('issue_type', 'link_broken')
        notes = body.get('notes', '')

        if not hack_id:
            self.write_json({"status": "error", "message": "hackathon_id is required"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()

        if issue_type == 'registration_closed':
            cursor.execute("UPDATE hackathons SET status = 'Closed' WHERE id = ?", (hack_id,))
        else:
            cursor.execute("UPDATE hackathons SET verification_status = 'Under Review by Editors' WHERE id = ?", (hack_id,))

        conn.commit()
        conn.close()

        self.write_json({
            "status": "success",
            "message": "Thank you for reporting. BuildersFrame editorial team has flagged this listing for review."
        })


class PersonalizationMatchHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        student_profile = {
            "level": body.get("level", "Intermediate"),
            "skills": body.get("skills", []),
            "domains": body.get("domains", []),
            "location": body.get("location", "Tamil Nadu"),
            "team_size": body.get("team_size", 4)
        }

        conn = get_db()
        cursor = conn.cursor()

        # Load all problems
        cursor.execute("SELECT * FROM problems WHERE status = 'Active'")
        prob_rows = cursor.fetchall()

        # Load all hackathons
        cursor.execute("SELECT * FROM hackathons")
        hack_rows = cursor.fetchall()
        hackathons = []
        for h in hack_rows:
            hd = dict(h)
            hd['themes'] = json.loads(hd['themes']) if hd['themes'] else []
            hd['matched_problem_ids'] = json.loads(hd['matched_problem_ids']) if hd['matched_problem_ids'] else []
            hackathons.append(hd)

        ranked_problems = []
        for pr in prob_rows:
            prob = dict(pr)
            prob['required_skills'] = json.loads(prob['required_skills']) if prob['required_skills'] else []
            prob['sources'] = json.loads(prob['sources']) if prob['sources'] else []
            prob['previous_prototypes'] = json.loads(prob['previous_prototypes']) if prob['previous_prototypes'] else []

            match_result = calculate_personalization_match(student_profile, prob, hackathons)
            prob['personalization'] = match_result
            ranked_problems.append(prob)

        # Sort descending by match score
        ranked_problems.sort(key=lambda x: x['personalization']['match_score'], reverse=True)

        # Filter recommended hackathons tailored to user's location and top problem matches
        user_loc = student_profile['location'].lower()
        matched_hackathons = []
        for h in hackathons:
            h_loc = f"{h.get('location', '')} {h.get('state', '')} {h.get('city', '')} {h.get('region', '')}".lower()
            is_loc_fit = any(loc_token in h_loc for loc_token in user_loc.split()) or h.get('region') in ['National', 'Global', 'Online']
            h_copy = dict(h)
            h_copy['location_match'] = is_loc_fit
            matched_hackathons.append(h_copy)

        matched_hackathons.sort(key=lambda x: (not x['location_match'], x['registration_deadline']))

        conn.close()

        self.write_json({
            "status": "success",
            "student_profile": student_profile,
            "ranked_problems": ranked_problems,
            "matched_hackathons": matched_hackathons
        })


class AIAgentAnalyzeHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        problem_id = body.get('problem_id')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM problems WHERE id = ? OR code = ?", (problem_id, problem_id))
        row = cursor.fetchone()
        conn.close()

        if not row:
            self.write_json({"status": "error", "message": "Problem not found"}, status=404)
            return

        prob = dict(row)
        prob['required_skills'] = json.loads(prob['required_skills']) if prob['required_skills'] else []
        prob['previous_prototypes'] = json.loads(prob['previous_prototypes']) if prob['previous_prototypes'] else []

        research_report = ProblemResearchAgent.run_deep_research(prob)
        self.write_json({"status": "success", "research_report": research_report})


class AIAgentChatHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        problem_id = body.get('problem_id')
        user_message = body.get('message', '').strip()

        if not user_message:
            self.write_json({"status": "error", "message": "Message is required"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM problems WHERE id = ? OR code = ?", (problem_id, problem_id))
        row = cursor.fetchone()
        conn.close()

        if not row:
            self.write_json({"status": "error", "message": "Problem not found"}, status=404)
            return

        prob = dict(row)
        response_text = ProblemResearchAgent.answer_problem_query(prob, user_message)

        self.write_json({
            "status": "success",
            "problem_id": problem_id,
            "user_message": user_message,
            "agent_response": response_text,
            "timestamp": datetime.now().strftime("%I:%M %p")
        })


class UserStackHandler(BaseHandler):
    def get(self):
        user_id = self.get_argument('user_id', 'student-local-session')
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT s.*, p.title, p.code, p.organization, p.domain, p.category, p.difficulty, p.builders_rating
        FROM user_stacks s
        JOIN problems p ON s.problem_id = p.id
        WHERE s.user_id = ?
        ORDER BY s.updated_at DESC
        ''', (user_id,))

        rows = cursor.fetchall()
        stack_items = []
        for r in rows:
            d = dict(r)
            d['tags'] = json.loads(d['tags']) if d['tags'] else []
            d['checklist'] = json.loads(d['checklist']) if d['checklist'] else {
                "evidence_checked": False,
                "affected_group_defined": False,
                "scope_36h_verified": False,
                "tech_stack_chosen": False,
                "repo_created": False
            }
            stack_items.append(d)

        conn.close()
        self.write_json({"status": "success", "stack": stack_items})

    def post(self):
        body = self.get_json_body()
        user_id = body.get('user_id', 'student-local-session')
        problem_id = body.get('problem_id')
        stage = body.get('stage', 'exploring').lower()
        notes = body.get('notes', '')
        tags = body.get('tags', [])
        target_hackathon_id = body.get('target_hackathon_id', '')
        checklist = body.get('checklist', {
            "evidence_checked": False,
            "affected_group_defined": False,
            "scope_36h_verified": False,
            "tech_stack_chosen": False,
            "repo_created": False
        })

        if not problem_id:
            self.write_json({"status": "error", "message": "problem_id is required"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO user_stacks (user_id, problem_id, stage, notes, tags, target_hackathon_id, checklist, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, problem_id) DO UPDATE SET
            stage = excluded.stage,
            notes = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE user_stacks.notes END,
            tags = excluded.tags,
            target_hackathon_id = CASE WHEN excluded.target_hackathon_id != '' THEN excluded.target_hackathon_id ELSE user_stacks.target_hackathon_id END,
            checklist = excluded.checklist,
            updated_at = CURRENT_TIMESTAMP
        ''', (
            user_id,
            problem_id,
            stage,
            notes,
            json.dumps(tags),
            target_hackathon_id,
            json.dumps(checklist)
        ))

        conn.commit()
        conn.close()

        self.write_json({"status": "success", "message": f"Updated stack for {problem_id} to stage '{stage}'"})

    def delete(self):
        user_id = self.get_argument('user_id', 'student-local-session')
        problem_id = self.get_argument('problem_id', '')

        if not problem_id:
            self.write_json({"status": "error", "message": "problem_id is required"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM user_stacks WHERE user_id = ? AND problem_id = ?", (user_id, problem_id))
        conn.commit()
        conn.close()

        self.write_json({"status": "success", "message": f"Removed {problem_id} from stack"})


class CommunityHandler(BaseHandler):
    def get(self, problem_id):
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute('''
        SELECT * FROM community_messages
        WHERE problem_id = ?
        ORDER BY is_verified_hint DESC, upvotes DESC, created_at ASC
        ''', (problem_id,))

        rows = cursor.fetchall()
        messages = [dict(r) for r in rows]

        conn.close()
        self.write_json({"status": "success", "problem_id": problem_id, "messages": messages})

    def post(self, problem_id):
        body = self.get_json_body()
        author_name = body.get('author_name', 'Student Builder').strip()
        author_college = body.get('author_college', 'KPRIET').strip()
        author_level = body.get('author_level', 'Intermediate')
        message_type = body.get('message_type', 'discussion')
        content = body.get('content', '').strip()

        if not content:
            self.write_json({"status": "error", "message": "Message content cannot be empty"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO community_messages (
            problem_id, author_name, author_college, author_level,
            message_type, content, upvotes, is_verified_hint
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0)
        ''', (
            problem_id, author_name, author_college, author_level,
            message_type, content
        ))
        conn.commit()
        msg_id = cursor.lastrowid
        conn.close()

        self.write_json({
            "status": "success",
            "message_id": msg_id,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })


class CommunityUpvoteHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        msg_id = body.get('message_id')
        if not msg_id:
            self.write_json({"status": "error", "message": "message_id required"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE community_messages SET upvotes = upvotes + 1 WHERE id = ?", (msg_id,))
        conn.commit()
        cursor.execute("SELECT upvotes FROM community_messages WHERE id = ?", (msg_id,))
        new_count = cursor.fetchone()['upvotes']
        conn.close()

        self.write_json({"status": "success", "message_id": msg_id, "new_upvotes": new_count})


class CollaborationHandler(BaseHandler):
    def get(self):
        problem_id = self.get_argument('problem_id', '').strip()
        hackathon_id = self.get_argument('hackathon_id', '').strip()

        conn = get_db()
        cursor = conn.cursor()

        sql = "SELECT * FROM collaboration_posts WHERE 1=1"
        params = []

        if problem_id:
            sql += " AND problem_id = ?"
            params.append(problem_id)

        if hackathon_id:
            sql += " AND hackathon_id = ?"
            params.append(hackathon_id)

        sql += " ORDER BY created_at DESC"
        cursor.execute(sql, params)
        rows = cursor.fetchall()

        posts = []
        for r in rows:
            d = dict(r)
            d['looking_for_skills'] = json.loads(d['looking_for_skills']) if d['looking_for_skills'] else []
            posts.append(d)

        conn.close()
        self.write_json({"status": "success", "count": len(posts), "collaboration_posts": posts})

    def post(self):
        body = self.get_json_body()
        team_name = body.get('team_name', '').strip()
        lead_name = body.get('lead_name', '').strip()
        lead_college = body.get('lead_college', 'KPRIET').strip()
        lead_level = body.get('lead_level', 'Intermediate')
        problem_id = body.get('problem_id', '')
        problem_title = body.get('problem_title', '')
        hackathon_id = body.get('hackathon_id', '')
        hackathon_name = body.get('hackathon_name', '')
        looking_for_skills = body.get('looking_for_skills', [])
        current_members = int(body.get('current_members', 1))
        max_members = int(body.get('max_members', 6))
        description = body.get('description', '').strip()
        contact_handle = body.get('contact_handle', '').strip()

        if not team_name or not lead_name or not description:
            self.write_json({"status": "error", "message": "Required fields missing"}, status=400)
            return

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO collaboration_posts (
            problem_id, problem_title, hackathon_id, hackathon_name,
            team_name, lead_name, lead_college, lead_level,
            looking_for_skills, current_members, max_members,
            description, contact_handle
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            problem_id, problem_title, hackathon_id, hackathon_name,
            team_name, lead_name, lead_college, lead_level,
            json.dumps(looking_for_skills), current_members, max_members,
            description, contact_handle
        ))
        conn.commit()
        post_id = cursor.lastrowid
        conn.close()

        self.write_json({"status": "success", "post_id": post_id, "message": "Team posting created successfully!"})


class ProjectBriefExportHandler(BaseHandler):
    def post(self):
        body = self.get_json_body()
        problem_id = body.get('problem_id')
        team_name = body.get('team_name', 'Student Builders Team')
        members = body.get('members', ['Team Member 1', 'Team Member 2'])
        solution_direction = body.get('solution_direction', '')
        assumptions = body.get('assumptions', [])
        success_metric = body.get('success_metric', 'Working on-device demonstration tested on 20 field samples within 36 hours.')

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM problems WHERE id = ? OR code = ?", (problem_id, problem_id))
        row = cursor.fetchone()
        conn.close()

        if not row:
            self.write_json({"status": "error", "message": "Problem not found"}, status=404)
            return

        prob = dict(row)

        # Generate markdown brief per PDF Page 3 & 4
        md = f"""# BUILDERSFRAME PROJECT BRIEF
**Document Generated**: {datetime.now().strftime("%B %d, %Y - %I:%M %p")}
**Target Initiative**: Smart India Hackathon & Collegiate Engineering Competitions

---

## 1. Executive Summary
- **Problem Code & Title**: {prob['code']} - {prob['title']}
- **Originating Organization**: {prob['organization']}
- **Domain**: {prob['domain']} | **Category**: {prob['category']}
- **BuildersFrame Rating**: {prob['builders_rating']}/10 | **Evidence Strength**: {prob['evidence_strength']}

## 2. Who is Affected & Ground Reality
**Target Audience / Beneficiaries**:
{prob['affected_group']}

**Context & Core Bottleneck**:
{prob['context']}

**Key Operational Constraints**:
{prob['constraints']}

## 3. Team & Ownership
- **Project Team Name**: {team_name}
- **Members & Roles**: {', '.join(members)}

## 4. Proposed Solution Direction & Unfair Advantage
{solution_direction if solution_direction else prob['sample_solution_direction']}

## 5. Critical Assumptions to Validate Before Code
"""
        for i, asm in enumerate(assumptions, 1):
            md += f"{i}. {asm}\n"

        md += f"""
## 6. Success Metrics for 36-Hour Prototype
{success_metric}

## 7. Official Source Attribution
- Official Reference: {prob['sources']}
- Verification Timestamp: {prob['checked_date']}
- *BuildersFrame is an independent decision directory. Source facts and editorial ratings remain strictly delineated.*
"""
        self.write_json({
            "status": "success",
            "markdown": md,
            "filename": f"BuildersFrame_Brief_{prob['code']}.md"
        })


class FetchLogsHandler(BaseHandler):
    def get(self):
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM fetch_logs ORDER BY timestamp DESC LIMIT 20")
        rows = cursor.fetchall()
        logs = [dict(r) for r in rows]
        conn.close()
        self.write_json({"status": "success", "logs": logs})


def make_app():
    return tornado.web.Application([
        (r"/api/problems", ProblemsListHandler),
        (r"/api/problems/fetch", ProblemFetchHandler),
        (r"/api/problems/([a-zA-Z0-9_\-]+)", ProblemDetailHandler),
        (r"/api/hackathons", HackathonsListHandler),
        (r"/api/hackathons/report", HackathonReportHandler),
        (r"/api/recommendations", PersonalizationMatchHandler),
        (r"/api/ai-agent/analyze", AIAgentAnalyzeHandler),
        (r"/api/ai-agent/chat", AIAgentChatHandler),
        (r"/api/stack", UserStackHandler),
        (r"/api/community/([a-zA-Z0-9_\-]+)", CommunityHandler),
        (r"/api/community-upvote", CommunityUpvoteHandler),
        (r"/api/collaboration", CollaborationHandler),
        (r"/api/project-brief", ProjectBriefExportHandler),
        (r"/api/fetch-logs", FetchLogsHandler),
        (r"/(.*)", tornado.web.StaticFileHandler, {"path": STATIC_DIR, "default_filename": "index.html"}),
    ], debug=True)


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get("PORT", 8000))
    app = make_app()
    app.listen(port)
    print(f"🚀 BuildersFrame Server running smoothly on http://localhost:{port}")
    tornado.ioloop.IOLoop.current().start()
