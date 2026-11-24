/**
 * BUILDERSFRAME - Client Application Logic
 * Student Hackathon Navigator & Decision Platform
 */

// Global App State
const state = {
  problems: [],
  filteredProblems: [],
  hackathons: [],
  stack: [],
  collaborationPosts: [],
  communityMessages: {},
  activeView: 'home',
  activeProblemId: null,
  activeCommunityProblemId: 'sih-1601',
  selectedLocation: 'Coimbatore, Tamil Nadu',
  selectedDomain: '',
  layoutMode: 'stream', // 'stream' (F-pattern default) or 'grid'
  studentProfile: {
    level: 'Intermediate',
    skills: ['Python', 'OpenCV', 'React', 'FastAPI', 'Flutter'],
    domains: ['Smart Agriculture', 'Smart Mobility & Transport', 'Healthcare & Biomedical'],
    location: 'Coimbatore, Tamil Nadu',
    teamSize: 4
  },
  availableSkillsList: [
    'Python', 'TensorFlow/PyTorch', 'OpenCV', 'React', 'React Native',
    'Flutter', 'Node.js', 'FastAPI', 'Embedded C/ESP32', 'IoT / Sensors',
    'PostGIS / GIS', 'Web3 / Cryptography', 'MediaPipe', 'Signal Processing',
    'YOLOv8/v11', 'Time Series Forecasting', 'UI/UX (Figma)', 'Docker'
  ]
};

// Lifecycle Entrypoint
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupKeyboardShortcuts();
});

async function initApp() {
  renderSkillsPicker();
  await Promise.all([
    fetchProblems(),
    fetchHackathons(),
    fetchUserStack(),
    fetchCollaborationPosts()
  ]);
  loadCommunityRoom(state.activeCommunityProblemId);
  startCountdownTimer();
  updateNavIndicator();
  initSpotlights();
  init3DTilt();
  initHeroMeshCanvas();
  init3DMacbookScene();
  initTypewriterSearch();
  updateFinderMatchCount();
  animateStatsNumbers();
  initConfettiCanvas();
  initButtonRipples();
  window.addEventListener('resize', updateNavIndicator);
}

// ----------------------------------------------------
// Navigation & Views
// ----------------------------------------------------
function switchView(viewName) {
  state.activeView = viewName;

  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update sliding nav pill indicator (Motion Primitives)
  updateNavIndicator();

  // Update views
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`${viewName}View`);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  // View specific refreshes
  if (viewName === 'stack') {
    renderKanbanBoard();
  } else if (viewName === 'hackathons') {
    renderHackathons();
  } else if (viewName === 'community') {
    renderCommunitySidebar();
    loadCommunityRoom(state.activeCommunityProblemId);
  } else if (viewName === 'collaboration') {
    renderCollaborationGrid();
  } else if (viewName === 'matchmaker' && !document.getElementById('rankedProblemsList').children.length) {
    runPersonalizationMatching();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavIndicator() {
  const nav = document.getElementById('mainNav');
  const indicator = document.getElementById('navIndicatorPill');
  if (!nav || !indicator) return;

  const activeBtn = nav.querySelector('.nav-item.active');
  if (!activeBtn) {
    indicator.style.opacity = '0';
    return;
  }

  indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.opacity = '1';

  // Smoothly center active tab in horizontal scroll on mobile/tablet
  if (nav.scrollWidth > nav.clientWidth) {
    const scrollTarget = activeBtn.offsetLeft - (nav.clientWidth / 2) + (activeBtn.offsetWidth / 2);
    nav.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }
}

function initSpotlights() {
  const cards = document.querySelectorAll('.motion-spotlight-card');
  cards.forEach(card => {
    if (card._hasSpotlightListener) return;
    card._hasSpotlightListener = true;

    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}

// ----------------------------------------------------
// Interactive Hero Cursor-Particle Mesh Canvas
// ----------------------------------------------------
function initHeroMeshCanvas() {
  const canvas = document.getElementById('heroMeshCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  let mouse = { x: null, y: null, radius: 140 };

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#A3B19C', '#7D9173', '#DDD0C1', '#C5B5A3', '#3A4F37', '#263C2D'];
  const particleCount = Math.min(36, Math.floor((width * height) / 11000) || 24);

  particles = [];
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * (width || 600),
      y: Math.random() * (height || 400),
      vx: (Math.random() - 0.5) * 0.6,
      vy: (Math.random() - 0.5) * 0.6,
      radius: Math.random() * 2.2 + 1.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  const parent = canvas.parentElement;
  if (parent) {
    parent.addEventListener('mousemove', (e) => {
      const rect = parent.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    });
    parent.addEventListener('mouseleave', () => {
      mouse.x = null;
      mouse.y = null;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.75;
      ctx.fill();

      // Connect nearby particles to cursor
      if (mouse.x !== null && mouse.y !== null) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.radius) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = '#A3B19C';
          ctx.globalAlpha = (1 - dist / mouse.radius) * 0.6;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // Connect particles to each other
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 85) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = '#3A4F37';
          ctx.globalAlpha = (1 - dist / 85) * 0.4;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

// ----------------------------------------------------
// Interactive 3D Card Tilt with Physics Spring
// ----------------------------------------------------
function init3DTilt() {
  const cards = document.querySelectorAll('.tilt-card');
  cards.forEach(card => {
    if (card._hasTiltListener) return;
    card._hasTiltListener = true;

    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rotX = ((y / rect.height) - 0.5) * -10;
      const rotY = ((x / rect.width) - 0.5) * 10;

      card.style.transform = `perspective(800px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('pointerleave', () => {
      card.style.transform = `perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
      setTimeout(() => {
        if (!card.matches(':hover')) {
          card.style.transform = '';
        }
      }, 260);
    });
  });
}

// ----------------------------------------------------
// Interactive Typewriter Search & Clear Button
// ----------------------------------------------------
let typewriterTimer = null;
function initTypewriterSearch() {
  const input = document.getElementById('homeSearchInput');
  if (!input) return;

  const suggestions = [
    "Search 'SIH1601 Crop Pest Detection'...",
    "Search 'Pothole telemetry road sensors'...",
    "Search 'Vaccine cold-chain IoT SIH1710'...",
    "Search 'Offline tribal STEM PWA SIH1912'...",
    "Search 'Solar microgrid peer-to-peer'...",
    "Search 'Deepfake audio forensics SIH1930'..."
  ];

  let phraseIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let isPaused = false;

  input.addEventListener('focus', () => { isPaused = true; });
  input.addEventListener('blur', () => {
    if (!input.value) isPaused = false;
  });
  input.addEventListener('input', () => {
    const clearBtn = document.getElementById('homeSearchClearBtn');
    if (clearBtn) clearBtn.style.display = input.value ? 'inline-block' : 'none';
  });

  function type() {
    if (isPaused || (input.value && input === document.activeElement)) {
      typewriterTimer = setTimeout(type, 1200);
      return;
    }

    const currentPhrase = suggestions[phraseIndex];
    if (isDeleting) {
      input.placeholder = currentPhrase.substring(0, charIndex--);
      if (charIndex < 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % suggestions.length;
        typewriterTimer = setTimeout(type, 400);
        return;
      }
      typewriterTimer = setTimeout(type, 35);
    } else {
      input.placeholder = currentPhrase.substring(0, charIndex++);
      if (charIndex > currentPhrase.length) {
        isDeleting = true;
        typewriterTimer = setTimeout(type, 2400);
        return;
      }
      typewriterTimer = setTimeout(type, 65);
    }
  }
  type();
}

function clearHomeSearch() {
  const input = document.getElementById('homeSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('homeSearchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  const sug = document.getElementById('homeSearchSuggestions');
  if (sug) {
    sug.classList.remove('active');
    sug.innerHTML = '';
  }
}

// ----------------------------------------------------
// Interactive Quick Match Finder Widget
// ----------------------------------------------------
const finderState = {
  domain: '',
  diff: '',
  cat: ''
};

function toggleFinderPill(el) {
  const type = el.dataset.finderType;
  const val = el.dataset.val;

  // Deactivate siblings in this track
  const parentTrack = el.closest('.finder-track');
  if (parentTrack) {
    parentTrack.querySelectorAll(`.finder-pill[data-finder-type="${type}"]`).forEach(p => p.classList.remove('active'));
  }
  el.classList.add('active');

  finderState[type] = val;
  updateFinderMatchCount();
}

function updateFinderMatchCount() {
  const countEl = document.getElementById('finderMatchCount');
  if (!countEl) return;

  const matches = state.problems.filter(p => {
    const matchDomain = !finderState.domain || p.domain === finderState.domain;
    const matchDiff = !finderState.diff || p.difficulty.toLowerCase() === finderState.diff.toLowerCase();
    const matchCat = !finderState.cat || p.category.toLowerCase().includes(finderState.cat.toLowerCase());
    return matchDomain && matchDiff && matchCat;
  });

  // Pulse animation on count
  countEl.textContent = matches.length;
  countEl.style.transform = 'scale(1.25)';
  countEl.style.color = '#B87355';
  setTimeout(() => {
    countEl.style.transform = 'scale(1)';
    countEl.style.color = 'var(--color-primary)';
  }, 200);
}

function applyQuickFinder() {
  if (finderState.domain) {
    state.selectedDomain = finderState.domain;
    document.querySelectorAll('.domain-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.domain === finderState.domain);
    });
  }
  if (finderState.diff) {
    const diffSelect = document.getElementById('filterDifficulty');
    if (diffSelect) diffSelect.value = finderState.diff;
  }
  if (finderState.cat) {
    const catSelect = document.getElementById('filterCategory');
    if (catSelect) catSelect.value = finderState.cat;
  }

  switchView('discovery');
  applyFilters();
  showToast(`Applied filters: found ${state.filteredProblems.length} challenges!`);
}

// ----------------------------------------------------
// Animated Live Stats Count-Up
// ----------------------------------------------------
function animateStatsNumbers() {
  const problemsEl = document.getElementById('statNumberProblems');
  const hackathonsEl = document.getElementById('statNumberHackathons');

  if (problemsEl) animateCount(problemsEl, 0, state.problems.length || 11, 1000);
  if (hackathonsEl) animateCount(hackathonsEl, 0, state.hackathons.length || 8, 1000);
}

function animateCount(el, start, end, duration) {
  let startTime = null;
  function step(timestamp) {
    if (!startTime) startTime = timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * (end - start) + start);
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = end;
    }
  }
  requestAnimationFrame(step);
}

// ----------------------------------------------------
// Celebratory Confetti Burst & Button Ripples
// ----------------------------------------------------
let confettiCtx = null;
let confettiParticles = [];
let confettiAnimationId = null;

function initConfettiCanvas() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  confettiCtx = canvas.getContext('2d');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
}

function triggerConfetti(originX, originY) {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas || !confettiCtx) return;

  const x = originX !== undefined ? originX : window.innerWidth / 2;
  const y = originY !== undefined ? originY : window.innerHeight * 0.45;

  const palette = ['#A3B19C', '#DDD0C1', '#263C2D', '#7D9173', '#FAF9EF', '#EFEFEF', '#F59E0B', '#237A4B'];

  for (let i = 0; i < 55; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 8 + 3;
    confettiParticles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5,
      size: Math.random() * 7 + 4,
      color: palette[Math.floor(Math.random() * palette.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 15,
      opacity: 1,
      gravity: 0.22,
      friction: 0.96
    });
  }

  if (!confettiAnimationId) {
    renderConfettiLoop();
  }
}

function renderConfettiLoop() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas || !confettiCtx) return;

  confettiCtx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= p.friction;
    p.rotation += p.vRot;
    p.opacity -= 0.015;

    if (p.opacity <= 0 || p.y > canvas.height) {
      confettiParticles.splice(i, 1);
      continue;
    }

    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.fillStyle = p.color;
    confettiCtx.globalAlpha = p.opacity;
    confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    confettiCtx.restore();
  }

  if (confettiParticles.length > 0) {
    confettiAnimationId = requestAnimationFrame(renderConfettiLoop);
  } else {
    confettiAnimationId = null;
    confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function initButtonRipples() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple-wave';
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;

    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 550);
  });
}

