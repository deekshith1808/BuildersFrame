/**
 * BUILDERSFRAME - Client Application Logic
 * Student Hackathon Challenge Discovery & Planning Workspace
 */

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const supportsHoverPointer = window.matchMedia('(pointer: fine)');

// Global App State
const state = {
  problems: [],
  filteredProblems: [],
  hackathons: [],
  stack: [],
  collaborationPosts: [],
  communityMessages: {},
  matchScoresById: {},
  currentUser: null,
  activeView: 'home',
  activeProblemId: null,
  activeCommunityProblemId: 'sih-1601',
  selectedLocation: 'Coimbatore, Tamil Nadu',
  selectedDomain: '',
  activeStackFilter: 'all',
  layoutMode: 'stream',
  heroFrameStep: 'problem',
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

// Runtime cleanup handles
let heroMeshController = null;
let countdownTimerId = null;

// Lifecycle Entrypoint
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupKeyboardShortcuts();
});

async function initApp() {
  renderSkillsPicker();
  updateNavIndicator();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(updateNavIndicator);
  }
  initHomeScrollObservers();
  initScrollProgressBar();
  initHeroFrameParallax();
  attachCard3DTilt('#problemsStream', '.f-problem-card');
  attachCard3DTilt('#rankedProblemsList', '.match-card');
  attachCard3DTilt('#stackKanbanBoard', '.kanban-card');
  attachCard3DTilt('#howItWorksSection', '.home-pillar-card');
  attachCard3DTilt('#homeDomainsGrid', '.home-domain-card');
  attachCard3DTilt('#hackathonsView', '.hackathon-card');
  heroMeshController = initHeroMeshCanvas();
  initConfettiCanvas();

  await fetchCurrentUser();

  await Promise.all([
    fetchProblems(),
    fetchHackathons(),
    fetchUserStack(),
    fetchCollaborationPosts()
  ]);

  loadCommunityRoom(state.activeCommunityProblemId);
  startCountdownTimer();
  updateNavIndicator();
  updateFinderMatchCount();
  updateHomeStatsFromBackend();
  updateHeroFrameFromData();

  window.addEventListener('resize', handleViewportResize, { passive: true });
}

async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) return;
    const data = await res.json();
    if (data.authenticated && data.user) {
      state.currentUser = data.user;
      applyAuthenticatedProfile(data.user);
    } else {
      state.currentUser = null;
    }
  } catch (err) {
    console.warn('Auth session check skipped:', err);
  }
  renderAuthControls();
}

function applyAuthenticatedProfile(user) {
  if (!user) return;
  if (user.level) state.studentProfile.level = user.level;
  if (Array.isArray(user.skills) && user.skills.length > 0) {
    state.studentProfile.skills = [...user.skills];
    user.skills.forEach(s => {
      if (!state.availableSkillsList.includes(s)) state.availableSkillsList.push(s);
    });
  }
  if (Array.isArray(user.domains) && user.domains.length > 0) {
    state.studentProfile.domains = [...user.domains];
  }
  if (user.location) {
    state.selectedLocation = user.location;
    state.studentProfile.location = user.location;
  }
  if (user.team_size) {
    state.studentProfile.teamSize = Number(user.team_size) || 4;
  }

  // Sync profile controls into Matchmaker and Header selectors
  renderSkillsPicker();
  selectStudentLevel(state.studentProfile.level);

  const teamSelect = document.getElementById('teamSizeSelect');
  if (teamSelect) teamSelect.value = String(state.studentProfile.teamSize);

  document.querySelectorAll('#domainCheckboxGroup input[type="checkbox"]').forEach(cb => {
    cb.checked = state.studentProfile.domains.includes(cb.value);
  });

  const locSelect = document.getElementById('userLocationSelect');
  if (locSelect && Array.from(locSelect.options).some(o => o.value === state.selectedLocation)) {
    locSelect.value = state.selectedLocation;
  }
  const mobLocSelect = document.getElementById('mobileLocationSelect');
  if (mobLocSelect && Array.from(mobLocSelect.options).some(o => o.value === state.selectedLocation)) {
    mobLocSelect.value = state.selectedLocation;
  }
}

function renderAuthControls() {
  const desktopHost = document.getElementById('headerAuthContainer');
  const mobileHost = document.getElementById('mobileAuthContainer');
  const syncBanner = document.getElementById('matchProfileSyncBanner');
  const user = state.currentUser;

  if (desktopHost) {
    if (user) {
      desktopHost.innerHTML = `
        <div class="header-user-pill" title="${escapeHtml(user.email)} • ${escapeHtml(user.level)}">
          <span class="header-user-name">${escapeHtml(user.full_name)}</span>
          <button type="button" class="header-logout-btn" onclick="logoutUser()" title="Sign out of session">Sign out</button>
        </div>
      `;
    } else {
      desktopHost.innerHTML = `<a href="/login" class="btn btn-primary btn-sm" id="headerLoginLink">Sign In</a>`;
    }
  }

  if (mobileHost) {
    if (user) {
      mobileHost.innerHTML = `
        <div class="mobile-user-card">
          <div>
            <strong>${escapeHtml(user.full_name)}</strong>
            <div style="font-size:0.72rem; color:var(--text-subtle);">${escapeHtml(user.level)} • ${escapeHtml(user.location)}</div>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="logoutUser()">Sign out</button>
        </div>
      `;
    } else {
      mobileHost.innerHTML = `<a href="/login" class="btn btn-primary btn-sm" style="width:100%; justify-content:center;" id="mobileLoginLink">Sign In / Create Builder Account</a>`;
    }
  }

  if (syncBanner) {
    if (user) {
      syncBanner.classList.add('signed-in');
      syncBanner.innerHTML = `
        <span>Signed in as <strong>${escapeHtml(user.full_name)}</strong> — scores &amp; saved stack sync to your account.</span>
        <span style="font-family:var(--font-mono); font-size:0.7rem;">${escapeHtml(user.level)}</span>
      `;
    } else {
      syncBanner.classList.remove('signed-in');
      syncBanner.innerHTML = `
        <span>Sign in to save your builder profile &amp; stack automatically across sessions.</span>
        <a href="/login" class="inline-auth-link">Sign in →</a>
      `;
    }
  }
}

async function logoutUser() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    state.currentUser = null;
    renderAuthControls();
    await fetchUserStack();
    updateHomeStatsFromBackend();
    showToast('Signed out of builder session');
  } catch (err) {
    showToast('Unable to sign out cleanly', 'error');
  }
}

function handleViewportResize() {
  updateNavIndicator();
  if (window.innerWidth > 1120) {
    closeMobileMenu();
  }
}

