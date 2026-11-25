from backend.ai_engine import ProblemResearchAgent, calculate_personalization_match


SAMPLE_PROBLEM = {
    'id': 'bf-test-1',
    'code': 'BF999',
    'title': 'Offline Crop Pest Edge Classifier',
    'domain': 'Smart Agriculture',
    'category': 'Both',
    'difficulty': 'Intermediate',
    'affected_group': 'Smallholder farmers',
    'summary': 'Quantized vision model running on smartphone + ESP32 leaf node.',
    'constraints': 'Must work offline under ₹800 hardware BOM.',
    'required_skills': ['Python', 'OpenCV', 'Flutter', 'Embedded C/ESP32'],
}


def test_matching_scores_profile_fit_and_breakdown():
    strong_profile = {
        'level': 'Intermediate',
        'skills': ['Python', 'OpenCV', 'Flutter', 'ESP32'],
        'domains': ['Smart Agriculture'],
        'location': 'Coimbatore, Tamil Nadu',
        'team_size': 4,
    }
    weak_profile = {
        'level': 'Beginner',
        'skills': ['UI/UX (Figma)'],
        'domains': ['Cyber Security & Defence'],
        'location': 'Delhi',
        'team_size': 1,
    }

    hackathons = [{'id': 'h1', 'name': 'TN AgriHack', 'format': 'In-person', 'location': 'Coimbatore, Tamil Nadu', 'city': 'Coimbatore', 'state': 'Tamil Nadu', 'region': 'Tamil Nadu', 'status': 'Upcoming', 'matched_problem_ids': ['bf-test-1']}]
    stack = [{'problem_id': 'sih-1601', 'stage': 'building', 'domain': 'Smart Agriculture'}]

    res_strong = calculate_personalization_match(strong_profile, SAMPLE_PROBLEM, hackathons, user_stack=stack)
    res_weak = calculate_personalization_match(weak_profile, SAMPLE_PROBLEM, hackathons, user_stack=[])

    assert res_strong['match_score'] > res_weak['match_score']
    assert 'Python' in res_strong['matched_skills']
    assert 'score_breakdown' in res_strong
    bd = res_strong['score_breakdown']
    assert bd['total'] == res_strong['match_score']
    assert bd['stack_synergy'] > 0
    assert bd['event_proximity'] > 0


def test_research_agent_tailors_to_student_profile():
    profile = {
        'level': 'Beginner',
        'skills': ['Python'],
        'team_size': 2,
    }
    report = ProblemResearchAgent.run_deep_research(SAMPLE_PROBLEM, student_profile=profile)
    assert 'profile_tailoring' in report
    pt = report['profile_tailoring']
    assert pt['user_level'] == 'Beginner'
    assert pt['team_size'] == 2
    assert 'Python' in pt['matched_skills']
    assert len(pt['missing_skills']) >= 1

    reply = ProblemResearchAgent.answer_problem_query(SAMPLE_PROBLEM, 'Which tech stack should we use?', student_profile=profile)
    assert 'BF999' in reply or 'Python' in reply