function handleHomeCenterSearch() {
  const homeInput = document.getElementById('homeSearchInput');
  const query = (homeInput?.value || '').trim();
  const suggestions = document.getElementById('homeSearchSuggestions');
  if (suggestions) suggestions.classList.remove('active');
  if (!query) return;

  const discoveryInput = document.getElementById('problemSearchInput');
  if (discoveryInput) discoveryInput.value = query;

  switchView('discovery');
  applyFilters();
}

function handleHomeSearchInput(val) {
  const container = document.getElementById('homeSearchSuggestions');
  if (!container) return;
  const q = (val || '').trim().toLowerCase();
  if (q.length < 2) {
    container.classList.remove('active');
    container.innerHTML = '';
    return;
  }

  const matches = state.problems.filter(p => {
    return (p.title && p.title.toLowerCase().includes(q)) ||
           (p.code && p.code.toLowerCase().includes(q)) ||
           (p.organization && p.organization.toLowerCase().includes(q)) ||
           (p.domain && p.domain.toLowerCase().includes(q)) ||
           (p.required_skills && p.required_skills.some(s => s.toLowerCase().includes(q)));
  }).slice(0, 5);

  if (matches.length === 0) {
    container.innerHTML = `
      <div style="padding:0.75rem 1.15rem; color:var(--text-subtle); font-size:0.84rem;">
        No problems matching "<strong>${escapeHtml(q)}</strong>". Press enter to explore all.
      </div>
    `;
    container.classList.add('active');
    return;
  }

  container.innerHTML = matches.map(p => `
    <div class="search-suggestion-item" onclick="selectHomeSearchSuggestion('${p.id}')">
      <div>
        <div class="suggestion-title">${escapeHtml(p.title)}</div>
        <div style="font-size:0.72rem; color:var(--text-subtle); margin-top:2px;">
          ${escapeHtml(p.domain)} • ${escapeHtml(p.organization)}
        </div>
      </div>
      <span class="suggestion-badge">${escapeHtml(p.code)}</span>
    </div>
  `).join('');
  container.classList.add('active');
}

function selectHomeSearchSuggestion(problemId) {
  const container = document.getElementById('homeSearchSuggestions');
  if (container) container.classList.remove('active');
  openProblemDossier(problemId);
}

function quickSearchHome(queryText) {
  const homeInput = document.getElementById('homeSearchInput');
  if (homeInput) homeInput.value = queryText;

  const discoveryInput = document.getElementById('problemSearchInput');
  if (discoveryInput) discoveryInput.value = queryText;

  switchView('discovery');
  applyFilters();
}

function jumpToDomain(domainName) {
  state.selectedDomain = domainName;
  document.querySelectorAll('.domain-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.domain === domainName);
  });

  const discoveryInput = document.getElementById('problemSearchInput');
  if (discoveryInput) discoveryInput.value = '';

  switchView('discovery');
  applyFilters();
}

function handleLocationChange(newLoc) {
  state.selectedLocation = newLoc;
  state.studentProfile.location = newLoc;
  const hubDisplay = document.getElementById('currentHubDisplay');
  if (hubDisplay) hubDisplay.textContent = newLoc;
  showToast(`Location set to ${newLoc}`);

  if (state.activeView === 'hackathons') {
    renderHackathons();
  } else if (state.activeView === 'matchmaker') {
    runPersonalizationMatching();
  }
}

// ----------------------------------------------------
// API Calls: Problems & Discovery
// ----------------------------------------------------
async function fetchProblems() {
  try {
    const res = await fetch('/api/problems');
    const data = await res.json();
    if (data.status === 'success') {
      state.problems = data.problems;
      applyFilters();
      populateDropdowns();
    }
  } catch (err) {
    console.error('Failed to fetch problems:', err);
    showToast('Error loading problems from server', 'error');
  }
}

function selectDomainPill(domain) {
  state.selectedDomain = domain;
  document.querySelectorAll('.domain-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.domain === domain);
  });
  applyFilters();
}

function setLayoutMode(mode) {
  state.layoutMode = mode;
  const stream = document.getElementById('problemsStream');
  const streamBtn = document.getElementById('streamLayoutBtn');
  const gridBtn = document.getElementById('gridLayoutBtn');

  if (stream) {
    stream.classList.toggle('grid-mode', mode === 'grid');
  }
  if (streamBtn) streamBtn.classList.toggle('active', mode === 'stream');
  if (gridBtn) gridBtn.classList.toggle('active', mode === 'grid');
}

function applyFilters() {
  const query = (document.getElementById('problemSearchInput')?.value || '').toLowerCase().trim();
  const domain = state.selectedDomain;
  const category = document.getElementById('categoryFilter')?.value || '';
  const difficulty = document.getElementById('difficultyFilter')?.value || '';
  const evidence = document.getElementById('evidenceFilter')?.value || '';

  state.filteredProblems = state.problems.filter(p => {
    // Search match across text
    const textCorpus = `${p.title} ${p.code} ${p.summary} ${p.organization} ${(p.required_skills || []).join(' ')} ${p.affected_group}`.toLowerCase();
    const matchesQuery = !query || textCorpus.includes(query);

    // Filters
    const matchesDomain = !domain || p.domain === domain;
    const matchesCategory = !category || p.category === category || p.category === 'Both';
    const matchesDiff = !difficulty || p.difficulty === difficulty;
    const matchesEvidence = !evidence || p.evidence_strength === evidence;

    return matchesQuery && matchesDomain && matchesCategory && matchesDiff && matchesEvidence;
  });

  renderProblemsGrid();
  updateResultsCount();
}

let debounceTimer = null;
function debounceFilterProblems() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    applyFilters();
  }, 180);
}

function resetFilters() {
  if (document.getElementById('problemSearchInput')) document.getElementById('problemSearchInput').value = '';
  if (document.getElementById('categoryFilter')) document.getElementById('categoryFilter').value = '';
  if (document.getElementById('difficultyFilter')) document.getElementById('difficultyFilter').value = '';
  if (document.getElementById('evidenceFilter')) document.getElementById('evidenceFilter').value = '';
  selectDomainPill('');
}

function updateResultsCount() {
  const el = document.getElementById('resultsCount');
  if (el) {
    el.textContent = `${state.filteredProblems.length} of ${state.problems.length} challenges`;
  }
}