// ----------------------------------------------------
// Navigation, Mobile Menu & Section Scrolling
// ----------------------------------------------------
function switchView(viewName) {
  state.activeView = viewName;
  closeMobileMenu();

  document.querySelectorAll('.nav-item').forEach(btn => {
    const isActive = btn.dataset.view === viewName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  document.querySelectorAll('.mobile-nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  updateNavIndicator();

  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const targetSec = document.getElementById(`${viewName}View`);
  if (targetSec) {
    targetSec.classList.add('active');
  }

  // Pause decorative hero canvas when leaving Home view
  if (heroMeshController) {
    heroMeshController.setActiveView(viewName === 'home');
  }

  if (viewName === 'stack') {
    renderKanbanBoard();
  } else if (viewName === 'hackathons') {
    renderHackathons();
  } else if (viewName === 'community') {
    renderCommunitySidebar();
    loadCommunityRoom(state.activeCommunityProblemId);
  } else if (viewName === 'collaboration') {
    renderCollaborationGrid();
  } else if (viewName === 'matchmaker' && !document.getElementById('rankedProblemsList')?.children.length) {
    runPersonalizationMatching();
  }

  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
  });
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobileNavDrawer');
  const btn = document.getElementById('mobileMenuBtn');
  const label = document.getElementById('mobileMenuBtnLabel');
  if (!drawer || !btn) return;

  const isOpening = drawer.hasAttribute('hidden');
  if (isOpening) {
    drawer.removeAttribute('hidden');
    btn.setAttribute('aria-expanded', 'true');
    if (label) label.textContent = 'Close';
  } else {
    closeMobileMenu();
  }
}

function closeMobileMenu() {
  const drawer = document.getElementById('mobileNavDrawer');
  const btn = document.getElementById('mobileMenuBtn');
  const label = document.getElementById('mobileMenuBtnLabel');
  if (drawer) drawer.setAttribute('hidden', '');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (label) label.textContent = 'Menu';
}

function switchViewFromMobile(viewName) {
  switchView(viewName);
}

function syncLocationFromMobile(newLoc) {
  const desktopSel = document.getElementById('userLocationSelect');
  if (desktopSel) desktopSel.value = newLoc;
  handleLocationChange(newLoc);
}

function scrollToHomeSection(event, sectionId) {
  if (event) event.preventDefault();
  if (state.activeView !== 'home') {
    switchView('home');
  }
  const el = document.getElementById(sectionId);
  if (el) {
    el.scrollIntoView({
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      block: 'start'
    });
  }
}

function updateNavIndicator() {
  const nav = document.getElementById('mainNav');
  const indicator = document.getElementById('navIndicatorPill');
  if (!nav || !indicator || nav.offsetParent === null) return;

  const activeBtn = nav.querySelector('.nav-item.active');
  if (!activeBtn) {
    indicator.style.opacity = '0';
    return;
  }

  indicator.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
  indicator.style.width = `${activeBtn.offsetWidth}px`;
  indicator.style.opacity = '1';
}

// ----------------------------------------------------
// Hero Modular Frame & Calm Ambient Canvas (Lifecycle-Managed)
// ----------------------------------------------------
function selectHeroFrameStep(stepName) {
  state.heroFrameStep = stepName;

  document.querySelectorAll('.frame-tab').forEach(tab => {
    const active = tab.dataset.frameStep === stepName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.querySelectorAll('.schematic-node').forEach(node => {
    node.classList.toggle('active', node.dataset.step === stepName);
  });

  const panelMap = {
    problem: 'framePanelProblem',
    fit: 'framePanelFit',
    plan: 'framePanelPlan'
  };

  Object.entries(panelMap).forEach(([key, panelId]) => {
    const el = document.getElementById(panelId);
    if (!el) return;
    if (key === stepName) {
      el.removeAttribute('hidden');
      el.classList.add('active');
    } else {
      el.setAttribute('hidden', '');
      el.classList.remove('active');
    }
  });

  const frameCard = document.getElementById('heroFrameCard');
  if (frameCard && !prefersReducedMotion.matches) {
    frameCard.classList.remove('is-turning');
    void frameCard.offsetWidth;
    frameCard.classList.add('is-turning');
  }
}

function initScrollProgressBar() {
  const bar = document.getElementById('scrollProgressBar');
  if (!bar) return;
  const syncProgress = () => {
    const doc = document.documentElement;
    const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
    const pct = maxScroll > 0 ? Math.min(100, (window.scrollY / maxScroll) * 100) : 0;
    bar.style.width = `${pct.toFixed(1)}%`;
  };
  window.addEventListener('scroll', syncProgress, { passive: true });
  syncProgress();
}

function attachCard3DTilt(containerSelector, cardSelector) {
  const container = document.querySelector(containerSelector);
  if (!container || !supportsHoverPointer.matches || prefersReducedMotion.matches) return;

  container.addEventListener('pointermove', (e) => {
    if (prefersReducedMotion.matches) return;
    const card = e.target.closest(cardSelector);
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const nx = px / 100 - 0.5;
    const ny = py / 100 - 0.5;
    const rotY = (nx * 5.2).toFixed(2);
    const rotX = (ny * -4.2).toFixed(2);
    card.style.setProperty('--mx', `${px.toFixed(1)}%`);
    card.style.setProperty('--my', `${py.toFixed(1)}%`);
    card.style.transform = `perspective(950px) translateY(-6px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  container.addEventListener('pointerout', (e) => {
    const card = e.target.closest(cardSelector);
    if (!card) return;
    if (!card.contains(e.relatedTarget)) {
      card.style.transform = '';
    }
  });
}

function initHeroFrameParallax() {
  const widget = document.getElementById('buildersFrameVisual');
  if (!widget || !supportsHoverPointer.matches || prefersReducedMotion.matches) return;

  widget.addEventListener('pointermove', (e) => {
    if (prefersReducedMotion.matches) return;
    const rect = widget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    const normX = px / 100 - 0.5;
    const normY = py / 100 - 0.5;
    const rotY = (normX * 6.5).toFixed(2);
    const rotX = (normY * -5.2).toFixed(2);
    widget.style.setProperty('--px', `${px.toFixed(1)}%`);
    widget.style.setProperty('--py', `${py.toFixed(1)}%`);
    widget.style.transform = `perspective(1200px) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
  });

  widget.addEventListener('pointerleave', () => {
    widget.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
    widget.style.setProperty('--px', '50%');
    widget.style.setProperty('--py', '35%');
  });
}

function updateHeroFrameFromData() {
  if (!state.problems || state.problems.length === 0) return;
  const sample = state.problems.find(p => p.id === 'sih-1601') || state.problems[0];
  if (!sample) return;

  const codeEl = document.getElementById('heroFrameCode');
  const orgEl = document.getElementById('heroFrameOrg');
  const titleEl = document.getElementById('heroFrameTitle');
  const summaryEl = document.getElementById('heroFrameSummary');
  const affectedEl = document.getElementById('heroFrameAffected');

  if (codeEl) codeEl.textContent = sample.code || sample.id;
  if (orgEl) orgEl.textContent = `${sample.organization} • Checked ${sample.checked_date || 'N/A'}`;
  if (titleEl) titleEl.textContent = sample.title;
  if (summaryEl) summaryEl.textContent = sample.constraints || sample.summary;
  if (affectedEl) affectedEl.textContent = sample.affected_group;
}

function openHeroSamplePlan() {
  const sampleId = (state.problems.find(p => p.id === 'sih-1601') || state.problems[0])?.id || 'sih-1601';
  openAgentResearch(sampleId);
}

function openHeroSampleDossier() {
  const sampleId = (state.problems.find(p => p.id === 'sih-1601') || state.problems[0])?.id || 'sih-1601';
  openProblemDossier(sampleId);
}

function initHeroMeshCanvas() {
  const canvas = document.getElementById('heroMeshCanvas');
  const stage = document.getElementById('homeHeroStage');
  if (!canvas || !stage) return null;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let rafId = null;
  let isOffscreen = false;
  let isHomeActive = state.activeView === 'home';

  // 3D wireframe architectural frame vertices + orbital nodes
  const outerCube = [
    [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
  ];
  const cubeEdges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];
  const innerOct = [
    [0, -1.05, 0], [1.05, 0, 0], [0, 0, 1.05], [-1.05, 0, 0], [0, 0, -1.05], [0, 1.05, 0]
  ];
  const octEdges = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [5, 1], [5, 2], [5, 3], [5, 4],
    [1, 2], [2, 3], [3, 4], [4, 1]
  ];

  const MAX_PARTICLES = 22;
  const palette = ['#8FA187', '#A3B19C', '#CBBBA6', '#445749'];
  const particles = [];
  let phase = 0;
  let pointerTiltX = 0;
  let pointerTiltY = 0;

  for (let i = 0; i < MAX_PARTICLES; i++) {
    const theta = (i / MAX_PARTICLES) * Math.PI * 2;
    particles.push({
      x: (Math.random() - 0.5) * 2.2,
      y: (Math.random() - 0.5) * 1.4,
      z: Math.sin(theta) * 0.9,
      vx: (Math.random() - 0.5) * 0.0014,
      vy: (Math.random() - 0.5) * 0.0011,
      r: 2.0 + (i % 3) * 0.85,
      color: palette[i % palette.length]
    });
  }

  if (supportsHoverPointer.matches) {
    stage.addEventListener('pointermove', (e) => {
      if (prefersReducedMotion.matches) return;
      const rect = stage.getBoundingClientRect();
      pointerTiltY = ((e.clientX - rect.left) / rect.width - 0.5) * 0.35;
      pointerTiltX = ((e.clientY - rect.top) / rect.height - 0.5) * -0.25;
    }, { passive: true });
  }

  function project3D(pt, rx, ry, cx, cy, scale, fov = 4.2) {
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);

    const x1 = pt[0] * cosY - pt[2] * sinY;
    const z1 = pt[0] * sinY + pt[2] * cosY;
    const y2 = pt[1] * cosX - z1 * sinX;
    const z2 = pt[1] * sinX + z1 * cosX;

    const depth = fov / (fov + z2 + 1.4);
    return {
      x: cx + x1 * scale * depth,
      y: cy + y2 * scale * depth,
      z: z2,
      scale: depth
    };
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (prefersReducedMotion.matches) {
      drawFrame(false);
    }
  }

  function drawFrame(advance) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    if (advance) phase += 0.0085;

    // Draw 3D architectural wireframe anchor centered behind the right/center stage
    const frameCenterX = width > 900 ? width * 0.72 : width * 0.5;
    const frameCenterY = height * 0.48;
    const frameScale = Math.min(width, height) * 0.25;

    const rotY = phase * 0.75 + pointerTiltY;
    const rotX = 0.32 + Math.sin(phase * 0.4) * 0.14 + pointerTiltX;

    const projOuter = outerCube.map(v => project3D(v, rotX, rotY, frameCenterX, frameCenterY, frameScale));
    cubeEdges.forEach(([a, b]) => {
      const pA = projOuter[a];
      const pB = projOuter[b];
      const avgDepth = (pA.scale + pB.scale) * 0.5;
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.strokeStyle = '#8FA187';
      ctx.globalAlpha = Math.max(0.08, Math.min(0.32, (avgDepth - 0.55) * 0.85));
      ctx.lineWidth = avgDepth > 0.76 ? 1.5 : 0.9;
      ctx.stroke();
    });

    const projInner = innerOct.map(v => project3D(v, -rotX * 0.8, -rotY * 1.25, frameCenterX, frameCenterY, frameScale * 0.58));
    octEdges.forEach(([a, b]) => {
      const pA = projInner[a];
      const pB = projInner[b];
      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.strokeStyle = '#CBBBA6';
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    });

    // Project and depth-sort ambient 3D particles across full stage
    const projectedParticles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles[i];
      if (advance) {
        p.x += p.vx;
        p.y += p.vy + Math.sin(phase * 1.5 + i) * 0.0004;
        if (p.x < -1.1 || p.x > 1.1) p.vx *= -1;
        if (p.y < -0.8 || p.y > 0.8) p.vy *= -1;
      }
      const proj = project3D(
        [p.x, p.y, p.z],
        pointerTiltX * 0.4,
        phase * 0.22 + pointerTiltY * 0.4,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.42
      );
      projectedParticles.push({ ...proj, r: p.r, color: p.color, i });
    }

    projectedParticles.sort((a, b) => a.z - b.z);

    for (let i = 0; i < projectedParticles.length; i++) {
      const a = projectedParticles[i];
      const radius = Math.max(1.2, a.r * a.scale);
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = a.color;
      ctx.globalAlpha = Math.max(0.18, Math.min(0.62, a.scale * 0.72));
      ctx.fill();

      for (let j = i + 1; j < projectedParticles.length; j++) {
        const b = projectedParticles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 25600) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = '#8FA187';
          ctx.globalAlpha = (1 - Math.sqrt(distSq) / 160) * 0.24;
          ctx.lineWidth = 0.95;
          ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function tick() {
    rafId = null;
    if (!shouldAnimate()) return;
    drawFrame(true);
    rafId = requestAnimationFrame(tick);
  }

  function shouldAnimate() {
    return !prefersReducedMotion.matches && !document.hidden && !isOffscreen && isHomeActive;
  }

  function syncLoop() {
    if (shouldAnimate()) {
      if (!rafId) {
        rafId = requestAnimationFrame(tick);
      }
    } else {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      drawFrame(false);
    }
  }

  resize();
  drawFrame(false);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }, { passive: true });

  document.addEventListener('visibilitychange', syncLoop);
  prefersReducedMotion.addEventListener('change', syncLoop);

  if ('IntersectionObserver' in window) {
    const heroVisObserver = new IntersectionObserver((entries) => {
      isOffscreen = !entries[0]?.isIntersecting;
      syncLoop();
    }, { threshold: 0.05 });
    heroVisObserver.observe(stage);
  }

  syncLoop();

  return {
    setActiveView(active) {
      isHomeActive = active;
      syncLoop();
    }
  };
}

// ----------------------------------------------------
// Home Scroll Reveal & Active Section Indicator
// ----------------------------------------------------
function initHomeScrollObservers() {
  if (!('IntersectionObserver' in window) || prefersReducedMotion.matches) {
    document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
    return;
  }

  document.documentElement.classList.add('js-reveal-ready');

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.reveal-on-scroll').forEach(sec => revealObserver.observe(sec));

  // Track active section in bottom hero progress nav
  const sectionNavLinks = document.querySelectorAll('#homeSectionNav .section-nav-link');
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const targetId = entry.target.dataset.homeSection;
      sectionNavLinks.forEach(link => {
        const isCurrent = link.dataset.sectionTarget === targetId;
        link.classList.toggle('active', isCurrent);
        if (isCurrent) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    });
  }, { threshold: 0.35 });

  document.querySelectorAll('[data-home-section]').forEach(sec => sectionObserver.observe(sec));
}

// ----------------------------------------------------
// Home Search & Quick Match Finder
// ----------------------------------------------------
function setHeroSuggestionsOpen(isOpen) {
  const container = document.getElementById('homeSearchSuggestions');
  const heroStage = document.getElementById('homeHeroStage');
  if (container) container.classList.toggle('active', Boolean(isOpen));
  if (heroStage) heroStage.classList.toggle('suggestions-open', Boolean(isOpen));
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
  if (sug) sug.innerHTML = '';
  setHeroSuggestionsOpen(false);
}

const finderState = {
  domain: '',
  diff: '',
  cat: ''
};

function matchesDomainGroup(problemDomain, filterDomain) {
  if (!filterDomain) return true;
  if (problemDomain === filterDomain) return true;
  if (filterDomain.startsWith('Smart Mobility') && (problemDomain || '').startsWith('Smart Mobility')) return true;
  if (filterDomain.startsWith('Clean') && (problemDomain || '').startsWith('Clean')) return true;
  return false;
}

function toggleFinderPill(el) {
  const type = el.dataset.finderType;
  const val = el.dataset.val;

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

  if (!state.problems.length) {
    countEl.textContent = '—';
    return;
  }

  const matches = state.problems.filter(p => {
    const matchDomain = matchesDomainGroup(p.domain, finderState.domain);
    const matchDiff = !finderState.diff || (p.difficulty || '').toLowerCase() === finderState.diff.toLowerCase();
    const matchCat = !finderState.cat || (p.category || '').toLowerCase().includes(finderState.cat.toLowerCase()) || (finderState.cat === 'Hardware' && p.category === 'Both') || (finderState.cat === 'Software' && p.category === 'Both');
    return matchDomain && matchDiff && matchCat;
  });

  countEl.textContent = String(matches.length);
}

function applyQuickFinder() {
  state.selectedDomain = finderState.domain === 'Smart Mobility' ? 'Smart Mobility & Transport' : finderState.domain;
  document.querySelectorAll('.domain-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.domain === state.selectedDomain);
  });

  const diffSelect = document.getElementById('difficultyFilter');
  if (diffSelect) diffSelect.value = finderState.diff || '';

  const catSelect = document.getElementById('categoryFilter');
  if (catSelect) catSelect.value = finderState.cat || '';

  switchView('discovery');
  applyFilters();
  showToast(`Showing ${state.filteredProblems.length} matching challenges`);
}

function updateHomeStatsFromBackend() {
  const problemsEl = document.getElementById('statNumberProblems');
  const hackathonsEl = document.getElementById('statNumberHackathons');
  const stackEl = document.getElementById('statNumberStack');
  const checkedEl = document.getElementById('statCatalogChecked');

  if (problemsEl) problemsEl.textContent = state.problems.length ? String(state.problems.length) : '0';
  if (hackathonsEl) hackathonsEl.textContent = state.hackathons.length ? String(state.hackathons.length) : '0';
  if (stackEl) stackEl.textContent = String(state.stack.length);

  if (checkedEl) {
    const dates = state.problems.map(p => p.checked_date).filter(Boolean).sort();
    checkedEl.textContent = dates.length ? dates[dates.length - 1] : 'Not checked';
  }

  // Update per-domain counts dynamically
  document.querySelectorAll('[data-domain-count]').forEach(badge => {
    const target = badge.dataset.domainCount;
    const count = state.problems.filter(p => matchesDomainGroup(p.domain, target)).length;
    badge.textContent = `${count}`;
  });

  // Update Hackathons summary on Home
  const eventsBadge = document.getElementById('homeEventsBadge');
  const eventsSummary = document.getElementById('homeEventsSummary');
  if (eventsBadge) {
    const ongoing = state.hackathons.filter(h => (h.status || '').toLowerCase() === 'ongoing').length;
    eventsBadge.textContent = `${state.hackathons.length} listed events (${ongoing} ongoing)`;
  }
  if (eventsSummary && state.hackathons.length > 0) {
    eventsSummary.textContent = `Compare ${state.hackathons.length} collegiate and national events near ${state.selectedLocation} or online, with IST deadlines and check dates.`;
  }
}

function handleHomeCenterSearch() {
  const homeInput = document.getElementById('homeSearchInput');
  const query = (homeInput?.value || '').trim();
  setHeroSuggestionsOpen(false);
  if (!query) return;

  const discoveryInput = document.getElementById('problemSearchInput');
  if (discoveryInput) discoveryInput.value = query;

  switchView('discovery');
  applyFilters();
}

function handleHomeSearchFocus() {
  const homeInput = document.getElementById('homeSearchInput');
  const q = (homeInput?.value || '').trim();
  if (q.length >= 2) {
    handleHomeSearchInput(q);
    return;
  }
  const container = document.getElementById('homeSearchSuggestions');
  if (!container || state.problems.length === 0) return;

  const starterItems = state.problems.slice(0, 4);
  container.innerHTML = `
    <div class="suggestions-header-row">
      <span>Featured catalog challenges</span>
      <span>Click to inspect</span>
    </div>
    ${starterItems.map(p => `
      <div class="search-suggestion-item" role="option" tabindex="0" onclick="selectHomeSearchSuggestion('${p.id}')" onkeydown="if(event.key==='Enter'){selectHomeSearchSuggestion('${p.id}')}">
        <div>
          <div class="suggestion-title">${escapeHtml(p.title)}</div>
          <div style="font-size:0.74rem; color:var(--text-subtle); margin-top:2px;">
            ${escapeHtml(p.domain)} • ${escapeHtml(p.organization)}
          </div>
        </div>
        <span class="suggestion-badge">${escapeHtml(p.code)}</span>
      </div>
    `).join('')}
  `;
  setHeroSuggestionsOpen(true);
}