// ----------------------------------------------------
// F-Pattern Problem Stream Rendering
// ----------------------------------------------------
function renderProblemsGrid() {
  const stream = document.getElementById('problemsStream');
  if (!stream) return;

  if (state.filteredProblems.length === 0) {
    stream.innerHTML = `
      <div style="text-align: center; padding: 4rem 1.5rem; color: var(--text-subtle); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg);">
        <p style="font-size: 1.05rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem;">No challenges found matching these criteria.</p>
        <p style="font-size: 0.85rem; margin-bottom: 1rem;">Try clearing search keywords or selecting 'All Challenges'.</p>
        <button class="btn btn-outline btn-sm" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  stream.innerHTML = state.filteredProblems.map((p, idx) => {
    // Subtle Prior Art Highlight (Quiet & informative, avoiding loud dashed purple boxes)
    let priorArtHtml = '';
    if (p.previous_prototypes && p.previous_prototypes.length > 0) {
      const firstProto = p.previous_prototypes[0];
      priorArtHtml = `
        <div class="f-prior-art-bar" title="Prior art analyzed from previous hackathons">
          <span>💡</span>
          <div>
            <strong>Prior Art Alert (${firstProto.year} - ${escapeHtml(firstProto.team_name)})</strong>:
            ${escapeHtml(firstProto.shortcoming)}
          </div>
        </div>
      `;
    }

    // Skill chips
    const skillsHtml = (p.required_skills || []).slice(0, 4).map(s => `
      <span class="f-skill-chip">${escapeHtml(s)}</span>
    `).join('');

    // Check if in user stack
    const inStack = state.stack.find(s => s.problem_id === p.id);
    const stackStage = inStack ? inStack.stage : null;

    return `
      <article class="f-problem-card motion-spotlight-card motion-fade-up" data-id="${p.id}" style="animation-delay: ${idx * 40}ms;">
        <!-- Row 1: Code, Ministry, Domain, Feasibility -->
        <div class="f-card-top-row">
          <div class="f-meta-left">
            <span class="f-code-badge">${escapeHtml(p.code)}</span>
            <span class="f-domain-tag">${escapeHtml(p.domain)}</span>
            <span>•</span>
            <span class="f-org-name">${escapeHtml(p.organization)}</span>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="f-score-tag" title="BuildersFrame Feasibility & Evidence Rating">
              ★ ${p.builders_rating}/10
            </span>
            <span style="font-size:0.72rem; color:var(--text-subtle);">
              ${escapeHtml(p.evidence_strength)} Evidence
            </span>
          </div>
        </div>

        <!-- Row 2: Title & Summary (F-Pattern Horizontal Eye Line 2) -->
        <h3 class="f-card-title">
          <a href="javascript:void(0)" onclick="openProblemDossier('${p.id}')" style="color:inherit; text-decoration:none;">
            ${escapeHtml(p.title)}
          </a>
        </h3>

        <p class="f-card-summary">
          ${escapeHtml(p.summary)}
        </p>

        <!-- Row 3: Key Ground Facts (Affected + Hard Constraints) -->
        <div class="f-ground-facts">
          <div class="f-fact-item">
            <strong>Target Demographic:</strong> ${escapeHtml(p.affected_group)}
          </div>
          ${p.constraints ? `
            <div class="f-fact-item">
              <strong>Core Constraints:</strong> ${escapeHtml(p.constraints)}
            </div>
          ` : ''}
        </div>

        <!-- Row 4: Subtle Prior Art Insight -->
        ${priorArtHtml}

        <!-- Row 5: Bottom Action Bar (Left: Skill chips, Right: Action buttons) -->
        <div class="f-card-bottom-bar">
          <div class="f-skills-group">
            <span class="f-skill-chip category">${escapeHtml(p.category)}</span>
            <span class="f-skill-chip difficulty">${escapeHtml(p.difficulty)}</span>
            ${skillsHtml}
          </div>

          <div class="f-actions-group">
            <button class="btn btn-outline btn-sm" onclick="openProblemDossier('${p.id}')">
              <span>Dossier & Prior Art</span>
            </button>
            <button class="btn btn-soft btn-sm" onclick="openAgentResearch('${p.id}')" title="Run AI Agent for 36h solution architecture">
              <span>⚡ AI Solution Plan</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="openProblemCommunity('${p.id}')" title="Open discussion room for this challenge">
              <span>💬 Room</span>
            </button>

            <!-- Quick Add to Stack -->
            <select class="filter-select" style="font-size:0.75rem; padding:0.25rem 0.45rem;" onchange="handleQuickStackChange('${p.id}', this.value)">
              <option value="" ${!stackStage ? 'selected' : ''}>+ Add to Stack</option>
              <option value="exploring" ${stackStage === 'exploring' ? 'selected' : ''}>📌 Exploring</option>
              <option value="validating" ${stackStage === 'validating' ? 'selected' : ''}>🔍 Validating</option>
              <option value="building" ${stackStage === 'building' ? 'selected' : ''}>🔨 Building</option>
              <option value="accomplished" ${stackStage === 'accomplished' ? 'selected' : ''}>🏆 Accomplished</option>
            </select>
          </div>
        </div>
      </article>
    `;
  }).join('');

  initSpotlights();
  init3DTilt();
}

// ----------------------------------------------------
// AI Personalization Matchmaker
// ----------------------------------------------------
function renderSkillsPicker() {
  const container = document.getElementById('skillsPicker');
  if (!container) return;

  container.innerHTML = state.availableSkillsList.map(skill => {
    const isSelected = state.studentProfile.skills.includes(skill);
    return `
      <button type="button" class="skill-selectable ${isSelected ? 'selected' : ''}" onclick="toggleSkillSelection('${skill}')">
        ${skill}
      </button>
    `;
  }).join('');
}

function toggleSkillSelection(skill) {
  const idx = state.studentProfile.skills.indexOf(skill);
  if (idx >= 0) {
    state.studentProfile.skills.splice(idx, 1);
  } else {
    state.studentProfile.skills.push(skill);
  }
  renderSkillsPicker();
}

function selectStudentLevel(level) {
  state.studentProfile.level = level;
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
}

async function runPersonalizationMatching() {
  const btn = document.getElementById('matchRunBtn');
  if (btn) btn.disabled = true;

  // Gather domains
  const selectedDomains = [];
  document.querySelectorAll('#domainCheckboxGroup input[type="checkbox"]:checked').forEach(cb => {
    selectedDomains.push(cb.value);
  });
  state.studentProfile.domains = selectedDomains;
  state.studentProfile.teamSize = parseInt(document.getElementById('teamSizeSelect')?.value || '4');

  try {
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.studentProfile)
    });
    const data = await res.json();

    if (data.status === 'success') {
      renderRankedRecommendations(data.ranked_problems);
    }
  } catch (err) {
    console.error('Matching failed:', err);
    showToast('Failed to run personalization matching', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderRankedRecommendations(rankedProblems) {
  const container = document.getElementById('rankedProblemsList');
  if (!container) return;

  if (!rankedProblems || rankedProblems.length === 0) {
    container.innerHTML = `<p style="color:var(--text-subtle);">No matching problems found.</p>`;
    return;
  }

  container.innerHTML = rankedProblems.slice(0, 5).map((p, idx) => {
    const m = p.personalization || {};
    const score = m.match_score || 50;

    const reasonsHtml = (m.fit_reasons || []).map(r => `
      <div class="fit-reason-item">
        <span>✓</span>
        <span>${escapeHtml(r)}</span>
      </div>
    `).join('');

    const cautionsHtml = (m.cautions || []).map(c => `
      <div class="caution-item">
        <span>⚠️</span>
        <span>${escapeHtml(c)}</span>
      </div>
    `).join('');

    const hackathonBadge = (m.recommended_hackathons && m.recommended_hackathons[0]) ? `
      <div style="margin-top:0.6rem; font-size:0.78rem; background:rgba(163, 177, 156, 0.2); padding:0.35rem 0.65rem; border-radius:var(--radius-sm); color:#16241B; border:1px solid rgba(163, 177, 156, 0.45); display:inline-flex; align-items:center; gap:0.35rem;">
        <span>🎯 Target Event Match:</span>
        <strong>${escapeHtml(m.recommended_hackathons[0].name)}</strong>
        (${m.recommended_hackathons[0].format})
      </div>
    ` : '';

    return `
      <div class="match-card motion-spotlight-card motion-fade-up" style="animation-delay: ${idx * 50}ms;">
        <div class="match-header-row">
          <div>
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
              <span class="problem-code-badge">${escapeHtml(p.code)}</span>
              <span style="font-size:0.8rem; color:var(--text-subtle);">${escapeHtml(p.domain)}</span>
              <span class="tag-pill difficulty">${escapeHtml(p.difficulty)}</span>
            </div>
            <h3 style="font-size:1.05rem; font-weight:700;">${escapeHtml(p.title)}</h3>
          </div>

          <div class="match-score-badge">
            <span>${score}%</span>
            <span style="font-size:0.7rem; font-weight:600; text-transform:uppercase;">Fit Score</span>
          </div>
        </div>

        <div class="problem-affected" style="margin: 0.5rem 0;">
          <strong>Target Affected Group</strong>: ${escapeHtml(p.affected_group)}
        </div>

        <!-- Explainable Matching Reason Breakdown (PDF core principle) -->
        <div class="fit-breakdown-box">
          <div class="fit-breakdown-title">
            <span>🧠 Explainable Match Breakdown:</span>
          </div>
          ${reasonsHtml}
          ${cautionsHtml}
          ${hackathonBadge}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:1rem; padding-top:0.75rem; border-top:1px solid var(--border-subtle);">
          <div style="display:flex; gap:0.5rem;">
            <button class="btn btn-primary btn-sm" onclick="openAgentResearch('${p.id}')">
              <span>⚡ Run AI Research Agent</span>
            </button>
            <button class="btn btn-outline btn-sm" onclick="openProblemDossier('${p.id}')">
              <span>View Dossier & Prior Art</span>
            </button>
          </div>

          <button class="btn btn-soft btn-sm" onclick="handleQuickStackChange('${p.id}', 'exploring')">
            <span>+ Save to My Stack</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  initSpotlights();
  init3DTilt();
}

// ----------------------------------------------------
// My Problem Stack (Kanban Tracker)
// ----------------------------------------------------
async function fetchUserStack() {
  try {
    const res = await fetch('/api/stack?user_id=student-local-session');
    const data = await res.json();
    if (data.status === 'success') {
      state.stack = data.stack;
      updateStackBadge();
      if (state.activeView === 'stack') {
        renderKanbanBoard();
      }
    }
  } catch (err) {
    console.error('Failed to fetch stack:', err);
  }
}

function updateStackBadge() {
  const badge = document.getElementById('stackCountBadge');
  if (badge) badge.textContent = state.stack.length;
}

async function handleQuickStackChange(problemId, stage) {
  if (!stage) return;
  try {
    const res = await fetch('/api/stack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: 'student-local-session',
        problem_id: problemId,
        stage: stage
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      triggerConfetti();
      showToast(`Challenge moved to '${stage}' stage!`);
      await fetchUserStack();
      renderProblemsGrid();
    }
  } catch (err) {
    showToast('Failed to update stack', 'error');
  }
}

function renderKanbanBoard() {
  const stages = ['exploring', 'validating', 'building', 'accomplished'];
  const counts = { exploring: 0, validating: 0, building: 0, accomplished: 0 };

  stages.forEach(s => {
    const colBody = document.getElementById(`cards${capitalize(s)}`);
    if (colBody) colBody.innerHTML = '';
  });

  state.stack.forEach(item => {
    const stage = item.stage.toLowerCase();
    if (counts[stage] !== undefined) counts[stage]++;

    const colBody = document.getElementById(`cards${capitalize(stage)}`);
    if (!colBody) return;

    // Checklist progress calculation
    const cl = item.checklist || {};
    const totalKeys = 5;
    let completedKeys = 0;
    if (cl.evidence_checked) completedKeys++;
    if (cl.affected_group_defined) completedKeys++;
    if (cl.scope_36h_verified) completedKeys++;
    if (cl.tech_stack_chosen) completedKeys++;
    if (cl.repo_created) completedKeys++;
    const progressPercent = Math.round((completedKeys / totalKeys) * 100);

    const card = document.createElement('div');
    card.className = 'kanban-card motion-spotlight-card motion-fade-up';
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
        <span class="problem-code-badge" style="font-size:0.7rem;">${escapeHtml(item.code)}</span>
        <button class="close-btn" style="font-size:0.9rem;" title="Remove from stack" onclick="removeProblemFromStack('${item.problem_id}')">✕</button>
      </div>

      <h4 class="kanban-card-title">${escapeHtml(item.title)}</h4>
      <div style="font-size:0.75rem; color:var(--text-subtle); margin-bottom:0.5rem;">
        ${escapeHtml(item.organization)}
      </div>

      <!-- Action Checklist Progress -->
      <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
        <span>Validation Progress</span>
        <strong>${completedKeys}/${totalKeys}</strong>
      </div>
      <div class="checklist-progress-bar">
        <div class="checklist-progress-fill" style="width: ${progressPercent}%;"></div>
      </div>

      <!-- Stage changer -->
      <div class="kanban-stage-selector">
        <span style="font-size:0.72rem; color:var(--text-subtle);">Move:</span>
        <select class="filter-select" style="font-size:0.72rem; padding:0.2rem 0.4rem; flex:1;" onchange="handleQuickStackChange('${item.problem_id}', this.value)">
          <option value="exploring" ${stage === 'exploring' ? 'selected' : ''}>Exploring</option>
          <option value="validating" ${stage === 'validating' ? 'selected' : ''}>Validating</option>
          <option value="building" ${stage === 'building' ? 'selected' : ''}>Building</option>
          <option value="accomplished" ${stage === 'accomplished' ? 'selected' : ''}>Accomplished</option>
        </select>
      </div>

      <div style="display:flex; gap:0.4rem; margin-top:0.6rem;">
        <button class="btn btn-outline btn-sm" style="flex:1; font-size:0.72rem;" onclick="openAgentResearch('${item.problem_id}')">
          ⚡ AI Plan
        </button>
        <button class="btn btn-soft btn-sm" style="flex:1; font-size:0.72rem;" onclick="generateProjectBrief('${item.problem_id}')">
          📄 Brief
        </button>
      </div>
    `;

    colBody.appendChild(card);
  });

  stages.forEach(s => {
    const countEl = document.getElementById(`count${capitalize(s)}`);
    if (countEl) countEl.textContent = counts[s];
  });

  initSpotlights();
  init3DTilt();
}

async function removeProblemFromStack(problemId) {
  try {
    const res = await fetch(`/api/stack?user_id=student-local-session&problem_id=${problemId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Removed from stack');
      await fetchUserStack();
      renderProblemsGrid();
    }
  } catch (err) {
    showToast('Failed to remove item', 'error');
  }
}

// ----------------------------------------------------
// Hackathons Radar (Location Aware)
// ----------------------------------------------------
async function fetchHackathons() {
  try {
    const res = await fetch('/api/hackathons?location=all');
    const data = await res.json();
    if (data.status === 'success') {
      state.hackathons = data.hackathons;
      populateDropdowns();
      if (state.activeView === 'hackathons') {
        renderHackathons();
      }
    }
  } catch (err) {
    console.error('Failed to fetch hackathons:', err);
  }
}

function renderHackathons() {
  const grid = document.getElementById('hackathonsGrid');
  if (!grid) return;

  const regionFilter = document.getElementById('hackathonRegionFilter')?.value || 'All';
  const formatFilter = document.getElementById('hackathonFormatFilter')?.value || '';
  const userLoc = state.selectedLocation.toLowerCase();

  const filtered = state.hackathons.filter(h => {
    let matchesRegion = true;
    if (regionFilter === 'Tamil Nadu') {
      matchesRegion = h.region === 'Tamil Nadu' || h.location.toLowerCase().includes('tamil nadu');
    } else if (regionFilter !== 'All') {
      matchesRegion = h.region === regionFilter;
    }
    const matchesFormat = !formatFilter || h.format === formatFilter;
    return matchesRegion && matchesFormat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-subtle); grid-column:1/-1; text-align:center;">No hackathons match this region filter.</p>`;
    return;
  }

  grid.innerHTML = filtered.map((h, idx) => {
    const isOngoing = h.status.toLowerCase() === 'ongoing';
    const isClosed = h.status.toLowerCase() === 'closed';
    const hLocLower = `${h.location} ${h.city || ''} ${h.region || ''}`.toLowerCase();
    const isLocal = userLoc.split(',')[0].trim().length > 2 && hLocLower.includes(userLoc.split(',')[0].trim().toLowerCase());

    const verificationBadge = h.verification_status ? `
      <span style="font-size:0.72rem; color:var(--color-success); font-weight:600; display:inline-flex; align-items:center; gap:0.25rem;">
        <span>🛡️</span> ${escapeHtml(h.verification_status)}
      </span>
    ` : '';

    const mirrorBtn = h.fallback_url ? `
      <a href="${h.fallback_url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm" title="Alternative / Mirror registration link">
        <span>Mirror Link ↗</span>
      </a>
    ` : '';

    return `
      <article class="hackathon-card motion-spotlight-card motion-fade-up ${isLocal ? 'local-priority' : ''}" style="${isClosed ? 'opacity:0.75;' : ''} animation-delay: ${idx * 45}ms;">
        <div class="hackathon-badge-row">
          <div style="display:flex; align-items:center; gap:0.4rem;">
            <span class="status-badge ${isOngoing ? 'ongoing' : (isClosed ? 'closed' : 'upcoming')}">${h.status}</span>
            ${verificationBadge}
          </div>
          <span style="font-size:0.75rem; font-weight:700; color:var(--color-primary); background:var(--color-primary-soft); padding:0.15rem 0.5rem; border-radius:var(--radius-full);">
            ${escapeHtml(h.badge || 'Collegiate')}
          </span>
        </div>

        <h3 class="hackathon-name">${escapeHtml(h.name)}</h3>
        <p class="hackathon-organizer">Organized by ${escapeHtml(h.organizer)}</p>

        <!-- Live Countdown -->
        <div class="countdown-box">
          <span>Registration Closes:</span>
          <strong class="countdown-timer" data-deadline="${h.registration_deadline}">Calculating...</strong>
        </div>

        <div class="hackathon-info-grid">
          <div class="info-item">
            <label>Dates</label>
            <span>${escapeHtml(h.dates)}</span>
          </div>
          <div class="info-item">
            <label>Format & Location</label>
            <span>${escapeHtml(h.format)} • ${escapeHtml(h.city || h.region)}</span>
          </div>
          <div class="info-item">
            <label>Team Size</label>
            <span>${escapeHtml(h.team_size || '2 to 5 members')}</span>
          </div>
          <div class="info-item">
            <label>Prize Pool</label>
            <span style="color:var(--color-success); font-weight:700;">${escapeHtml(h.prize_pool)}</span>
          </div>
        </div>

        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem; flex:1;">
          ${escapeHtml(h.description)}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; border-top:1px solid var(--border-subtle); padding-top:0.85rem; flex-wrap:wrap;">
          <div style="display:flex; gap:0.4rem;">
            <button class="btn btn-outline btn-sm" onclick="filterProblemsForHackathon('${h.id}')" title="Filter problems suitable for this hackathon">
              <span>🔍 Problems</span>
            </button>
            <button class="btn btn-outline btn-sm" style="color:var(--text-subtle); font-size:0.75rem;" onclick="openReportHackathonModal('${h.id}', '${escapeHtml(h.name)}')">
              <span>🚩 Report</span>
            </button>
          </div>

          <div style="display:flex; gap:0.4rem;">
            ${mirrorBtn}
            <a href="${h.official_url}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              <span>Official Portal ↗</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Immediately calculate countdowns so user never sees "Calculating..."
  updateCountdownValues();
  initSpotlights();
  init3DTilt();
}

function filterProblemsForHackathon(hackathonId) {
  const hack = state.hackathons.find(h => h.id === hackathonId);
  if (!hack) return;

  switchView('discovery');
  // Pre-filter by the hackathon's first domain theme
  if (hack.themes && hack.themes.length > 0) {
    const domainSelect = document.getElementById('domainFilter');
    if (domainSelect) {
      domainSelect.value = hack.themes[0];
      applyFilters();
      showToast(`Showing challenges aligned with ${hack.name}`);
    }
  }
}

function updateCountdownValues() {
  document.querySelectorAll('.countdown-timer').forEach(el => {
    const deadlineStr = el.dataset.deadline;
    if (!deadlineStr) return;
    const deadline = new Date(deadlineStr).getTime();
    const now = new Date().getTime();
    const distance = deadline - now;

    if (distance < 0) {
      el.textContent = "Registration Closed";
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    el.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  });
}

function startCountdownTimer() {
  updateCountdownValues();
  setInterval(updateCountdownValues, 1000);
}

// ----------------------------------------------------
// Community Discussion Rooms (Focused WhatsApp Style)
// ----------------------------------------------------
function renderCommunitySidebar() {
  const container = document.getElementById('communityRoomsList');
  if (!container) return;

  container.innerHTML = state.problems.map(p => {
    const isActive = p.id === state.activeCommunityProblemId;
    return `
      <div class="community-room-item ${isActive ? 'active' : ''}" onclick="loadCommunityRoom('${p.id}')">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
          <span class="problem-code-badge" style="font-size:0.68rem;">${p.code}</span>
          <span style="font-size:0.7rem; color:var(--text-subtle);">${p.category}</span>
        </div>
        <div style="font-size:0.85rem; font-weight:600; line-height:1.3; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(p.title)}
        </div>
      </div>
    `;
  }).join('');
}

async function loadCommunityRoom(problemId) {
  state.activeCommunityProblemId = problemId;
  renderCommunitySidebar();

  const prob = state.problems.find(p => p.id === problemId);
  if (prob) {
    const titleEl = document.getElementById('activeRoomTitle');
    const codeEl = document.getElementById('activeRoomCode');
    if (titleEl) titleEl.textContent = `${prob.code} - ${prob.title}`;
    if (codeEl) codeEl.textContent = `${prob.domain} • Verified SIH Community`;
  }

  try {
    const res = await fetch(`/api/community/${problemId}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.communityMessages[problemId] = data.messages;
      renderRoomMessages(data.messages);
    }
  } catch (err) {
    console.error('Failed to load room messages:', err);
  }
}

function renderRoomMessages(messages) {
  const stream = document.getElementById('chatMessagesStream');
  if (!stream) return;

  if (!messages || messages.length === 0) {
    stream.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-subtle);">
        <p>No messages yet in this problem room.</p>
        <p style="font-size:0.8rem; margin-top:0.4rem;">Be the first student builder to ask a question or verify an architecture idea!</p>
      </div>
    `;
    return;
  }

  stream.innerHTML = messages.map(msg => {
    const isVerified = msg.is_verified_hint === 1;

    let typeTag = '';
    if (msg.message_type === 'solution_hint') typeTag = '<span style="color:#0d9488; font-weight:700;">💡 Solution Hint</span>';
    else if (msg.message_type === 'question') typeTag = '<span style="color:#2563eb; font-weight:700;">❓ Question</span>';
    else if (msg.message_type === 'resource') typeTag = '<span style="color:#3F573B; font-weight:700;">🔗 Dataset / Resource</span>';
    else typeTag = '<span style="color:#475569; font-weight:700;">💬 Discussion</span>';

    return `
      <div class="chat-msg-card ${isVerified ? 'verified-hint' : ''}">
        <div class="msg-author-row">
          <div>
            <span class="msg-author-name">${escapeHtml(msg.author_name)}</span>
            <span class="msg-author-badge"> • ${escapeHtml(msg.author_college || 'Student')} (${msg.author_level})</span>
          </div>
          <div>${typeTag}</div>
        </div>

        <div class="msg-text">${escapeHtml(msg.content)}</div>

        <div class="msg-footer">
          <span>${msg.created_at || 'Just now'}</span>
          <button class="btn btn-outline btn-sm" style="padding:0.2rem 0.5rem; font-size:0.75rem;" onclick="upvoteMessage(${msg.id})">
            ▲ Helpful (${msg.upvotes})
          </button>
        </div>
      </div>
    `;
  }).join('');

  stream.scrollTop = stream.scrollHeight;
}

function filterRoomMessages(filterType) {
  const msgs = state.communityMessages[state.activeCommunityProblemId] || [];
  if (filterType === 'verified') {
    renderRoomMessages(msgs.filter(m => m.is_verified_hint === 1));
  } else {
    renderRoomMessages(msgs);
  }
}

async function postCommunityMessage() {
  const input = document.getElementById('newMsgContent');
  const typeSelect = document.getElementById('newMsgType');
  const content = (input?.value || '').trim();
  const msgType = typeSelect?.value || 'discussion';

  if (!content) return;

  try {
    const res = await fetch(`/api/community/${state.activeCommunityProblemId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        author_name: 'Student Builder (You)',
        author_college: 'KPRIET, Coimbatore',
        author_level: state.studentProfile.level,
        message_type: msgType,
        content: content
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      input.value = '';
      showToast('Message posted to problem room!');
      await loadCommunityRoom(state.activeCommunityProblemId);
    }
  } catch (err) {
    showToast('Failed to post message', 'error');
  }
}

async function upvoteMessage(msgId) {
  try {
    const res = await fetch('/api/community-upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: msgId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      await loadCommunityRoom(state.activeCommunityProblemId);
    }
  } catch (err) {
    console.error('Upvote failed:', err);
  }
}

function openProblemCommunity(problemId) {
  switchView('community');
  loadCommunityRoom(problemId);
}

// ----------------------------------------------------
// Teammate Collaboration Board
// ----------------------------------------------------
async function fetchCollaborationPosts() {
  try {
    const res = await fetch('/api/collaboration');
    const data = await res.json();
    if (data.status === 'success') {
      state.collaborationPosts = data.collaboration_posts;
      if (state.activeView === 'collaboration') {
        renderCollaborationGrid();
      }
    }
  } catch (err) {
    console.error('Failed to fetch collaboration posts:', err);
  }
}

function renderCollaborationGrid() {
  const grid = document.getElementById('collabGrid');
  if (!grid) return;

  if (state.collaborationPosts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:3rem 1rem; color:var(--text-subtle);">
        <p>No active teammate postings right now.</p>
        <button class="btn btn-primary btn-sm" style="margin-top:0.5rem;" onclick="openCreateTeamModal()">+ Create Team Opening</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.collaborationPosts.map((post, idx) => {
    const skillsHtml = (post.looking_for_skills || []).map(s => `
      <span class="tag-pill" style="background:#eff6ff; color:#1e40af; font-weight:600;">${escapeHtml(s)}</span>
    `).join('');

    return `
      <article class="collab-card motion-spotlight-card motion-fade-up" style="animation-delay: ${idx * 45}ms;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.5rem;">
          <div>
            <h3 style="font-size:1.1rem; font-weight:700;">${escapeHtml(post.team_name)}</h3>
            <span style="font-size:0.78rem; color:var(--text-subtle);">Lead: ${escapeHtml(post.lead_name)} • ${escapeHtml(post.lead_college)}</span>
          </div>
          <span style="font-size:0.75rem; font-weight:700; background:var(--color-primary-soft); color:var(--color-primary); padding:0.2rem 0.5rem; border-radius:var(--radius-full);">
            ${post.current_members}/${post.max_members} Members
          </span>
        </div>

        <div style="background:var(--bg-surface-subtle); padding:0.5rem 0.75rem; border-radius:var(--radius-sm); margin:0.5rem 0; font-size:0.82rem;">
          <div><strong>Challenge</strong>: ${escapeHtml(post.problem_title || 'Open Challenge')}</div>
          <div><strong>Target</strong>: ${escapeHtml(post.hackathon_name || 'Smart India Hackathon')}</div>
        </div>

        <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.5; margin-bottom:0.85rem; flex:1;">
          ${escapeHtml(post.description)}
        </p>

        <div style="margin-bottom:1rem;">
          <label style="display:block; font-size:0.72rem; color:var(--text-subtle); text-transform:uppercase; font-weight:700; margin-bottom:0.35rem;">Looking for Skills:</label>
          <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
            ${skillsHtml}
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; padding-top:0.75rem; border-top:1px solid var(--border-subtle);">
          <span style="font-size:0.75rem; color:var(--text-subtle);">Contact: ${escapeHtml(post.contact_handle)}</span>
          <a href="mailto:${escapeHtml(post.contact_handle)}?subject=Connecting%20for%20Hackathon%20Team%20${encodeURIComponent(post.team_name)}" class="btn btn-primary btn-sm">
            <span>Connect ↗</span>
          </a>
        </div>
      </article>
    `;
  }).join('');

  initSpotlights();
  init3DTilt();
}

function openCreateTeamModal() {
  populateDropdowns();
  openModal('teamModal');
}

async function submitTeamPosting() {
  const teamName = document.getElementById('postTeamName')?.value;
  const leadName = document.getElementById('postLeadName')?.value;
  const leadCollege = document.getElementById('postLeadCollege')?.value;
  const probSelect = document.getElementById('postProblemSelect');
  const hackSelect = document.getElementById('postHackathonSelect');
  const skillsRaw = document.getElementById('postSkillsNeeded')?.value || '';
  const currentMembers = document.getElementById('postCurrentMembers')?.value || 1;
  const maxMembers = document.getElementById('postMaxMembers')?.value || 6;
  const desc = document.getElementById('postDescription')?.value;
  const contact = document.getElementById('postContactHandle')?.value;

  const skills = skillsRaw.split(',').map(s => s.trim()).filter(s => s);

  try {
    const res = await fetch('/api/collaboration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team_name: teamName,
        lead_name: leadName,
        lead_college: leadCollege,
        lead_level: state.studentProfile.level,
        problem_id: probSelect?.value,
        problem_title: probSelect?.options[probSelect.selectedIndex]?.text,
        hackathon_id: hackSelect?.value,
        hackathon_name: hackSelect?.options[hackSelect.selectedIndex]?.text,
        looking_for_skills: skills,
        current_members: currentMembers,
        max_members: maxMembers,
        description: desc,
        contact_handle: contact
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      triggerConfetti();
      showToast('Team opening published!');
      closeModal('teamModal');
      await fetchCollaborationPosts();
      switchView('collaboration');
    }
  } catch (err) {
    showToast('Failed to publish team opening', 'error');
  }
}

// ----------------------------------------------------
// AI Research & Solution Agent (BuildersAgent)
// ----------------------------------------------------
async function openAgentResearch(problemId) {
  state.activeProblemId = problemId;
  const prob = state.problems.find(p => p.id === problemId);
  const codeEl = document.getElementById('agentDrawerProblemCode');
  if (codeEl && prob) codeEl.textContent = `${prob.code} - ${prob.title}`;

  // Open drawer
  const overlay = document.getElementById('agentDrawerOverlay');
  const panel = document.getElementById('agentDrawerPanel');
  if (overlay) overlay.classList.add('active');
  if (panel) panel.classList.add('open');

  const content = document.getElementById('agentDrawerContent');
  if (content) {
    content.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-subtle);">
        <p style="font-size:1.1rem; font-weight:600;">BuildersAgent is analyzing challenge constraints...</p>
        <p style="font-size:0.82rem; margin-top:0.4rem;">Evaluating prior art prototypes, open datasets, and generating 36-hour execution blueprint.</p>
      </div>
    `;
  }

  try {
    const res = await fetch('/api/ai-agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ problem_id: problemId })
    });
    const data = await res.json();
    if (data.status === 'success') {
      renderAgentReport(data.research_report);
    }
  } catch (err) {
    if (content) content.innerHTML = `<p style="color:var(--color-danger);">Failed to load AI research report.</p>`;
  }
}

function closeAgentDrawer() {
  const overlay = document.getElementById('agentDrawerOverlay');
  const panel = document.getElementById('agentDrawerPanel');
  if (overlay) overlay.classList.remove('active');
  if (panel) panel.classList.remove('open');
}

function renderAgentReport(r) {
  const content = document.getElementById('agentDrawerContent');
  if (!content) return;

  const arch = r.architecture_blueprint || {};

  // Roadmap tasks HTML
  const roadmapHtml = (r.hackathon_roadmap || []).map(phase => `
    <div style="margin-bottom:1rem; background:#f8fafc; border:1px solid var(--border-subtle); padding:0.85rem; border-radius:var(--radius-sm);">
      <strong style="color:var(--text-main); font-size:0.88rem; display:block; margin-bottom:0.4rem;">${escapeHtml(phase.phase)}</strong>
      <ul style="margin-left:1.25rem; font-size:0.82rem; color:var(--text-muted);">
        ${phase.tasks.map(t => `<li style="margin-bottom:0.25rem;">${escapeHtml(t)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  // 5 Interview Prompts
  const interviewHtml = (r.interview_prompts || []).map((p, i) => `
    <li style="margin-bottom:0.5rem; font-size:0.82rem; color:var(--text-muted);">
      <strong>Q${i+1}:</strong> ${escapeHtml(p)}
    </li>
  `).join('');

  // Judge defense
  const judgeHtml = (r.judge_prep || []).map(j => `
    <div style="margin-bottom:0.75rem; background:#fffbeb; border:1px solid #fef3c7; padding:0.75rem; border-radius:var(--radius-sm); font-size:0.82rem;">
      <strong style="color:#92400e;">Judge Trap: "${escapeHtml(j.question)}"</strong>
      <div style="margin-top:0.25rem; color:#78350f;"><strong>Defense:</strong> ${escapeHtml(j.defense)}</div>
    </div>
  `).join('');

  content.innerHTML = `
    <div class="prose">
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:var(--radius-sm); padding:0.85rem 1rem; margin-bottom:1.25rem;">
        <h4 style="color:#1e40af; font-size:0.9rem; font-weight:700; margin-bottom:0.3rem;">🚀 Unfair Breakthrough Advantage</h4>
        <p style="color:#1e3a8a; font-size:0.85rem; margin:0;">${escapeHtml(r.breakthrough_advantage)}</p>
      </div>

      <h3 style="border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">1. Recommended Technical Architecture</h3>
      <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:1.25rem;">
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.4rem; font-weight:700; width:130px;">Client Tier</td><td style="padding:0.4rem;">${escapeHtml(arch.client_tier || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.4rem; font-weight:700;">Edge / ML Tier</td><td style="padding:0.4rem;">${escapeHtml(arch.edge_ml || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.4rem; font-weight:700;">Backend & DB</td><td style="padding:0.4rem;">${escapeHtml(arch.backend_db || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.4rem; font-weight:700;">Hardware BOM</td><td style="padding:0.4rem;">${escapeHtml(arch.hardware_bom || 'None (Pure software)')}</td></tr>
        <tr><td style="padding:0.4rem; font-weight:700;">Key APIs / Feeds</td><td style="padding:0.4rem;">${escapeHtml(arch.key_apis || 'Open Public Datasets')}</td></tr>
      </table>

      <h3 style="border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">2. 36-Hour Hackathon Execution Roadmap</h3>
      <p style="font-size:0.8rem; color:var(--text-subtle);">Structured to prevent over-engineering and ensure a working demo before time runs out:</p>
      ${roadmapHtml}

      <h3 style="border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem;">3. Ground Reality Validation Questions</h3>
      <p style="font-size:0.8rem; color:var(--text-subtle);">Test these 5 questions with affected users before writing code:</p>
      <ol style="margin-left:1.25rem;">
        ${interviewHtml}
      </ol>

      <h3 style="border-bottom:1px solid var(--border-subtle); padding-bottom:0.35rem; margin-top:1.25rem;">4. Judge Trap Questions & Defense Strategy</h3>
      ${judgeHtml}

      <div id="agentChatThread" style="margin-top:1.5rem; border-top:2px dashed var(--border-subtle); padding-top:1rem;">
        <!-- Conversational Q&A appended here -->
      </div>
    </div>
  `;
}

async function sendAgentChatMessage() {
  const input = document.getElementById('agentChatInput');
  const userMsg = (input?.value || '').trim();
  if (!userMsg || !state.activeProblemId) return;

  const chatThread = document.getElementById('agentChatThread');
  if (chatThread) {
    const userBubble = document.createElement('div');
    userBubble.style.cssText = "background:#f1f5f9; padding:0.65rem 0.85rem; border-radius:var(--radius-sm); margin-bottom:0.75rem; font-size:0.85rem;";
    userBubble.innerHTML = `<strong>You:</strong> ${escapeHtml(userMsg)}`;
    chatThread.appendChild(userBubble);
    input.value = '';
  }

  try {
    const res = await fetch('/api/ai-agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem_id: state.activeProblemId,
        message: userMsg
      })
    });
    const data = await res.json();
    if (data.status === 'success' && chatThread) {
      const agentBubble = document.createElement('div');
      agentBubble.style.cssText = "background:#fff; border:1px solid var(--border-subtle); padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-bottom:0.85rem; font-size:0.85rem; border-left:3px solid var(--color-primary);";
      agentBubble.innerHTML = `
        <div style="font-size:0.75rem; color:var(--color-primary); font-weight:700; margin-bottom:0.25rem;">⚡ BuildersAgent</div>
        <div class="prose">${data.agent_response.replace(/\n/g, '<br>')}</div>
      `;
      chatThread.appendChild(agentBubble);
      agentBubble.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    showToast('Agent query failed', 'error');
  }
}

// ----------------------------------------------------
// Problem Dossier Modal
// ----------------------------------------------------
function openProblemDossier(problemId) {
  const prob = state.problems.find(p => p.id === problemId);
  if (!prob) return;

  document.getElementById('modalDossierCode').textContent = prob.code;
  document.getElementById('modalDossierTitle').textContent = prob.title;

  const body = document.getElementById('modalDossierBody');
  if (body) {
    // Previous prototypes section
    let protosHtml = '<p style="color:var(--text-subtle);">No previous public prototypes recorded for this statement.</p>';
    if (prob.previous_prototypes && prob.previous_prototypes.length > 0) {
      protosHtml = prob.previous_prototypes.map(pt => `
        <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-bottom:0.6rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.82rem; font-weight:700; color:#6b21a8;">
            <span>${escapeHtml(pt.team_name)} (${pt.year})</span>
            ${pt.repo_url ? `<a href="${pt.repo_url}" target="_blank" style="color:var(--color-primary); font-weight:700;">Prototype Link ↗</a>` : ''}
          </div>
          <p style="font-size:0.82rem; color:var(--text-muted); margin:0.3rem 0;">${escapeHtml(pt.prototype_summary)}</p>
          <div style="font-size:0.78rem; color:#991b1b; background:#fee2e2; padding:0.3rem 0.5rem; border-radius:4px;">
            <strong>Why it fell short</strong>: ${escapeHtml(pt.shortcoming)}
          </div>
        </div>
      `).join('');
    }

    // Sources list
    const sourcesHtml = (prob.sources || []).map(s => `
      <li>
        <a href="${s.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}</a>
        <span style="font-size:0.75rem; color:var(--text-subtle);"> (Verified: ${s.checked_date})</span>
      </li>
    `).join('');

    body.innerHTML = `
      <h3>Originating Organization & Domain</h3>
      <p><strong>${escapeHtml(prob.organization)}</strong> • Domain: ${escapeHtml(prob.domain)} • Category: ${escapeHtml(prob.category)}</p>

      <h3>Who is Affected & The Real-World Bottleneck</h3>
      <div class="problem-affected">
        <strong>Affected Population</strong>: ${escapeHtml(prob.affected_group)}
      </div>
      <p>${escapeHtml(prob.context)}</p>

      <h3>Hard Technical Constraints</h3>
      <p style="background:#fffbeb; padding:0.6rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem; color:#92400e;">
        ${escapeHtml(prob.constraints || 'Standard collegiate hackathon rules apply.')}
      </p>

      <h3>Previous Prototypes & Prior Art Breakdown</h3>
      <p style="font-size:0.82rem; color:var(--text-subtle);">Learn from previous teams so you do not repeat their mistakes:</p>
      ${protosHtml}

      <h3>BuildersFrame Strategic Hint</h3>
      <p style="background:#f0fdf4; border-left:3px solid var(--color-success); padding:0.65rem 0.85rem; font-size:0.85rem; color:#14532d;">
        ${escapeHtml(prob.hints || 'Scope for a 36-hour working offline demonstration.')}
      </p>

      <h3>Official Source Trail & Attribution</h3>
      <ul style="font-size:0.85rem;">
        ${sourcesHtml}
      </ul>
      <p style="font-size:0.75rem; color:var(--text-subtle); margin-top:0.75rem;">
        BuildersFrame is an independent directory. Official wording, editorial summaries, and feasibility scoring remain strictly delineated per project copyright guidelines.
      </p>
    `;
  }

  // Set action buttons
  const stackBtn = document.getElementById('modalAddToStackBtn');
  if (stackBtn) {
    stackBtn.onclick = () => {
      handleQuickStackChange(prob.id, 'exploring');
      closeModal('dossierModal');
    };
  }

  const commBtn = document.getElementById('modalOpenCommunityBtn');
  if (commBtn) {
    commBtn.onclick = () => {
      closeModal('dossierModal');
      openProblemCommunity(prob.id);
    };
  }

  openModal('dossierModal');
}

// ----------------------------------------------------
// Project Brief Generator & Export
// ----------------------------------------------------
let lastGeneratedBriefMd = '';
let lastGeneratedBriefFilename = 'BuildersFrame_Brief.md';

async function generateProjectBrief(problemId) {
  try {
    const res = await fetch('/api/project-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem_id: problemId,
        team_name: 'BuildersFrame Collegiate Squad',
        members: ['Team Lead (Fullstack)', 'ML / Systems Builder', 'UI / Designer', 'Domain Researcher'],
        assumptions: [
          'Target users can operate the smartphone interface with regional language audio prompts.',
          'Model inference runs completely on-device without continuous cellular network availability.',
          'Hardware BOM remains under ₹1,000 for realistic field adoption.'
        ]
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      lastGeneratedBriefMd = data.markdown;
      lastGeneratedBriefFilename = data.filename;

      const area = document.getElementById('briefContentArea');
      if (area) {
        area.innerHTML = `<pre style="white-space: pre-wrap; font-size:0.82rem;">${escapeHtml(data.markdown)}</pre>`;
      }
      openModal('briefModal');
    }
  } catch (err) {
    showToast('Failed to generate project brief', 'error');
  }
}

function downloadProjectBrief() {
  const blob = new Blob([lastGeneratedBriefMd], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = lastGeneratedBriefFilename;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Downloaded Project Brief Markdown!');
}

// ----------------------------------------------------
// Live Challenge Ingestion / Harvester
// ----------------------------------------------------
function openFetchModal() {
  loadFetchAuditLogs();
  openModal('fetchModal');
}

async function loadFetchAuditLogs() {
  const container = document.getElementById('fetchAuditLogs');
  if (!container) return;
  try {
    const res = await fetch('/api/fetch-logs');
    const data = await res.json();
    if (data.status === 'success' && data.logs.length > 0) {
      container.innerHTML = data.logs.map(l => `
        <div style="margin-bottom:0.4rem; padding-bottom:0.4rem; border-bottom:1px solid #f1f5f9;">
          <strong>${l.timestamp}</strong> — ${escapeHtml(l.source_name)}: ${escapeHtml(l.message)}
        </div>
      `).join('');
    } else {
      container.innerHTML = 'No recent fetch logs recorded.';
    }
  } catch (err) {
    container.innerHTML = 'Error loading audit logs.';
  }
}

async function triggerLiveFetch() {
  const btn = document.getElementById('triggerFetchBtn');
  const statusBox = document.getElementById('fetchStatusBox');
  const sourceSelect = document.getElementById('fetchSourceSelect');
  const customUrlInput = document.getElementById('customFetchUrl');

  if (btn) btn.disabled = true;
  if (statusBox) {
    statusBox.style.display = 'block';
    statusBox.style.background = '#eff6ff';
    statusBox.style.color = '#1e40af';
    statusBox.textContent = 'Contacting portal feeds & checking duplicates...';
  }

  try {
    const res = await fetch('/api/problems/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_name: sourceSelect?.value || 'Smart India Hackathon Live Portal',
        custom_url: customUrlInput?.value || null
      })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (statusBox) {
        statusBox.style.background = '#f0fdf4';
        statusBox.style.color = '#15803d';
        statusBox.textContent = `✓ Ingestion complete! Discovered ${data.fetched_count} challenges. Ingested ${data.new_count} new entries.`;
      }
      showToast(`Ingestion success: ${data.new_count} new challenges added!`);
      await fetchProblems();
      loadFetchAuditLogs();
    }
  } catch (err) {
    if (statusBox) {
      statusBox.style.background = '#fef2f2';
      statusBox.style.color = '#b91c1c';
      statusBox.textContent = 'Fetch failed. Please check network connection.';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openReportHackathonModal(hackId, hackName) {
  const idInput = document.getElementById('reportHackId');
  if (idInput) idInput.value = hackId;
  openModal('reportHackathonModal');
}

async function submitHackathonReport() {
  const hackId = document.getElementById('reportHackId')?.value;
  const issueType = document.getElementById('reportIssueType')?.value;
  const notes = document.getElementById('reportNotes')?.value;

  try {
    const res = await fetch('/api/hackathons/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathon_id: hackId,
        issue_type: issueType,
        notes: notes
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Thank you! Issue reported to editorial review queue.');
      closeModal('reportHackathonModal');
      await fetchHackathons();
    }
  } catch (err) {
    showToast('Failed to submit report', 'error');
  }
}

async function submitHackathonSuggestion() {
  const name = document.getElementById('newHackName')?.value;
  const organizer = document.getElementById('newHackOrganizer')?.value;
  const location = document.getElementById('newHackLocation')?.value;
  const region = document.getElementById('newHackRegion')?.value;
  const format = document.getElementById('newHackFormat')?.value;
  const deadline = document.getElementById('newHackDeadline')?.value;
  const officialUrl = document.getElementById('newHackOfficialUrl')?.value;
  const fallbackUrl = document.getElementById('newHackFallbackUrl')?.value;
  const prize = document.getElementById('newHackPrize')?.value;
  const eligibility = document.getElementById('newHackEligibility')?.value;
  const desc = document.getElementById('newHackDesc')?.value;

  try {
    const res = await fetch('/api/hackathons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        organizer: organizer,
        location: location,
        region: region,
        format: format,
        dates: 'Upcoming 2026/2027',
        registration_deadline: deadline,
        official_url: officialUrl,
        fallback_url: fallbackUrl,
        prize_pool: prize,
        eligibility: eligibility,
        description: desc
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Hackathon published to radar!');
      closeModal('addHackathonModal');
      document.getElementById('addHackathonForm')?.reset();
      await fetchHackathons();
      renderHackathons();
    }
  } catch (err) {
    showToast('Failed to submit hackathon', 'error');
  }
}

// ----------------------------------------------------
// UI Helpers & Modals
// ----------------------------------------------------
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('active');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
}

function populateDropdowns() {
  const probSelect = document.getElementById('postProblemSelect');
  if (probSelect) {
    probSelect.innerHTML = state.problems.map(p => `
      <option value="${p.id}">${p.code} - ${p.title.slice(0, 50)}...</option>
    `).join('');
  }

  const hackSelect = document.getElementById('postHackathonSelect');
  if (hackSelect) {
    hackSelect.innerHTML = state.hackathons.map(h => `
      <option value="${h.id}">${h.name} (${h.region})</option>
    `).join('');
  }
}

function showToast(msg, type = 'normal') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Focus search on '/'
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (state.activeView === 'home') {
        const homeInp = document.getElementById('homeSearchInput');
        if (homeInp) homeInp.focus();
      } else {
        const input = document.getElementById('problemSearchInput');
        if (input) {
          switchView('discovery');
          input.focus();
        }
      }
    }
    // Close modals on Escape
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      const sug = document.getElementById('homeSearchSuggestions');
      if (sug) sug.classList.remove('active');
      closeAgentDrawer();
    }
  });

  // Click outside to dismiss search suggestions
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.home-center-search-box')) {
      const sug = document.getElementById('homeSearchSuggestions');
      if (sug) sug.classList.remove('active');
    }
  });
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ====================================================
// 3D MACBOOK OPENING SCENE & DYNAMIC TERMINAL ENGINE
// (Procedural Three.js Model, Dynamic CanvasTexture)
// ====================================================

let macbookSceneState = {
  initialized: false,
  scene: null,
  camera: null,
  renderer: null,
  laptopGroup: null,
  lidPivot: null,
  screenMesh: null,
  screenTexture: null,
  screenCanvas: null,
  screenCtx: null,
  screenLight: null,
  lidAngle: 0.0, // starts completely closed for cinematic opening intro
  targetLidAngle: 1.885, // ~108 degrees open (optimal display viewing)
  isLidOpen: true,
  isDragging: false,
  lastMouse: { x: 0, y: 0 },
  currentRot: { x: 0.22, y: -0.32 },
  targetRot: { x: 0.22, y: -0.32 },
  parallax: { x: 0, y: 0 },
  targetParallax: { x: 0, y: 0 },
  auditMode: false,
  auditProgress: 0,
  auditLogs: [],
  auditTimer: null,
  lastTime: 0
};

function init3DMacbookScene() {
  if (macbookSceneState.initialized) return;

  const canvas = document.getElementById('macbook3DCanvas');
  const container = document.getElementById('macbookCanvasWrapper');
  if (!canvas || !container) return;

  if (typeof THREE === 'undefined') {
    console.warn('[BuildersFrame 3D] Three.js not yet loaded. Will retry...');
    setTimeout(init3DMacbookScene, 200);
    return;
  }

  macbookSceneState.initialized = true;

  // 1. Scene, Camera & Renderer
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 460;

  const scene = new THREE.Scene();
  macbookSceneState.scene = scene;

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 1.8, 6.2);
  camera.lookAt(0, 0.5, 0);
  macbookSceneState.camera = camera;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  macbookSceneState.renderer = renderer;

  // 2. Lighting Setup
  // Ambient fill light matching warm ivory theme
  const ambientLight = new THREE.AmbientLight(0xFAF9EF, 1.4);
  scene.add(ambientLight);

  // Key light from top right
  const keyLight = new THREE.DirectionalLight(0xFFFFFF, 1.6);
  keyLight.position.set(5, 7, 6);
  scene.add(keyLight);

  // Soft sage accent fill from left
  const sageFillLight = new THREE.DirectionalLight(0xA3B19C, 0.9);
  sageFillLight.position.set(-6, 3, -2);
  scene.add(sageFillLight);

  // Bottom soft bounce
  const bounceLight = new THREE.DirectionalLight(0xDDD0C1, 0.5);
  bounceLight.position.set(0, -4, 4);
  scene.add(bounceLight);

  // 3. Laptop Master Group
  const laptopGroup = new THREE.Group();
  laptopGroup.position.set(0, -0.45, 0);
  laptopGroup.rotation.set(macbookSceneState.currentRot.x, macbookSceneState.currentRot.y, 0);
  scene.add(laptopGroup);
  macbookSceneState.laptopGroup = laptopGroup;

  // 4. Aluminum Materials
  const aluminumMaterial = new THREE.MeshStandardMaterial({
    color: 0xD4D8DE,
    metalness: 0.84,
    roughness: 0.24
  });

  const darkAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0x181A1D,
    metalness: 0.5,
    roughness: 0.5
  });

  // 5. Build Base Chassis
  buildMacbookBase(laptopGroup, aluminumMaterial, darkAccentMaterial);

  // 6. Build Lid & Dynamic Screen
  buildMacbookLid(laptopGroup, aluminumMaterial);

  // 7. Interaction & Event Handlers
  setupMacbookInteraction(canvas, container);

  // 8. Spatial Holographic Chip Clicks
  setupSpatialChips();

  // 9. Resize Observer
  window.addEventListener('resize', onMacbookResize);
  onMacbookResize();

  // 10. Start Animation Loop
  requestAnimationFrame(animateMacbookScene);
}

function buildMacbookBase(laptopGroup, aluminumMaterial, darkAccentMaterial) {
  // Main Unibody Aluminum Base: Width 3.6, Height 0.13, Depth 2.45
  const baseGeo = new THREE.BoxGeometry(3.6, 0.13, 2.45);
  const baseMesh = new THREE.Mesh(baseGeo, aluminumMaterial);
  baseMesh.position.set(0, 0, 0);
  laptopGroup.add(baseMesh);

  // Bottom Taper Plate (Apple unibody contour)
  const bottomTaperGeo = new THREE.BoxGeometry(3.42, 0.04, 2.3);
  const bottomTaperMaterial = new THREE.MeshStandardMaterial({
    color: 0xBFC4CA,
    metalness: 0.8,
    roughness: 0.35
  });
  const bottomTaper = new THREE.Mesh(bottomTaperGeo, bottomTaperMaterial);
  bottomTaper.position.set(0, -0.07, 0);
  laptopGroup.add(bottomTaper);

  // 4 Rubber Non-slip Feet
  const footGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16);
  const footMat = new THREE.MeshBasicMaterial({ color: 0x1E2024 });
  const footPositions = [
    [-1.5, -0.09, -0.95],
    [1.5, -0.09, -0.95],
    [-1.5, -0.09, 0.95],
    [1.5, -0.09, 0.95]
  ];
  footPositions.forEach(pos => {
    const foot = new THREE.Mesh(footGeo, footMat);
    foot.position.set(pos[0], pos[1], pos[2]);
    laptopGroup.add(foot);
  });

  // Keyboard Deck Recess
  const keyboardWellGeo = new THREE.BoxGeometry(3.08, 0.005, 1.34);
  const keyboardTexture = generateKeyboardTexture();
  const keyboardDeckMat = new THREE.MeshStandardMaterial({
    map: keyboardTexture,
    metalness: 0.25,
    roughness: 0.65
  });
  const keyboardDeck = new THREE.Mesh(keyboardWellGeo, keyboardDeckMat);
  keyboardDeck.position.set(0, 0.066, -0.32);
  laptopGroup.add(keyboardDeck);

  // Trackpad
  const trackpadGeo = new THREE.BoxGeometry(1.24, 0.004, 0.84);
  const trackpadMat = new THREE.MeshStandardMaterial({
    color: 0xCACED4,
    metalness: 0.62,
    roughness: 0.38
  });
  const trackpad = new THREE.Mesh(trackpadGeo, trackpadMat);
  trackpad.position.set(0, 0.066, 0.68);
  laptopGroup.add(trackpad);

  // Front Thumb Opening Lip Notch
  const notchGeo = new THREE.BoxGeometry(0.55, 0.03, 0.04);
  const notchMat = new THREE.MeshBasicMaterial({ color: 0x9AA0A6 });
  const notch = new THREE.Mesh(notchGeo, notchMat);
  notch.position.set(0, 0.055, 1.22);
  laptopGroup.add(notch);

  // Rear Cylindrical Hinge
  const hingeGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.75, 16);
  const hingeMat = new THREE.MeshStandardMaterial({
    color: 0x222428,
    metalness: 0.7,
    roughness: 0.4
  });
  const hinge = new THREE.Mesh(hingeGeo, hingeMat);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, 0.065, -1.22);
  laptopGroup.add(hinge);
}

function buildMacbookLid(laptopGroup, aluminumMaterial) {
  // Hinge Pivot Group (Rotates along X axis at the rear edge)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.065, -1.22);
  laptopGroup.add(lidPivot);
  macbookSceneState.lidPivot = lidPivot;

  // Initially closed: rotation.x = 0
  lidPivot.rotation.x = -macbookSceneState.lidAngle;

  // Back Outer Lid Shell (Aluminum Unibody)
  // Relative to hinge at (0, 0, 0), extends +Z from 0 to 2.45
  const lidShellGeo = new THREE.BoxGeometry(3.6, 0.08, 2.45);
  const lidShell = new THREE.Mesh(lidShellGeo, aluminumMaterial);
  lidShell.position.set(0, 0.04, 1.225);
  lidPivot.add(lidShell);

  // Glowing BuildersFrame Emblem on back of lid
  const logoGeo = new THREE.CircleGeometry(0.26, 32);
  const logoMat = new THREE.MeshBasicMaterial({
    color: 0xFAF9EF,
    side: THREE.DoubleSide
  });
  const logoMesh = new THREE.Mesh(logoGeo, logoMat);
  logoMesh.rotation.x = -Math.PI / 2;
  logoMesh.position.set(0, 0.082, 1.225);
  lidPivot.add(logoMesh);

  // Inner Black Display Bezel
  const bezelGeo = new THREE.BoxGeometry(3.54, 0.005, 2.39);
  const bezelMat = new THREE.MeshBasicMaterial({ color: 0x07080A });
  const bezel = new THREE.Mesh(bezelGeo, bezelMat);
  bezel.position.set(0, -0.002, 1.225);
  lidPivot.add(bezel);

  // Top Camera Notch / Sensor
  const cameraNotchGeo = new THREE.BoxGeometry(0.35, 0.006, 0.06);
  const cameraNotchMat = new THREE.MeshBasicMaterial({ color: 0x121417 });
  const cameraNotch = new THREE.Mesh(cameraNotchGeo, cameraNotchMat);
  cameraNotch.position.set(0, -0.004, 2.38);
  lidPivot.add(cameraNotch);

  // Dynamic High-Resolution Screen Canvas & Texture
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1024;
  screenCanvas.height = 640;
  macbookSceneState.screenCanvas = screenCanvas;
  macbookSceneState.screenCtx = screenCanvas.getContext('2d');

  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;
  macbookSceneState.screenTexture = screenTexture;

  // Initial draw on the screen
  renderTerminalScreen(0);

  // Screen Plane Mesh
  // PlaneGeometry lies in XY. With rotation.x = Math.PI / 2, normal points -Y (faces keyboard when closed, faces viewer when open)
  const screenGeo = new THREE.PlaneGeometry(3.34, 2.15);
  const screenMat = new THREE.MeshBasicMaterial({
    map: screenTexture,
    side: THREE.DoubleSide
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.rotation.x = Math.PI / 2;
  screenMesh.position.set(0, -0.005, 1.225);
  lidPivot.add(screenMesh);
  macbookSceneState.screenMesh = screenMesh;

  // Soft Terminal Display Glow Light onto Keyboard
  const screenLight = new THREE.PointLight(0xA3B19C, 0.85, 4.5);
  screenLight.position.set(0, 0.2, 1.225);
  lidPivot.add(screenLight);
  macbookSceneState.screenLight = screenLight;
}

function generateKeyboardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 460;
  const ctx = canvas.getContext('2d');

  // Dark brushed aluminum base
  ctx.fillStyle = '#17191C';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Keyboard Rows Layout
  const keyRows = [
    // Fn row (14 keys)
    { count: 14, height: 34, gap: 6, y: 16, keyLabels: ['esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', '⌽'] },
    // Number row (14 keys)
    { count: 14, height: 58, gap: 6, y: 56, keyLabels: ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'delete'] },
    // QWERTY row (14 keys)
    { count: 14, height: 58, gap: 6, y: 120, keyLabels: ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'] },
    // ASDF row (13 keys)
    { count: 13, height: 58, gap: 6, y: 184, keyLabels: ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'return'] },
    // ZXCV row (12 keys)
    { count: 12, height: 58, gap: 6, y: 248, keyLabels: ['shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '?', 'shift'] },
    // Bottom Spacebar row
    { count: 8, height: 62, gap: 6, y: 312, custom: true }
  ];

  keyRows.forEach(row => {
    if (row.custom) {
      // Spacebar row
      const y = row.y;
      const h = row.height;
      const keys = [
        { label: 'fn', w: 68 },
        { label: 'control', w: 76 },
        { label: 'option', w: 78 },
        { label: 'command', w: 96 },
        { label: 'BuildersFrame', w: 340, isSpace: true },
        { label: 'command', w: 96 },
        { label: 'option', w: 78 },
        { label: '◄ ▲ ▼ ►', w: 120 }
      ];
      let curX = 20;
      keys.forEach(k => {
        drawKeyCap(ctx, curX, y, k.w, h, k.label, k.isSpace);
        curX += k.w + 6;
      });
    } else {
      const totalWidth = 984;
      const keyWidth = (totalWidth - (row.count - 1) * row.gap) / row.count;
      let curX = 20;
      for (let i = 0; i < row.count; i++) {
        const label = row.keyLabels[i] || '';
        drawKeyCap(ctx, curX, row.y, keyWidth, row.height, label);
        curX += keyWidth + row.gap;
      }
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function drawKeyCap(ctx, x, y, w, h, label, isSpace = false) {
  // Key cap background with subtle 3D bevel
  ctx.fillStyle = '#22252A';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  ctx.strokeStyle = '#2F343B';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Key Top Highlight
  ctx.fillStyle = '#2A2E35';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 5, 4);
  ctx.fill();

  // Label text
  ctx.fillStyle = isSpace ? '#7D9173' : '#AEB4BD';
  ctx.font = isSpace ? 'bold 12px "SF Pro", sans-serif' : '10px "SF Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 - 1);
}

// ----------------------------------------------------
// Terminal Canvas Screen Rendering (BuildersFrame OS)
// ----------------------------------------------------
function renderTerminalScreen(time) {
  const ctx = macbookSceneState.screenCtx;
  const canvas = macbookSceneState.screenCanvas;
  if (!ctx || !canvas) return;

  // Obsidian Dark Background with Forest Sage Tint
  ctx.fillStyle = '#0B100E';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle Scanline Effect
  ctx.fillStyle = 'rgba(163, 177, 156, 0.025)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  // 1. macOS Top Window Bar
  ctx.fillStyle = '#141A17';
  ctx.fillRect(0, 0, canvas.width, 42);

  ctx.strokeStyle = '#222E27';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 42);
  ctx.lineTo(canvas.width, 42);
  ctx.stroke();

  // Traffic Light Window Controls
  // Red Close
  ctx.fillStyle = '#FF5F56';
  ctx.beginPath();
  ctx.arc(26, 21, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Yellow Minimize
  ctx.fillStyle = '#FFBD2E';
  ctx.beginPath();
  ctx.arc(46, 21, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Green Expand
  ctx.fillStyle = '#27C93F';
  ctx.beginPath();
  ctx.arc(66, 21, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Title in Window Center
  ctx.fillStyle = '#A3B19C';
  ctx.font = '600 13px "SF Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BuildersFrame OS — Hackathon Problem Forensics & Audit Terminal v2.4', canvas.width / 2, 26);

  // Live Status Badge at Top Right
  ctx.fillStyle = '#223828';
  ctx.beginPath();
  ctx.roundRect(canvas.width - 150, 10, 126, 22, 11);
  ctx.fill();
  ctx.fillStyle = '#4ADE80';
  ctx.beginPath();
  ctx.arc(canvas.width - 138, 21, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#C8D6C3';
  ctx.font = '10px "SF Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SYSTEM ONLINE', canvas.width - 128, 25);

  // 2. Terminal Content
  ctx.textAlign = 'left';
  let curY = 72;

  // Command Prompt
  ctx.font = 'bold 15px "SF Mono", monospace';
  ctx.fillStyle = '#FAF9EF';
  ctx.fillText('builder@kpriet-macbook:~$', 32, curY);
  ctx.fillStyle = '#A3B19C';
  ctx.fillText(' buildersframe audit --challenge SIH1601 --live-eval', 245, curY);

  curY += 28;

  // Thin separator line
  ctx.strokeStyle = '#1E2B23';
  ctx.beginPath();
  ctx.moveTo(32, curY);
  ctx.lineTo(canvas.width - 32, curY);
  ctx.stroke();

  curY += 26;

  // Core Intelligence Badges
  const telemetry = [
    { tag: '[INIT]', color: '#A3B19C', text: 'AICTE / MoE Official Ground-Truth Verified (SHA-256: 8f4b...19c2)' },
    { tag: '[STATEMENT]', color: '#DDD0C1', text: 'SIH1601 • Smart Agro Vision: Foliage Disease Detection & Soil Moisture' },
    { tag: '[TECH-STACK]', color: '#7EC8E3', text: 'Optimal Match: PyTorch Mobile + Edge TPU + FastAPI + SQLite Vector Index' },
    { tag: '[PRIOR-ART]', color: '#E0A96D', text: '14 Prior Prototypes Audited • 0 Direct Licensing / IP Conflicts' },
    { tag: '[COLLAB]', color: '#C5B5A3', text: 'Hub Matches: 3 Teams in Coimbatore & Chennai actively seeking Embedded Eng.' }
  ];

  ctx.font = '13px "SF Mono", monospace';
  telemetry.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillText(item.tag, 32, curY);
    ctx.fillStyle = '#E5EBE2';
    ctx.fillText(item.text, 142, curY);
    curY += 24;
  });

  curY += 12;

  // 3. Feasibility Metric Card
  ctx.fillStyle = '#121A16';
  ctx.beginPath();
  ctx.roundRect(32, curY, canvas.width - 64, 95, 8);
  ctx.fill();
  ctx.strokeStyle = '#24362B';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Progress Bar Title
  ctx.fillStyle = '#FAF9EF';
  ctx.font = 'bold 13px "SF Mono", monospace';
  ctx.fillText('36-HOUR SPRINT FEASIBILITY INDEX:', 50, curY + 28);

  ctx.fillStyle = '#A3B19C';
  ctx.font = 'bold 14px "SF Mono", monospace';
  ctx.fillText('96.4% VERIFIED', canvas.width - 170, curY + 28);

  // Background Bar
  const barX = 50;
  const barY = curY + 38;
  const barW = canvas.width - 100;
  const barH = 14;

  ctx.fillStyle = '#1D2A22';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 7);
  ctx.fill();

  // Active Fill Bar with Sage Gradient
  const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW * 0.964, barY);
  fillGrad.addColorStop(0, '#5A7352');
  fillGrad.addColorStop(1, '#A3B19C');

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW * 0.964, barH, 7);
  ctx.fill();

  // Chips under Progress Bar
  ctx.font = '11px "SF Mono", monospace';
  ctx.fillStyle = '#A3B19C';
  ctx.fillText('✓ BOM Budget < ₹4,500', 50, curY + 76);
  ctx.fillText('✓ Zero-Cloud Offline Inference', 250, curY + 76);
  ctx.fillText('✓ Live Edge TPU Acceleration', 495, curY + 76);
  ctx.fillText('✓ Prior-Art Patented Clean', 735, curY + 76);

  curY += 120;

  // 4. Live Terminal Audit Output / Simulation Stream
  if (macbookSceneState.auditMode && macbookSceneState.auditLogs.length > 0) {
    ctx.fillStyle = '#17241C';
    ctx.beginPath();
    ctx.roundRect(32, curY, canvas.width - 64, 130, 8);
    ctx.fill();

    let logY = curY + 24;
    macbookSceneState.auditLogs.forEach((log) => {
      ctx.fillStyle = log.color || '#A3B19C';
      ctx.font = '12px "SF Mono", monospace';
      ctx.fillText(log.text, 50, logY);
      logY += 22;
    });

    curY += 140;
  } else {
    // Standard prompt awaiting instructions
    ctx.fillStyle = '#A3B19C';
    ctx.font = '13px "SF Mono", monospace';
    ctx.fillText('>> Verdict: AICTE SIH1601 is prime candidate for collegiate hackathon win.', 32, curY);

    curY += 24;

    ctx.fillStyle = '#FAF9EF';
    ctx.fillText('builder@kpriet-macbook:~$', 32, curY);

    // Blinking Cursor █
    const showCursor = Math.floor(time / 500) % 2 === 0;
    if (showCursor) {
      ctx.fillStyle = '#A3B19C';
      ctx.fillText('█', 245, curY);
    }
  }

  // Update Three.js Texture
  if (macbookSceneState.screenTexture) {
    macbookSceneState.screenTexture.needsUpdate = true;
  }
}

// ----------------------------------------------------
// Animation Frame Loop
// ----------------------------------------------------
function animateMacbookScene(timestamp) {
  requestAnimationFrame(animateMacbookScene);

  const state = macbookSceneState;
  if (!state.scene || !state.camera || !state.renderer) return;

  // 1. Smooth Lid Opening Ease (from 0 to ~108 degrees)
  const angleDelta = state.targetLidAngle - state.lidAngle;
  if (Math.abs(angleDelta) > 0.0005) {
    state.lidAngle += angleDelta * 0.045;
    if (state.lidPivot) {
      state.lidPivot.rotation.x = -state.lidAngle;
    }

    // Update screen glow light intensity as lid opens
    if (state.screenLight) {
      state.screenLight.intensity = Math.min(1.2, state.lidAngle * 0.65);
    }
  }

  // 2. Smooth 3D Rotation & Parallax Inertia
  state.parallax.x += (state.targetParallax.x - state.parallax.x) * 0.08;
  state.parallax.y += (state.targetParallax.y - state.parallax.y) * 0.08;

  state.currentRot.x += (state.targetRot.x + state.parallax.x - state.currentRot.x) * 0.08;
  state.currentRot.y += (state.targetRot.y + state.parallax.y - state.currentRot.y) * 0.08;

  if (state.laptopGroup) {
    state.laptopGroup.rotation.x = state.currentRot.x;
    state.laptopGroup.rotation.y = state.currentRot.y;
  }

  // 3. Render Dynamic Screen Content (Blinking cursor / logs)
  renderTerminalScreen(timestamp);

  // 4. Render Scene
  state.renderer.render(state.scene, state.camera);
}

// ----------------------------------------------------
// Interactive Mouse & Touch Drag Controls
// ----------------------------------------------------
function setupMacbookInteraction(canvas, container) {
  const state = macbookSceneState;

  // Mouse Down / Touch Start
  function handleStart(clientX, clientY) {
    state.isDragging = true;
    state.lastMouse.x = clientX;
    state.lastMouse.y = clientY;
    container.style.cursor = 'grabbing';
  }

  // Mouse Move / Touch Move
  function handleMove(clientX, clientY, isTouch = false) {
    if (state.isDragging) {
      const deltaX = clientX - state.lastMouse.x;
      const deltaY = clientY - state.lastMouse.y;

      state.targetRot.y += deltaX * 0.007;
      state.targetRot.x += deltaY * 0.007;

      // Clamp vertical tilt to prevent unnatural flipping
      state.targetRot.x = Math.max(-0.1, Math.min(0.72, state.targetRot.x));

      state.lastMouse.x = clientX;
      state.lastMouse.y = clientY;
    } else if (!isTouch) {
      // Gentle parallax tilt following cursor
      const rect = container.getBoundingClientRect();
      const normX = (clientX - rect.left) / rect.width;
      const normY = (clientY - rect.top) / rect.height;

      state.targetParallax.y = (normX - 0.5) * 0.22;
      state.targetParallax.x = (normY - 0.5) * 0.14;

      // Counter-parallax shift on floating chips
      shiftFloatingChips(normX - 0.5, normY - 0.5);
    }
  }

  function handleEnd() {
    state.isDragging = false;
    container.style.cursor = 'grab';
  }

  // Mouse Events
  container.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY, false));
  window.addEventListener('mouseup', handleEnd);
  container.addEventListener('mouseleave', () => {
    state.targetParallax.x = 0;
    state.targetParallax.y = 0;
    shiftFloatingChips(0, 0);
  });

  // Touch Events for Mobile / Tablet Responsiveness
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && state.isDragging) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  }, { passive: true });

  window.addEventListener('touchend', handleEnd);
}

function shiftFloatingChips(offsetX, offsetY) {
  const chips = document.querySelectorAll('.floating-spatial-chip');
  chips.forEach((chip, i) => {
    const factor = (i % 2 === 0 ? 1 : -1) * 14;
    chip.style.transform = `translate(${offsetX * factor}px, ${offsetY * factor}px)`;
  });
}

function setupSpatialChips() {
  const chip1 = document.getElementById('spatialChip1');
  const chip2 = document.getElementById('spatialChip2');
  const chip3 = document.getElementById('spatialChip3');
  const chip4 = document.getElementById('spatialChip4');

  if (chip1) {
    chip1.addEventListener('click', () => {
      switchView('discovery');
      const input = document.getElementById('problemSearchInput');
      if (input) {
        input.value = 'SIH1601';
        handleSearch();
      }
      showToast('Filtering AICTE & MoE Ground-Truth Challenges', 'info');
    });
  }

  if (chip2) {
    chip2.addEventListener('click', () => {
      switchView('stack');
      showToast('Opening Tech-Stack Compatibility Matcher (96%)', 'info');
    });
  }

  if (chip3) {
    chip3.addEventListener('click', () => {
      switchView('discovery');
      showToast('Loading Prior-Art Prototype Deconstruction for SIH1601', 'info');
    });
  }

  if (chip4) {
    chip4.addEventListener('click', () => {
      switchView('timeline');
      showToast('Launching 36-Hour Hackathon Sprint Blueprint', 'info');
    });
  }
}

function onMacbookResize() {
  const state = macbookSceneState;
  const container = document.getElementById('macbookCanvasWrapper');
  if (!state.renderer || !state.camera || !container) return;

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 460;

  state.camera.aspect = width / height;

  // Responsive camera framing for mobile vs desktop
  if (width < 640) {
    state.camera.fov = 48;
    state.camera.position.set(0, 1.9, 7.4);
  } else if (width < 900) {
    state.camera.fov = 42;
    state.camera.position.set(0, 1.85, 6.7);
  } else {
    state.camera.fov = 38;
    state.camera.position.set(0, 1.8, 6.2);
  }

  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

// ----------------------------------------------------
// MacBook Control Bar Actions (Exposed to HTML buttons)
// ----------------------------------------------------
function toggleMacbookLid() {
  const state = macbookSceneState;
  const statusDisplay = document.getElementById('macbookStatusDisplay');

  if (state.isLidOpen) {
    // Close Lid
    state.targetLidAngle = 0.0;
    state.isLidOpen = false;
    if (statusDisplay) {
      statusDisplay.innerHTML = 'MacBook Pro • <span style="color:#E0A96D;">Lid Closed • Low-Power Standby</span>';
    }
    showToast('MacBook lid closed into standby mode', 'info');
  } else {
    // Open Lid
    state.targetLidAngle = 1.885;
    state.isLidOpen = true;
    if (statusDisplay) {
      statusDisplay.innerHTML = 'MacBook Pro • <span style="color:#A3B19C;">Opening Angle: 108° • Display Active</span>';
    }
    showToast('MacBook lid opened to 108° presentation angle', 'info');
  }
}

function resetMacbookView() {
  const state = macbookSceneState;
  state.targetRot.x = 0.22;
  state.targetRot.y = -0.32;
  state.targetParallax.x = 0;
  state.targetParallax.y = 0;
  state.targetLidAngle = 1.885;
  state.isLidOpen = true;

  const statusDisplay = document.getElementById('macbookStatusDisplay');
  if (statusDisplay) {
    statusDisplay.innerHTML = 'MacBook Pro • Opening Angle: 108° • Display Active';
  }

  showToast('3D Camera angle reset to default perspective', 'info');
}

function triggerMacbookTerminalDemo() {
  const state = macbookSceneState;
  if (state.auditMode) return;

  state.auditMode = true;
  state.auditLogs = [];

  // Open lid if closed
  if (!state.isLidOpen) {
    state.targetLidAngle = 1.885;
    state.isLidOpen = true;
  }

  showToast('⚡ Running Live Challenge Audit on SIH1601...', 'info');

  const steps = [
    { text: '[AUDIT STEP 1/4] Querying AICTE Ground-Truth Repository...', color: '#7EC8E3', delay: 400 },
    { text: '[AUDIT STEP 2/4] Verifying Hardware BOM Ceiling: ₹4,250 (Approved)', color: '#A3B19C', delay: 1100 },
    { text: '[AUDIT STEP 3/4] Running Prior-Art Conflict Forensics (14 repos clean)', color: '#DDD0C1', delay: 1800 },
    { text: '[AUDIT STEP 4/4] 36-Hour Hackathon Feasibility Verified: 98.2% Win Probability', color: '#4ADE80', delay: 2500 }
  ];

  steps.forEach(step => {
    setTimeout(() => {
      state.auditLogs.push(step);
    }, step.delay);
  });

  // Complete Audit and trigger celebration
  setTimeout(() => {
    state.auditMode = false;
    triggerConfetti();
    showToast('✓ Challenge Audit Completed! SIH1601 is 98.2% hackathon-ready.', 'info');

    // Pulse highlight all spatial chips
    document.querySelectorAll('.floating-spatial-chip').forEach(chip => {
      chip.style.borderColor = '#A3B19C';
      chip.style.boxShadow = '0 0 20px rgba(163, 177, 156, 0.4)';
      setTimeout(() => {
        chip.style.borderColor = '';
        chip.style.boxShadow = '';
      }, 3500);
    });
  }, 3600);
}

// Expose functions globally for HTML onclick handlers
window.toggleMacbookLid = toggleMacbookLid;
window.resetMacbookView = resetMacbookView;
window.triggerMacbookTerminalDemo = triggerMacbookTerminalDemo;