function handleHomeSearchInput(val) {
  const clearBtn = document.getElementById('homeSearchClearBtn');
  if (clearBtn) clearBtn.style.display = val ? 'inline-block' : 'none';

  const container = document.getElementById('homeSearchSuggestions');
  if (!container) return;
  const q = (val || '').trim().toLowerCase();
  if (q.length === 0) {
    handleHomeSearchFocus();
    return;
  }
  if (q.length === 1) {
    setHeroSuggestionsOpen(false);
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
      <div style="padding:0.75rem 1rem; color:var(--text-subtle); font-size:0.84rem;">
        No challenges matching "<strong>${escapeHtml(q)}</strong>". Press Enter to view all filters.
      </div>
    `;
    setHeroSuggestionsOpen(true);
    return;
  }

  container.innerHTML = matches.map(p => `
    <div class="search-suggestion-item" role="option" tabindex="0" onclick="selectHomeSearchSuggestion('${p.id}')" onkeydown="if(event.key==='Enter'){selectHomeSearchSuggestion('${p.id}')}">
      <div>
        <div class="suggestion-title">${escapeHtml(p.title)}</div>
        <div style="font-size:0.74rem; color:var(--text-subtle); margin-top:2px;">
          ${escapeHtml(p.domain)} • ${escapeHtml(p.organization)}
        </div>
      </div>
      <span class="suggestion-badge">${escapeHtml(p.code)}</span>
    </div>
  `).join('');
  setHeroSuggestionsOpen(true);
}

function selectHomeSearchSuggestion(problemId) {
  setHeroSuggestionsOpen(false);
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
  const mobileSel = document.getElementById('mobileLocationSelect');
  if (mobileSel) mobileSel.value = newLoc;
  const hubDisplay = document.getElementById('currentHubDisplay');
  if (hubDisplay) hubDisplay.textContent = newLoc;
  updateHomeStatsFromBackend();
  showToast(`Location hub set to ${newLoc}`);

  if (state.activeView === 'hackathons') {
    renderHackathons();
  } else if (state.activeView === 'matchmaker') {
    runPersonalizationMatching();
  }
}

// ----------------------------------------------------
// Optional Milestone Confetti (Accomplished stage only, reduced-motion safe)
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
  window.addEventListener('resize', resize, { passive: true });
}

function triggerConfetti(originX, originY) {
  if (prefersReducedMotion.matches) return;
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas || !confettiCtx) return;

  const x = originX !== undefined ? originX : window.innerWidth / 2;
  const y = originY !== undefined ? originY : window.innerHeight * 0.45;
  const palette = ['#A3B19C', '#DDD0C1', '#263C2D', '#1A5C38', '#FAF9EF'];

  for (let i = 0; i < 42; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 7 + 3;
    confettiParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3.5,
      size: Math.random() * 6 + 4,
      color: palette[i % palette.length],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      opacity: 1,
      gravity: 0.22,
      friction: 0.96
    });
  }

  if (!confettiAnimationId) {
    confettiAnimationId = requestAnimationFrame(renderConfettiLoop);
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
    p.opacity -= 0.016;

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

  if (confettiParticles.length > 0 && !prefersReducedMotion.matches) {
    confettiAnimationId = requestAnimationFrame(renderConfettiLoop);
  } else {
    confettiAnimationId = null;
    confettiCtx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ----------------------------------------------------
// API Calls: Problems & Discovery
// ----------------------------------------------------
async function fetchProblems() {
  try {
    const res = await fetch('/api/problems');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.problems = data.problems || [];
      applyFilters();
      populateDropdowns();
      updateFinderMatchCount();
      updateHomeStatsFromBackend();
      updateHeroFrameFromData();
    }
  } catch (err) {
    console.error('Failed to fetch problems:', err);
    const stream = document.getElementById('problemsStream');
    if (stream) {
      stream.innerHTML = `
        <div style="text-align:center; padding:3rem 1.5rem; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
          <p style="font-weight:700; color:var(--color-danger); margin-bottom:0.4rem;">Unable to load challenges from the local API.</p>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;">Confirm the Python server is running on port 8000 and retry.</p>
          <button type="button" class="btn btn-outline btn-sm" onclick="fetchProblems()">Retry Loading</button>
        </div>
      `;
    }
    const countEl = document.getElementById('resultsCount');
    if (countEl) countEl.textContent = 'API unavailable';
    showToast('Could not reach /api/problems', 'error');
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

  if (stream) stream.classList.toggle('grid-mode', mode === 'grid');
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
    const textCorpus = `${p.title} ${p.code} ${p.summary} ${p.organization} ${(p.required_skills || []).join(' ')} ${p.affected_group}`.toLowerCase();
    const matchesQuery = !query || textCorpus.includes(query);

    const matchesDomain = matchesDomainGroup(p.domain, domain);
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
  }, 160);
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

function isExamplePlaceholderUrl(url) {
  if (!url) return true;
  return url.includes('example.com') || url.includes('example.org') || url.includes('github.com/example/');
}

// ----------------------------------------------------
// Problem Stream Rendering (Clear Hierarchy, Honest Evidence Labels)
// ----------------------------------------------------
function getHackathonHeaderLabel(prob) {
  const code = (prob.code || '').toUpperCase();
  const org = (prob.organization || '').trim();
  if (code.startsWith('SIH')) return `SIH • ${code}`;
  if (code.startsWith('SH')) return `Shaastra IIT-M • ${code}`;
  if (code.startsWith('BF')) return `BuildersFrame Curated • ${code}`;
  return org ? `${org} • ${code}` : code;
}

function renderProblemsGrid() {
  const stream = document.getElementById('problemsStream');
  if (!stream) return;

  if (state.filteredProblems.length === 0) {
    stream.innerHTML = `
      <div style="text-align: center; padding: 3.5rem 1.5rem; color: var(--text-subtle); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
        <p style="font-size: 1.02rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">No challenges match these filters.</p>
        <p style="font-size: 0.85rem; margin-bottom: 1rem;">Clear your search keywords or switch back to All Challenges.</p>
        <button type="button" class="btn btn-outline btn-sm" onclick="resetFilters()">Reset All Filters</button>
      </div>
    `;
    return;
  }

  stream.innerHTML = state.filteredProblems.map((p, idx) => {
    const floatDelay = ((idx % 5) * 0.45).toFixed(2);
    const headerLabel = getHackathonHeaderLabel(p);

    return `
      <article class="f-problem-card card-3d-float motion-fade-up" data-id="${p.id}" role="button" tabindex="0" aria-label="Preview ${escapeHtml(p.code)}: ${escapeHtml(p.title)}" onclick="openProblemDossier('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProblemDossier('${p.id}')}" style="animation-delay: ${Math.min(idx, 6) * 35}ms; --float-delay: ${floatDelay}s;">
        <div class="card-minimal-meta">
          <span class="card-hackathon-header">${escapeHtml(headerLabel)}</span>
          <span class="f-skill-chip difficulty" title="Capability level">${escapeHtml(p.difficulty)}</span>
        </div>

        <h3 class="f-card-title" style="margin:0;">${escapeHtml(p.title)}</h3>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
          <span class="card-minimal-source">${escapeHtml(p.organization)}</span>
          <span class="card-click-cue" aria-hidden="true">Click to preview →</span>
        </div>
      </article>
    `;
  }).join('');
}

// ----------------------------------------------------
// Explainable Skill Matchmaker
// ----------------------------------------------------
function renderSkillsPicker() {
  const container = document.getElementById('skillsPicker');
  if (!container) return;

  container.innerHTML = state.availableSkillsList.map(skill => {
    const isSelected = state.studentProfile.skills.includes(skill);
    return `
      <button type="button" class="skill-selectable ${isSelected ? 'selected' : ''}" aria-pressed="${isSelected}" onclick="toggleSkillSelection('${skill}')">
        ${escapeHtml(skill)}
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
  const runBtns = [
    document.getElementById('matchRunBtn'),
    document.getElementById('matchRunBtnTop'),
    document.getElementById('matchRunBtnResultsTop')
  ].filter(Boolean);
  runBtns.forEach(b => { b.disabled = true; });

  const selectedDomains = [];
  document.querySelectorAll('#domainCheckboxGroup input[type="checkbox"]:checked').forEach(cb => {
    selectedDomains.push(cb.value);
  });
  state.studentProfile.domains = selectedDomains;
  state.studentProfile.teamSize = parseInt(document.getElementById('teamSizeSelect')?.value || '4', 10);
  state.studentProfile.location = state.selectedLocation;

  try {
    const res = await fetch('/api/recommendations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.studentProfile,
        team_size: state.studentProfile.teamSize,
        save_profile: Boolean(state.currentUser)
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status === 'success') {
      renderRankedRecommendations(data.ranked_problems);
      if (state.currentUser) {
        showToast('Calculated fit and synced profile preferences');
      }
    }
  } catch (err) {
    console.error('Matching failed:', err);
    showToast('Failed to calculate skill matches', 'error');
  } finally {
    runBtns.forEach(b => { b.disabled = false; });
  }
}

function renderRankedRecommendations(rankedProblems) {
  const container = document.getElementById('rankedProblemsList');
  if (!container) return;

  if (!rankedProblems || rankedProblems.length === 0) {
    container.innerHTML = `<p style="color:var(--text-subtle);">No matching problems found.</p>`;
    return;
  }

  state.matchScoresById = {};
  rankedProblems.forEach(p => {
    if (p && p.id && p.personalization) {
      state.matchScoresById[p.id] = p.personalization;
    }
  });

  container.innerHTML = rankedProblems.slice(0, 6).map((p, idx) => {
    const m = p.personalization || {};
    const score = m.match_score || 50;
    const floatDelay = ((idx % 4) * 0.5).toFixed(2);
    const headerLabel = getHackathonHeaderLabel(p);

    return `
      <article class="match-card card-3d-float motion-fade-up" data-id="${p.id}" role="button" tabindex="0" aria-label="Preview ${escapeHtml(p.code)} (${score}/100 Fit): ${escapeHtml(p.title)}" onclick="openProblemDossier('${p.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openProblemDossier('${p.id}')}" style="animation-delay: ${Math.min(idx, 5) * 45}ms; --float-delay: ${floatDelay}s;">
        <div class="match-header-row" style="margin-bottom:0;">
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.45rem; flex-wrap:wrap;">
              <span class="card-hackathon-header">${escapeHtml(headerLabel)}</span>
              <span class="tag-pill difficulty" title="Capability level">${escapeHtml(p.difficulty)}</span>
            </div>
            <h3 style="font-size:1.05rem; margin:0 0 0.4rem 0;">${escapeHtml(p.title)}</h3>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
              <span class="card-minimal-source">${escapeHtml(p.organization)}</span>
              <span class="card-click-cue" aria-hidden="true">Click to preview →</span>
            </div>
          </div>

          <div class="match-score-badge" title="${escapeHtml(m.scoring_method || 'Weighted heuristic score')}">
            <span>${score}/100</span>
            <span style="font-size:0.66rem; font-weight:600;">Fit Index</span>
            <div class="fit-meter-track" aria-hidden="true">
              <div class="fit-meter-fill" style="--fit-pct: ${Math.min(100, Math.max(0, score))}%;"></div>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// ----------------------------------------------------
// My Problem Stack (Kanban Tracker)
// ----------------------------------------------------
async function fetchUserStack() {
  try {
    const res = await fetch('/api/stack?user_id=student-local-session');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.stack = data.stack || [];
      updateStackBadge();
      updateHomeStatsFromBackend();
      if (state.activeView === 'stack') {
        renderKanbanBoard();
      }
    }
  } catch (err) {
    console.error('Failed to fetch stack:', err);
  }
}

function updateStackBadge() {
  const count = String(state.stack.length);
  const badge = document.getElementById('stackCountBadge');
  const mobileBadge = document.getElementById('mobileStackBadge');
  if (badge) badge.textContent = count;
  if (mobileBadge) mobileBadge.textContent = count;
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
      if (stage === 'accomplished') {
        triggerConfetti();
      }
      showToast(`Challenge saved to '${stage}' stage`);
      await fetchUserStack();
      renderProblemsGrid();
    }
  } catch (err) {
    showToast('Failed to update stack', 'error');
  }
}

function setStackStageFilter(stage) {
  state.activeStackFilter = stage || 'all';
  document.querySelectorAll('#stackStageFilterBar [data-stack-filter]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stackFilter === state.activeStackFilter);
  });
  renderKanbanBoard();
}

function renderKanbanBoard() {
  const stages = ['exploring', 'validating', 'building', 'accomplished'];
  const counts = { exploring: 0, validating: 0, building: 0, accomplished: 0 };
  const board = document.getElementById('stackKanbanBoard');

  stages.forEach(s => {
    const colBody = document.getElementById(`cards${capitalize(s)}`);
    if (colBody) colBody.innerHTML = '';
  });

  state.stack.forEach((item, idx) => {
    const stage = (item.stage || 'exploring').toLowerCase();
    if (counts[stage] !== undefined) counts[stage]++;

    const colBody = document.getElementById(`cards${capitalize(stage)}`);
    if (!colBody) return;

    const prob = state.problems.find(p => p.id === item.problem_id) || item;
    const headerLabel = getHackathonHeaderLabel(prob);
    const difficulty = prob.difficulty || item.difficulty || 'Intermediate';
    const floatDelay = ((idx % 4) * 0.45).toFixed(2);

    const card = document.createElement('article');
    card.className = 'kanban-card card-3d-float motion-fade-up';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Preview ${item.code}: ${item.title}`);
    card.style.cssText = `animation-delay: ${Math.min(idx, 5) * 35}ms; --float-delay: ${floatDelay}s;`;
    card.onclick = () => openProblemDossier(item.problem_id);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openProblemDossier(item.problem_id);
      }
    };

    card.innerHTML = `
      <div class="card-minimal-meta">
        <span class="card-hackathon-header">${escapeHtml(headerLabel)}</span>
        <span class="f-skill-chip difficulty" title="Capability level">${escapeHtml(difficulty)}</span>
      </div>

      <h4 class="kanban-card-title">${escapeHtml(item.title)}</h4>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
        <span class="card-minimal-source">${escapeHtml(item.organization)}</span>
        <span class="card-click-cue" aria-hidden="true">Preview →</span>
      </div>
    `;

    colBody.appendChild(card);
  });

  const nonEmptyStages = stages.filter(s => counts[s] > 0);
  const useSingleStageGrid =
    state.activeStackFilter !== 'all' || nonEmptyStages.length === 1;

  if (board) {
    board.classList.toggle('single-stage-mode', useSingleStageGrid);
  }

  stages.forEach(s => {
    const countEl = document.getElementById(`count${capitalize(s)}`);
    if (countEl) countEl.textContent = counts[s];

    const pillCountEl = document.getElementById(`pillCount${capitalize(s)}`);
    if (pillCountEl) pillCountEl.textContent = counts[s];

    const colEl = document.getElementById(`col${capitalize(s)}`);
    const colBody = document.getElementById(`cards${capitalize(s)}`);
    if (!colEl || !colBody) return;

    if (useSingleStageGrid) {
      const targetStage = state.activeStackFilter !== 'all' ? state.activeStackFilter : nonEmptyStages[0];
      colEl.hidden = s !== targetStage;
    } else {
      colEl.hidden = false;
    }

    if (counts[s] === 0 && !colEl.hidden) {
      colBody.innerHTML = `
        <div class="kanban-empty-state">
          No challenges in ${capitalize(s)} yet.
        </div>
      `;
    }
  });
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
// Hackathons Radar
// ----------------------------------------------------
async function fetchHackathons() {
  try {
    const res = await fetch('/api/hackathons?location=all');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.hackathons = data.hackathons || [];
      populateDropdowns();
      updateHomeStatsFromBackend();
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
      matchesRegion = h.region === 'Tamil Nadu' || (h.location || '').toLowerCase().includes('tamil nadu');
    } else if (regionFilter !== 'All') {
      matchesRegion = h.region === regionFilter;
    }
    const matchesFormat = !formatFilter || h.format === formatFilter;
    return matchesRegion && matchesFormat;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-subtle); grid-column:1/-1; text-align:center;">No hackathons match this filter.</p>`;
    return;
  }

  grid.innerHTML = filtered.map((h, idx) => {
    const isOngoing = (h.status || '').toLowerCase() === 'ongoing';
    const isClosed = (h.status || '').toLowerCase() === 'closed';
    const hLocLower = `${h.location} ${h.city || ''} ${h.region || ''}`.toLowerCase();
    const isLocal = userLoc.split(',')[0].trim().length > 2 && hLocLower.includes(userLoc.split(',')[0].trim().toLowerCase());

    const isUnverified = (h.verification_status || '').toLowerCase().includes('unverified') ||
                         (h.badge || '').toLowerCase().includes('community submitted') ||
                         (h.official_url || '').includes('localhost');

    const statusBadgeText = isUnverified ? 'Community Listing (Unverified)' : (h.verification_status || 'Portal Link Listed');
    const statusBadgeColor = isUnverified ? 'var(--color-warning)' : 'var(--color-success)';

    const mirrorBtn = h.fallback_url ? `
      <a href="${h.fallback_url}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-sm">
        Mirror ↗
      </a>
    ` : '';

    return `
      <article class="hackathon-card motion-fade-up ${isLocal ? 'local-priority' : ''}" style="${isClosed ? 'opacity:0.75;' : ''} animation-delay: ${Math.min(idx, 6) * 35}ms;">
        <div class="hackathon-badge-row">
          <div style="display:flex; align-items:center; gap:0.45rem; flex-wrap:wrap;">
            <span class="status-badge ${isOngoing ? 'ongoing' : (isClosed ? 'closed' : 'upcoming')}">${escapeHtml(h.status)}</span>
            <span style="font-size:0.72rem; color:${statusBadgeColor}; font-weight:700;">
              ${escapeHtml(statusBadgeText)}
            </span>
          </div>
          <span class="principle-tag">${escapeHtml(h.badge || 'Collegiate')}</span>
        </div>

        <h3 class="hackathon-name">${escapeHtml(h.name)}</h3>
        <p class="hackathon-organizer">Organizer: ${escapeHtml(h.organizer)} • Checked ${escapeHtml(h.checked_date || 'N/A')}</p>

        <div class="countdown-box">
          <span>Deadline (IST):</span>
          <strong class="countdown-timer" data-deadline="${escapeHtml(h.registration_deadline)}">Calculating...</strong>
        </div>

        <div class="hackathon-info-grid">
          <div class="info-item">
            <label>Dates</label>
            <span>${escapeHtml(h.dates || 'See portal')}</span>
          </div>
          <div class="info-item">
            <label>Format &amp; Location</label>
            <span>${escapeHtml(h.format)} • ${escapeHtml(h.city || h.region)}</span>
          </div>
          <div class="info-item">
            <label>Team Size</label>
            <span>${escapeHtml(h.team_size || '2 to 5 members')}</span>
          </div>
          <div class="info-item">
            <label>Awards / Grants</label>
            <span style="color:var(--color-success);">${escapeHtml(h.prize_pool || 'See portal')}</span>
          </div>
        </div>

        <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem; flex:1;">
          ${escapeHtml(h.description || 'Check the organizer portal for full rules and eligibility.')}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; border-top:1px solid var(--border-subtle); padding-top:0.85rem; flex-wrap:wrap;">
          <div style="display:flex; gap:0.4rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="filterProblemsForHackathon('${h.id}')">
              Related Problems
            </button>
            <button type="button" class="btn btn-outline btn-sm" onclick="openReportHackathonModal('${h.id}', '${escapeHtml(h.name)}')">
              Report Link
            </button>
          </div>

          <div style="display:flex; gap:0.4rem;">
            ${mirrorBtn}
            <a href="${escapeHtml(h.official_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              Official Portal ↗
            </a>
          </div>
        </div>
      </article>
    `;
  }).join('');

  updateCountdownValues();
}

function filterProblemsForHackathon(hackathonId) {
  const hack = state.hackathons.find(h => h.id === hackathonId);
  if (!hack) return;

  switchView('discovery');

  const matchedIds = hack.matched_problem_ids || [];
  if (matchedIds.length > 0) {
    state.selectedDomain = '';
    document.querySelectorAll('.domain-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.domain === '');
    });
    const searchInput = document.getElementById('problemSearchInput');
    if (searchInput) searchInput.value = '';
    state.filteredProblems = state.problems.filter(p => matchedIds.includes(p.id));
    renderProblemsGrid();
    updateResultsCount();
    showToast(`Showing ${state.filteredProblems.length} challenges linked to ${hack.name}`);
  } else {
    selectDomainPill('');
    showToast(`Showing challenges for ${hack.name}`);
  }
}

function updateCountdownValues() {
  document.querySelectorAll('.countdown-timer').forEach(el => {
    const deadlineStr = el.dataset.deadline;
    if (!deadlineStr) return;
    const deadline = new Date(deadlineStr).getTime();
    if (Number.isNaN(deadline)) {
      el.textContent = deadlineStr;
      return;
    }
    const distance = deadline - Date.now();
    if (distance < 0) {
      el.textContent = 'Registration Closed';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    el.textContent = `${days}d ${hours}h ${minutes}m left`;
  });
}

function startCountdownTimer() {
  updateCountdownValues();
  if (countdownTimerId) clearInterval(countdownTimerId);
  countdownTimerId = setInterval(updateCountdownValues, 15000);
}

// ----------------------------------------------------
// Community Discussion Rooms
// ----------------------------------------------------
function renderCommunitySidebar() {
  const container = document.getElementById('communityRoomsList');
  if (!container) return;

  container.innerHTML = state.problems.map(p => {
    const isActive = p.id === state.activeCommunityProblemId;
    return `
      <div class="community-room-item ${isActive ? 'active' : ''}" role="button" tabindex="0" onclick="loadCommunityRoom('${p.id}')" onkeydown="if(event.key==='Enter'){loadCommunityRoom('${p.id}')}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.2rem;">
          <span class="problem-code-badge" style="font-size:0.68rem;">${escapeHtml(p.code)}</span>
          <span style="font-size:0.7rem; color:var(--text-subtle);">${escapeHtml(p.category)}</span>
        </div>
        <div style="font-size:0.84rem; font-weight:600; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
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
    if (titleEl) titleEl.textContent = `${prob.code} — ${prob.title}`;
    if (codeEl) codeEl.textContent = `${prob.domain} • Peer Notes & Questions`;
  }

  try {
    const res = await fetch(`/api/community/${problemId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.communityMessages[problemId] = data.messages || [];
      renderRoomMessages(state.communityMessages[problemId]);
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
        <p style="font-weight:600; color:var(--text-main);">No notes yet in this problem room.</p>
        <p style="font-size:0.82rem; margin-top:0.35rem;">Share a dataset link, scope question, or hardware setup tip.</p>
      </div>
    `;
    return;
  }

  stream.innerHTML = messages.map(msg => {
    const isVerified = msg.is_verified_hint === 1;

    let typeTag = '';
    if (msg.message_type === 'solution_hint') typeTag = '<span style="color:var(--color-success); font-weight:700;">Solution Hint</span>';
    else if (msg.message_type === 'question') typeTag = '<span style="color:#1D4ED8; font-weight:700;">Question</span>';
    else if (msg.message_type === 'resource') typeTag = '<span style="color:var(--color-warning); font-weight:700;">Dataset / Link</span>';
    else typeTag = '<span style="color:var(--text-muted); font-weight:700;">Discussion</span>';

    return `
      <div class="chat-msg-card ${isVerified ? 'verified-hint' : ''}">
        <div class="msg-author-row">
          <div>
            <span class="msg-author-name">${escapeHtml(msg.author_name)}</span>
            <span class="msg-author-badge"> • ${escapeHtml(msg.author_college || 'Student')} (${escapeHtml(msg.author_level)})</span>
          </div>
          <div>${typeTag}</div>
        </div>

        <div class="msg-text">${escapeHtml(msg.content)}</div>

        <div class="msg-footer">
          <span>${escapeHtml(msg.created_at || 'Recently')}</span>
          <button type="button" class="btn btn-outline btn-sm" style="padding:0.2rem 0.55rem; font-size:0.74rem;" onclick="upvoteMessage(${msg.id})">
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
        author_name: state.currentUser?.full_name || 'Student Builder (Local Session)',
        author_college: state.currentUser?.college || state.selectedLocation,
        author_level: state.studentProfile.level,
        message_type: msgType,
        content: content
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      input.value = '';
      showToast('Note posted to room');
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      state.collaborationPosts = data.collaboration_posts || [];
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
        <button type="button" class="btn btn-primary btn-sm" style="margin-top:0.5rem;" onclick="openCreateTeamModal()">+ Post Team Opening</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.collaborationPosts.map((post, idx) => {
    const skillsHtml = (post.looking_for_skills || []).map(s => `
      <span class="tag-pill">${escapeHtml(s)}</span>
    `).join('');

    return `
      <article class="collab-card motion-fade-up" style="animation-delay: ${Math.min(idx, 6) * 35}ms;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem; margin-bottom:0.5rem;">
          <div>
            <h3 style="font-size:1.08rem;">${escapeHtml(post.team_name)}</h3>
            <span style="font-size:0.78rem; color:var(--text-subtle);">Lead: ${escapeHtml(post.lead_name)} • ${escapeHtml(post.lead_college)}</span>
          </div>
          <span class="principle-tag">${post.current_members}/${post.max_members} members</span>
        </div>

        <div style="background:var(--bg-surface-subtle); padding:0.55rem 0.75rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin:0.5rem 0; font-size:0.82rem;">
          <div><strong>Challenge:</strong> ${escapeHtml(post.problem_title || 'Open Challenge')}</div>
          <div><strong>Target Event:</strong> ${escapeHtml(post.hackathon_name || 'Collegiate Hackathon')}</div>
        </div>

        <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.55; margin-bottom:0.85rem; flex:1;">
          ${escapeHtml(post.description)}
        </p>

        <div style="margin-bottom:1rem;">
          <label style="display:block; font-size:0.74rem; color:var(--text-subtle); font-weight:700; margin-bottom:0.35rem;">Looking for skills:</label>
          <div style="display:flex; flex-wrap:wrap; gap:0.35rem;">
            ${skillsHtml}
          </div>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding-top:0.75rem; border-top:1px solid var(--border-subtle); flex-wrap:wrap;">
          <span style="font-size:0.76rem; color:var(--text-subtle);">Contact: ${escapeHtml(post.contact_handle)}</span>
          <a href="mailto:${escapeHtml(post.contact_handle)}?subject=Connecting%20for%20Hackathon%20Team%20${encodeURIComponent(post.team_name)}" class="btn btn-primary btn-sm">
            Connect ↗
          </a>
        </div>
      </article>
    `;
  }).join('');
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

  const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

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
      showToast('Team opening published');
      closeModal('teamModal');
      await fetchCollaborationPosts();
      switchView('collaboration');
    }
  } catch (err) {
    showToast('Failed to publish team opening', 'error');
  }
}

// ----------------------------------------------------
// Template-Guided Research & Build Planner Drawer
// ----------------------------------------------------
async function openAgentResearch(problemId) {
  state.activeProblemId = problemId;
  const prob = state.problems.find(p => p.id === problemId);
  const codeEl = document.getElementById('agentDrawerProblemCode');
  if (codeEl && prob) codeEl.textContent = `${prob.code} — ${prob.title}`;

  const overlay = document.getElementById('agentDrawerOverlay');
  const panel = document.getElementById('agentDrawerPanel');
  if (overlay) overlay.classList.add('active');
  if (panel) panel.classList.add('open');

  const content = document.getElementById('agentDrawerContent');
  if (content) {
    content.innerHTML = `
      <div style="text-align:center; padding:3rem 1rem; color:var(--text-subtle);">
        <p style="font-size:1rem; font-weight:700; color:var(--text-main);">Loading starter plan...</p>
        <p style="font-size:0.84rem; margin-top:0.35rem;">Preparing domain template, validation questions, and milestone checklist.</p>
      </div>
    `;
  }

  try {
    const res = await fetch('/api/ai-agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem_id: problemId,
        student_profile: {
          ...state.studentProfile,
          team_size: state.studentProfile.teamSize
        }
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.status === 'success') {
      renderAgentReport(data.research_report);
    }
  } catch (err) {
    if (content) {
      content.innerHTML = `<p style="color:var(--color-danger);">Unable to load starter planner from /api/ai-agent/analyze.</p>`;
    }
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

  const roadmapHtml = (r.hackathon_roadmap || []).map(phase => `
    <div style="margin-bottom:0.85rem; background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); padding:0.85rem; border-radius:var(--radius-sm);">
      <strong style="color:var(--text-main); font-size:0.86rem; display:block; margin-bottom:0.35rem;">${escapeHtml(phase.phase)}</strong>
      <ul style="margin-left:1.25rem; font-size:0.82rem; color:var(--text-muted); margin-bottom:0;">
        ${phase.tasks.map(t => `<li style="margin-bottom:0.2rem;">${escapeHtml(t)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  const interviewHtml = (r.interview_prompts || []).map((p, i) => `
    <li style="margin-bottom:0.45rem; font-size:0.83rem; color:var(--text-muted);">
      <strong>Q${i + 1}:</strong> ${escapeHtml(p)}
    </li>
  `).join('');

  const judgeHtml = (r.judge_prep || []).map(j => `
    <div style="margin-bottom:0.7rem; background:var(--color-warning-soft); border:1px solid rgba(124, 74, 3, 0.25); padding:0.75rem; border-radius:var(--radius-sm); font-size:0.82rem;">
      <strong style="color:var(--color-warning);">Likely Question: "${escapeHtml(j.question)}"</strong>
      <div style="margin-top:0.25rem; color:var(--text-main);"><strong>Suggested Angle:</strong> ${escapeHtml(j.defense)}</div>
    </div>
  `).join('');

  const pt = r.profile_tailoring || null;
  const profileTailoringHtml = pt ? `
    <div class="profile-tailoring-box">
      <div style="font-weight:700; margin-bottom:0.25rem;">Tailored to Your Builder Profile (${escapeHtml(pt.user_level || 'Student')} • Squad of ${escapeHtml(String(pt.team_size || 4))})</div>
      <div style="color:var(--text-muted); margin-bottom:0.25rem;">${escapeHtml(pt.coverage_note || '')}</div>
      ${pt.team_split ? `<div style="font-size:0.78rem; color:var(--text-main);"><strong>Suggested split:</strong> ${escapeHtml(pt.team_split)}</div>` : ''}
    </div>
  ` : '';

  content.innerHTML = `
    <div class="prose">
      ${profileTailoringHtml}
      <div style="background:var(--color-primary-soft); border:1px solid var(--border-sage); border-radius:var(--radius-sm); padding:0.85rem 1rem; margin-bottom:1.15rem;">
        <h4 style="color:var(--text-main); font-size:0.88rem; margin-bottom:0.25rem;">Suggested Starting Direction (Template-Guided)</h4>
        <p style="color:var(--text-muted); font-size:0.84rem; margin:0;">${escapeHtml(r.breakthrough_advantage)}</p>
      </div>

      <h3>1. Suggested Starter Architecture</h3>
      <table style="width:100%; border-collapse:collapse; font-size:0.82rem; margin-bottom:1.15rem;">
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.45rem 0.4rem; font-weight:700; width:130px; color:var(--text-main);">Client Tier</td><td style="padding:0.45rem 0.4rem; color:var(--text-muted);">${escapeHtml(arch.client_tier || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.45rem 0.4rem; font-weight:700; color:var(--text-main);">Edge / ML Tier</td><td style="padding:0.45rem 0.4rem; color:var(--text-muted);">${escapeHtml(arch.edge_ml || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.45rem 0.4rem; font-weight:700; color:var(--text-main);">Backend &amp; DB</td><td style="padding:0.45rem 0.4rem; color:var(--text-muted);">${escapeHtml(arch.backend_db || 'N/A')}</td></tr>
        <tr style="border-bottom:1px solid var(--border-subtle);"><td style="padding:0.45rem 0.4rem; font-weight:700; color:var(--text-main);">Hardware Notes</td><td style="padding:0.45rem 0.4rem; color:var(--text-muted);">${escapeHtml(arch.hardware_bom || 'Software only')}</td></tr>
        <tr><td style="padding:0.45rem 0.4rem; font-weight:700; color:var(--text-main);">Data / APIs</td><td style="padding:0.45rem 0.4rem; color:var(--text-muted);">${escapeHtml(arch.key_apis || 'Public datasets')}</td></tr>
      </table>

      <h3>2. Phased Sprint Checklist</h3>
      <p style="font-size:0.8rem; color:var(--text-subtle);">Suggested milestones to keep scope bounded to one working loop:</p>
      ${roadmapHtml}

      <h3>3. Field Validation Prompts</h3>
      <p style="font-size:0.8rem; color:var(--text-subtle);">Questions to check with affected users or mentors before building:</p>
      <ol style="margin-left:1.25rem;">
        ${interviewHtml}
      </ol>

      <h3 style="margin-top:1.15rem;">4. Review &amp; Q&amp;A Prep</h3>
      ${judgeHtml}

      <div id="agentChatThread" style="margin-top:1.35rem; border-top:1px dashed var(--border-medium); padding-top:1rem;"></div>
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
    userBubble.style.cssText = 'background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); margin-bottom:0.7rem; font-size:0.85rem;';
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
        message: userMsg,
        student_profile: {
          ...state.studentProfile,
          team_size: state.studentProfile.teamSize
        }
      })
    });
    const data = await res.json();
    if (data.status === 'success' && chatThread) {
      const agentBubble = document.createElement('div');
      agentBubble.style.cssText = 'background:var(--bg-surface); border:1px solid var(--border-subtle); padding:0.85rem 1rem; border-radius:var(--radius-sm); margin-bottom:0.85rem; font-size:0.85rem; border-left:3px solid var(--color-primary);';
      agentBubble.innerHTML = `
        <div style="font-size:0.74rem; color:var(--color-primary); font-weight:700; margin-bottom:0.25rem;">Template Guide</div>
        <div class="prose">${escapeHtml(data.agent_response).replace(/\n/g, '<br>')}</div>
      `;
      chatThread.appendChild(agentBubble);
      agentBubble.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    }
  } catch (err) {
    showToast('Planner request failed', 'error');
  }
}

// ----------------------------------------------------
// Problem Dossier Modal (Honest Source & Prototype Separation)
// ----------------------------------------------------
function safeExternalUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  return '#';
}

function openProblemDossier(problemId) {
  const prob = state.problems.find(p => p.id === problemId);
  if (!prob) return;

  document.getElementById('modalDossierCode').textContent = prob.code;
  document.getElementById('modalDossierTitle').textContent = prob.title;

  const body = document.getElementById('modalDossierBody');
  if (body) {
    let protosHtml = '<p style="color:var(--text-subtle);">No earlier attempt notes recorded for this problem.</p>';
    if (prob.previous_prototypes && prob.previous_prototypes.length > 0) {
      protosHtml = prob.previous_prototypes.map(pt => {
        const hasRealRepo = pt.repo_url && !isExamplePlaceholderUrl(pt.repo_url) && safeExternalUrl(pt.repo_url) !== '#';
        const repoBadge = hasRealRepo
          ? `<a href="${escapeHtml(safeExternalUrl(pt.repo_url))}" target="_blank" rel="noopener noreferrer" style="font-weight:700;">Reference Repo ↗</a>`
          : `<span style="font-size:0.74rem; color:var(--text-subtle); font-weight:500;">Curated summary note (no public repo linked)</span>`;

        return `
          <div style="background:var(--bg-surface-subtle); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:0.75rem 1rem; margin-bottom:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; flex-wrap:wrap; font-size:0.84rem; font-weight:700; color:var(--text-main);">
              <span>${escapeHtml(pt.team_name)} (${escapeHtml(pt.year)})</span>
              ${repoBadge}
            </div>
            <p style="font-size:0.82rem; color:var(--text-muted); margin:0.35rem 0;">${escapeHtml(pt.prototype_summary)}</p>
            <div style="font-size:0.79rem; color:var(--color-danger); background:var(--color-danger-soft); padding:0.35rem 0.55rem; border-radius:4px;">
              <strong>Reported limitation:</strong> ${escapeHtml(pt.shortcoming)}
            </div>
          </div>
        `;
      }).join('');
    }

    const sourcesHtml = (prob.sources || []).map(s => {
      const safeHref = safeExternalUrl(s.url);
      const linkHtml = safeHref !== '#'
        ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.name)}</a>`
        : `<span>${escapeHtml(s.name)}</span>`;
      return `
        <li>
          ${linkHtml}
          <span style="font-size:0.76rem; color:var(--text-subtle);"> (Listed check date: ${escapeHtml(s.checked_date || prob.checked_date)})</span>
        </li>
      `;
    }).join('');

    const skillsHtml = (prob.required_skills || []).map(s => `<span class="f-skill-chip">${escapeHtml(s)}</span>`).join('');

    const m = state.matchScoresById[prob.id] || null;
    const stackItem = state.stack.find(s => s.problem_id === prob.id) || null;
    let stackPreviewHtml = '';
    if (stackItem) {
      const stage = (stackItem.stage || 'exploring').toLowerCase();
      stackPreviewHtml = `
        <div class="fit-breakdown-box" style="margin-top:0; margin-bottom:1rem; display:flex; align-items:center; justify-content:space-between; gap:0.75rem; flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
            <strong>In My Stack:</strong>
            <select class="filter-select" style="font-size:0.78rem; padding:0.25rem 0.5rem;" aria-label="Change stage for ${escapeHtml(prob.code)}" onchange="handleQuickStackChange('${prob.id}', this.value)">
              <option value="exploring" ${stage === 'exploring' ? 'selected' : ''}>1. Exploring</option>
              <option value="validating" ${stage === 'validating' ? 'selected' : ''}>2. Validating</option>
              <option value="building" ${stage === 'building' ? 'selected' : ''}>3. Building</option>
              <option value="accomplished" ${stage === 'accomplished' ? 'selected' : ''}>4. Accomplished</option>
            </select>
          </div>
          <div style="display:flex; gap:0.45rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-soft btn-sm" onclick="closeModal('dossierModal'); generateProjectBrief('${prob.id}');">Export Brief</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="removeProblemFromStack('${prob.id}'); closeModal('dossierModal');">Remove from Stack</button>
          </div>
        </div>
      `;
    }

    let matchPreviewHtml = '';
    if (m) {
      const bd = m.score_breakdown || {};
      const matched = m.matched_skills || [];
      const aliasMatched = m.alias_matched_skills || [];
      const missing = m.missing_skills || [];
      const reasonsHtml = (m.fit_reasons || []).map(r => `<div class="fit-reason-item"><span>✓</span><span>${escapeHtml(r)}</span></div>`).join('');
      const cautionsHtml = (m.cautions || []).map(c => `<div class="caution-item"><span>!</span><span>${escapeHtml(c)}</span></div>`).join('');
      const hackLink = (m.recommended_hackathons && m.recommended_hackathons[0])
        ? `<div style="margin-top:0.45rem; font-size:0.78rem; color:var(--text-main);"><strong>Related Event:</strong> ${escapeHtml(m.recommended_hackathons[0].name)} (${escapeHtml(m.recommended_hackathons[0].format)})</div>`
        : '';

      matchPreviewHtml = `
        <div class="fit-breakdown-box" style="margin-top:0; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem; margin-bottom:0.45rem;">
            <span class="fit-breakdown-title" style="margin:0;">Why this ranked here (Fit Index ${escapeHtml(String(m.match_score || 0))}/100)</span>
          </div>
          <div class="score-breakdown-row" aria-label="Score components">
            <span class="score-chip">Base ${bd.baseline ?? 30}</span>
            <span class="score-chip positive">Skills +${bd.skill_overlap ?? 0}</span>
            <span class="score-chip ${bd.level_fit >= 12 ? 'positive' : ''}">Level +${bd.level_fit ?? 0}</span>
            <span class="score-chip ${bd.domain_fit > 0 ? 'positive' : ''}">Domain +${bd.domain_fit ?? 0}</span>
            ${bd.team_readiness !== undefined ? `<span class="score-chip ${bd.team_readiness >= 0 ? 'positive' : 'caution'}">Team ${bd.team_readiness >= 0 ? '+' : ''}${bd.team_readiness}</span>` : ''}
            ${bd.stack_synergy ? `<span class="score-chip ${bd.stack_synergy >= 0 ? 'positive' : 'caution'}">Stack ${bd.stack_synergy >= 0 ? '+' : ''}${bd.stack_synergy}</span>` : ''}
            ${bd.event_proximity ? `<span class="score-chip positive">Nearby +${bd.event_proximity}</span>` : ''}
          </div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.45rem;">
            <strong>Overlapping skills:</strong> ${matched.length ? escapeHtml(matched.join(', ')) : 'None directly'}
            ${aliasMatched.length ? ` • <strong>Related:</strong> ${escapeHtml(aliasMatched.join(', '))}` : ''}
            • <strong>Gaps / teammates needed:</strong> ${missing.length ? escapeHtml(missing.join(', ')) : 'None'}
          </div>
          ${reasonsHtml}
          ${cautionsHtml}
          ${hackLink}
        </div>
      `;
    }

    body.innerHTML = `
      ${stackPreviewHtml}
      ${matchPreviewHtml}
      <h3>Originating Organization &amp; Capability Level</h3>
      <p><strong>${escapeHtml(prob.organization)}</strong> • Domain: ${escapeHtml(prob.domain)} • Category: ${escapeHtml(prob.category)} • Capability Level: <strong>${escapeHtml(prob.difficulty)}</strong> • Checked: ${escapeHtml(prob.checked_date || 'N/A')}</p>

      <h3>Problem Summary &amp; Required Skills</h3>
      <p>${escapeHtml(prob.summary)}</p>
      <div style="display:flex; flex-wrap:wrap; gap:0.35rem; margin-bottom:0.9rem;">${skillsHtml}</div>

      <h3>Affected Group &amp; Problem Context</h3>
      <div class="problem-affected" style="margin-bottom:0.65rem;">
        <strong>Target Group:</strong> ${escapeHtml(prob.affected_group)}
      </div>
      <p>${escapeHtml(prob.context)}</p>

      <h3>Stated Constraints</h3>
      <p style="background:var(--color-warning-soft); border:1px solid rgba(124, 74, 3, 0.2); padding:0.65rem 0.85rem; border-radius:var(--radius-sm); font-size:0.85rem; color:var(--color-warning);">
        ${escapeHtml(prob.constraints || 'Standard collegiate hackathon rules apply.')}
      </p>

      <h3>Historical Prototype Context</h3>
      <p style="font-size:0.82rem; color:var(--text-subtle);">Curated notes summarizing common pitfalls from earlier student concepts:</p>
      ${protosHtml}

      <h3>Curated Scoping Note</h3>
      <p style="background:var(--color-success-soft); border-left:3px solid var(--color-success); padding:0.65rem 0.85rem; font-size:0.85rem; color:var(--text-main);">
        ${escapeHtml(prob.hints || 'Scope around one complete working demonstration.')}
      </p>

      <h3>Source References &amp; Attribution</h3>
      <ul style="font-size:0.85rem;">
        ${sourcesHtml || '<li>No external source URL recorded.</li>'}
      </ul>
      <p style="font-size:0.76rem; color:var(--text-subtle); margin-top:0.75rem;">
        BuildersFrame separates attributed source references, curated feasibility estimates (${prob.builders_rating}/10), and template-guided solution ideas.
      </p>
    `;
  }

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

  const starterBtn = document.getElementById('modalStarterPlanBtn');
  if (starterBtn) {
    starterBtn.onclick = () => {
      closeModal('dossierModal');
      openAgentResearch(prob.id);
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
        team_name: 'Student Builders Team',
        members: ['Team Lead', 'ML / Systems', 'Frontend / UI', 'Domain Research'],
        assumptions: [
          'Target users can complete the primary flow with minimal onboarding.',
          'Core prototype inference or logic works reliably under low-connectivity conditions.',
          'Any hardware components stay within team budget constraints.'
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
  showToast('Downloaded Project Brief Markdown');
}

// ----------------------------------------------------
// Catalog Sync & Feed Importer
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
        <div style="margin-bottom:0.4rem; padding-bottom:0.4rem; border-bottom:1px solid var(--border-subtle);">
          <strong>${escapeHtml(l.timestamp)}</strong> — ${escapeHtml(l.source_name)}: ${escapeHtml(l.message)}
        </div>
      `).join('');
    } else {
      container.innerHTML = 'No recent sync logs recorded.';
    }
  } catch (err) {
    container.innerHTML = 'Error loading sync logs.';
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
    statusBox.style.background = 'var(--bg-surface-subtle)';
    statusBox.style.color = 'var(--text-main)';
    statusBox.textContent = 'Checking catalog and filtering duplicates...';
  }

  try {
    const res = await fetch('/api/problems/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_name: sourceSelect?.value || 'Curated Sample Catalog',
        custom_url: customUrlInput?.value || null
      })
    });
    const data = await res.json();

    if (data.status === 'success') {
      if (statusBox) {
        statusBox.style.background = data.notice ? 'var(--color-warning-soft)' : 'var(--color-success-soft)';
        statusBox.style.color = data.notice ? 'var(--color-warning)' : 'var(--color-success)';
        const noticePrefix = data.notice ? `${data.notice} ` : '';
        statusBox.textContent = `${noticePrefix}Checked ${data.fetched_count} entries; added ${data.new_count} new challenges.`;
      }
      showToast(`Catalog sync finished (${data.new_count} added)`);
      await fetchProblems();
      loadFetchAuditLogs();
    }
  } catch (err) {
    if (statusBox) {
      statusBox.style.background = 'var(--color-danger-soft)';
      statusBox.style.color = 'var(--color-danger)';
      statusBox.textContent = 'Catalog sync request failed.';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openReportHackathonModal(hackId) {
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
      showToast('Report submitted for review');
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
        name, organizer, location, region, format,
        dates: 'See organizer portal',
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
      showToast('Listing submitted as Community Submitted (Unverified)');
      closeModal('addHackathonModal');
      document.getElementById('addHackathonForm')?.reset();
      await fetchHackathons();
      renderHackathons();
    } else {
      showToast(data.message || 'Validation error', 'error');
    }
  } catch (err) {
    showToast('Failed to submit hackathon', 'error');
  }
}

// ----------------------------------------------------
// UI Helpers, Modals & Keyboard Shortcuts
// ----------------------------------------------------
let lastFocusedBeforeModal = null;

function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (!el) return;
  lastFocusedBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  el.classList.add('active');
  const firstFocusable = el.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]');
  if (firstFocusable) {
    requestAnimationFrame(() => firstFocusable.focus());
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('active');
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
    lastFocusedBeforeModal = null;
  }
}

function populateDropdowns() {
  const probSelect = document.getElementById('postProblemSelect');
  if (probSelect) {
    probSelect.innerHTML = state.problems.map(p => `
      <option value="${p.id}">${escapeHtml(p.code)} - ${escapeHtml(p.title.slice(0, 50))}...</option>
    `).join('');
  }

  const hackSelect = document.getElementById('postHackathonSelect');
  if (hackSelect) {
    hackSelect.innerHTML = state.hackathons.map(h => `
      <option value="${h.id}">${escapeHtml(h.name)} (${escapeHtml(h.region)})</option>
    `).join('');
  }
}

function showToast(msg, type = 'normal') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${type === 'error' ? '!' : '✓'}</span> <span>${escapeHtml(msg)}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 250);
  }, 3200);
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (state.activeView === 'home') {
        document.getElementById('homeSearchInput')?.focus();
      } else {
        const input = document.getElementById('problemSearchInput');
        if (input) {
          switchView('discovery');
          input.focus();
        }
      }
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
      setHeroSuggestionsOpen(false);
      closeAgentDrawer();
      closeMobileMenu();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.home-center-search-box')) {
      setHeroSuggestionsOpen(false);
    }
  });
}

function openAddProblemModal() {
  openModal('addProblemModal');
}

async function submitProblemSuggestion() {
  const btn = document.getElementById('submitProblemBtn');
  if (btn) btn.disabled = true;

  const code = document.getElementById('newProbCode')?.value.trim();
  const title = document.getElementById('newProbTitle')?.value.trim();
  const org = document.getElementById('newProbOrg')?.value.trim();
  const domain = document.getElementById('newProbDomain')?.value;
  const category = document.getElementById('newProbCategory')?.value;
  const difficulty = document.getElementById('newProbDifficulty')?.value;
  const summary = document.getElementById('newProbSummary')?.value.trim();
  const skillsRaw = document.getElementById('newProbSkills')?.value || '';
  const sourceUrl = document.getElementById('newProbSourceUrl')?.value.trim();

  const requiredSkills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);

  try {
    const res = await fetch('/api/problems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code || undefined,
        title,
        organization: org || 'Student / Community Submission',
        domain,
        category,
        difficulty,
        summary,
        required_skills: requiredSkills.length ? requiredSkills : ['Python', 'Web App'],
        source_url: sourceUrl || undefined
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

    if (data.status === 'success') {
      showToast(`Problem ${data.code} saved to database`);
      closeModal('addProblemModal');
      document.getElementById('addProblemForm')?.reset();
      await fetchProblems();
      updateHomeStatsFromBackend();
    }
  } catch (err) {
    showToast(err.message || 'Failed to save problem statement', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
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
