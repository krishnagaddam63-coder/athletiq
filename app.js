/* ========================================
   AthletiQ — Application JavaScript
   ======================================== */

// ---- Keys ----
const AUTH_KEY = 'athletiq_auth';
const USER_KEY = 'athletiq_user';
const THEME_KEY = 'athletiq_theme';
const ACCENT_KEY = 'athletiq_accent';

// ---- Auth Management ----
function isLoggedIn() {
  return localStorage.getItem(AUTH_KEY) === 'true';
}

function getUser() {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

function setAuth(email, password) {
  localStorage.setItem(AUTH_KEY, 'true');
  const name = email.split('@')[0];
  const initials = name.charAt(0).toUpperCase();
  localStorage.setItem(USER_KEY, JSON.stringify({
    email: email,
    password: password || 'password123',
    name: name.charAt(0).toUpperCase() + name.slice(1),
    initials: initials,
    phone: ''
  }));
}

function updateUser(data) {
  const user = getUser();
  if (!user) return;
  Object.assign(user, data);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = 'index.html';
}

// ---- Auth Guard ----
function authGuard() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const protectedPages = ['dashboard.html', 'cricket.html', 'kabaddi.html', 'athletics.html', 'profile.html', 'settings.html'];

  if (protectedPages.includes(currentPage) && !isLoggedIn()) {
    window.location.href = 'index.html';
    return false;
  }

  if (currentPage === 'index.html' && isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return false;
  }

  // ── Sport preference guard ──────────────────────────────────────
  // If the user navigates directly to a sport page that is NOT in
  // their interestedSports list, redirect them back to the dashboard.
  const sportPageMap = {
    'cricket.html':   'cricket',
    'kabaddi.html':   'kabaddi',
    'athletics.html': 'athletics'
  };
  if (sportPageMap[currentPage]) {
    const user = getUser();
    if (user && user.interestedSports && user.interestedSports.length > 0) {
      const sport = sportPageMap[currentPage];
      if (!user.interestedSports.includes(sport)) {
        // Store a flash message for dashboard to display
        sessionStorage.setItem('athletiq_flash',
          `⚡ ${sport.charAt(0).toUpperCase() + sport.slice(1)} is not in your sport preferences. Update in Profile → Sports Preferences.`);
        window.location.href = 'dashboard.html';
        return false;
      }
    }
  }

  return true;
}

// ---- Login Form Handler (Removed) ----
// Authentication is now fully handled in index.html via the backend API

// ---- UI Shake Animation ----
function shakeElement(el) {
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'shake 0.5s ease';
}

const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    50% { transform: translateX(8px); }
    75% { transform: translateX(-4px); }
  }
`;
document.head.appendChild(shakeStyle);

// ---- Sidebar & Navigation ----
function initSidebar() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (!menuToggle || !sidebar) return;

  menuToggle.addEventListener('click', function() {
    sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
  });

  if (overlay) {
    overlay.addEventListener('click', function() {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
    });
  }
}

// ---- User Info Display ----
function displayUserInfo() {
  const user = getUser();
  if (!user) return;

  // Dynamically generate initial if it's missing from DB response
  const initial = user.initials || (user.name ? user.name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : '?'));

  // Update header avatars
  document.querySelectorAll('.header-avatar').forEach(a => {
    a.textContent = initial;
  });

  // Update dashboard welcome name
  const nameEl = document.getElementById('userName');
  if (nameEl) nameEl.textContent = user.name;

  // Update profile page
  const profileName = document.getElementById('profileName');
  if (profileName) {
    profileName.textContent = user.name;
    document.getElementById('profileEmail').textContent = user.email;
    document.getElementById('profileAvatarLarge').textContent = initial;
    document.getElementById('inputName').value = user.name;
    document.getElementById('inputEmail').value = user.email;
    document.getElementById('inputPassword').value = user.password || '••••••••';
    document.getElementById('inputPhone').value = user.phone || '';

    // Update Sports Preferences
    if (document.getElementById('primarySport')) {
      document.getElementById('primarySport').value = user.primarySport || 'cricket';
      document.getElementById('expLevel').value = user.expLevel || 'intermediate';
      document.getElementById('ageGroup').value = user.ageGroup || '11-13';

      const interestedSports = user.interestedSports || ['cricket', 'kabaddi', 'athletics'];
      document.getElementById('checkCricket').checked = interestedSports.includes('cricket');
      document.getElementById('checkKabaddi').checked = interestedSports.includes('kabaddi');
      document.getElementById('checkAthletics').checked = interestedSports.includes('athletics');
    }

    // Zero out progress stats since no drills have been completed yet
    const statValues = document.querySelectorAll('.profile-stat-value');
    if (statValues.length >= 4) {
      statValues[0].textContent = '0';   // Drills completed
      statValues[1].textContent = user.interestedSports?.length || 3; // Sports
      statValues[2].textContent = '0h';  // Hours Trained
      statValues[3].textContent = '0%';  // Progress
    }

    const progressFills = document.querySelectorAll('.progress-fill');
    const progressTexts = document.querySelectorAll('.progress-item > span:last-child');
    if (progressFills.length >= 3) {
      progressFills[0].style.width = '0%'; progressTexts[0].textContent = '0%';
      progressFills[1].style.width = '0%'; progressTexts[1].textContent = '0%';
      progressFills[2].style.width = '0%'; progressTexts[2].textContent = '0%';
    }
  }

  // Zero out dashboard stats - Make dynamic based on schedule
  const dashStats = document.querySelectorAll('.stat-value');
  if (dashStats.length >= 4) {
    // We will dynamically update Drills & Hours below
    dashStats[0].textContent = '0';    // Drills Scheduled
    dashStats[3].textContent = '0%';   // Progress Score
    
    // Total Sports
    const interested = user.interestedSports || ['cricket', 'kabaddi', 'athletics'];
    dashStats[1].textContent = interested.length;
    dashStats[2].textContent = '0h';   // Training Hours
  }

  // ── Filter sports grid based on user preferences ──────────────
  if (document.querySelector('.sports-grid')) {
    const sportsCards = {
      'cricket':   document.getElementById('cricketCard'),
      'kabaddi':   document.getElementById('kabaddiCard'),
      'athletics': document.getElementById('athleticsCard')
    };

    const interested = user.interestedSports || ['cricket', 'kabaddi', 'athletics'];

    Object.keys(sportsCards).forEach(sport => {
      if (sportsCards[sport]) {
        sportsCards[sport].style.display = interested.includes(sport) ? 'flex' : 'none';
      }
    });

    // Update the section header to reflect personalisation
    const sectionHeader = document.querySelector('.section-header h2');
    if (sectionHeader && sectionHeader.textContent.includes('Explore Sports')) {
      sectionHeader.textContent = '🏆 Your Sports';
    }
    // Insert subtitle only if it doesn't already exist
    if (sectionHeader && !document.getElementById('sportsPrefSubtitle')) {
      sectionHeader.insertAdjacentHTML('afterend',
        `<p id="sportsPrefSubtitle" style="color:rgba(255,255,255,0.5); font-size:0.85rem; margin-top:0.25rem; margin-bottom:1rem;">
           Showing sports based on your profile preferences · <a href="profile.html" style="color:#00d4ff; text-decoration:none;">Edit Preferences</a>
         </p>`);
    }
  }

  // ── Also filter sidebar sport nav links ────────────────────────
  const sportNavMap = {
    'cricket':   document.querySelector('.nav-link.cricket-link'),
    'kabaddi':   document.querySelector('.nav-link.kabaddi-link'),
    'athletics': document.querySelector('.nav-link.athletics-link')
  };
  const interested2 = user.interestedSports || ['cricket', 'kabaddi', 'athletics'];
  Object.keys(sportNavMap).forEach(sport => {
    if (sportNavMap[sport]) {
      sportNavMap[sport].style.display = interested2.includes(sport) ? 'flex' : 'none';
    }
  });
}

// ---- Logout Handler ----
function initLogout() {
  document.querySelectorAll('#logoutBtn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  });
}

// ---- Profile Page Logic ----
function initProfile() {
  const editBtn = document.getElementById('editAccountBtn');
  const saveBtn = document.getElementById('saveAccountBtn');
  const cancelBtn = document.getElementById('cancelAccountBtn');
  const actionsDiv = document.getElementById('accountActions');

  if (!editBtn) return;

  const fields = ['inputName', 'inputEmail', 'inputPassword', 'inputPhone'];
  let originalValues = {};

  editBtn.addEventListener('click', function() {
    const isEditing = editBtn.classList.contains('active-edit');

    if (!isEditing) {
      // Enable editing
      editBtn.classList.add('active-edit');
      editBtn.textContent = 'Editing...';
      actionsDiv.style.display = 'flex';

      fields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.disabled = false;
          originalValues[id] = input.value;
        }
      });

      // Show actual password when editing
      const passInput = document.getElementById('inputPassword');
      if (passInput) {
        passInput.type = 'text';
        const user = getUser();
        if (user) passInput.value = user.password || '';
      }
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const name = document.getElementById('inputName').value.trim();
      const email = document.getElementById('inputEmail').value.trim();
      const password = document.getElementById('inputPassword').value;
      const phone = document.getElementById('inputPhone').value.trim();

      if (!name || !email || !password) {
        alert('Name, email, and password are required.');
        return;
      }

      updateUser({
        name: name,
        email: email,
        password: password,
        phone: phone,
        initials: name.charAt(0).toUpperCase()
      });

      // Reset UI
      finishEditing();
      displayUserInfo();

      // Show success feedback
      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save Changes'; }, 1500);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      // Restore original values
      fields.forEach(id => {
        const input = document.getElementById(id);
        if (input && originalValues[id] !== undefined) {
          input.value = originalValues[id];
        }
      });
      finishEditing();
    });
  }

  function finishEditing() {
    editBtn.classList.remove('active-edit');
    editBtn.textContent = 'Edit';
    actionsDiv.style.display = 'none';

    fields.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = true;
    });

    const passInput = document.getElementById('inputPassword');
    if (passInput) passInput.type = 'password';
  }

  // Password reveal toggle
  const togglePwd = document.getElementById('togglePassword');
  if (togglePwd) {
    togglePwd.addEventListener('click', function() {
      const passInput = document.getElementById('inputPassword');
      if (!passInput) return;
      if (passInput.type === 'password') {
        passInput.type = 'text';
        const user = getUser();
        if (user && passInput.disabled) passInput.value = user.password || '';
        togglePwd.textContent = '🙈';
      } else {
        passInput.type = 'password';
        togglePwd.textContent = '👁️';
      }
    });
  }
}

// ---- Sports Preferences Logic ----
function initSportsPreferences() {
  const editBtn = document.getElementById('editSportsBtn');
  const saveBtn = document.getElementById('saveSportsBtn');
  const cancelBtn = document.getElementById('cancelSportsBtn');
  const actionsDiv = document.getElementById('sportsActions');

  if (!editBtn) return;

  const selects = ['primarySport', 'expLevel', 'ageGroup'];
  const checkboxes = ['checkCricket', 'checkKabaddi', 'checkAthletics'];
  let originalSelects = {};
  let originalCheckboxes = {};

  editBtn.addEventListener('click', function() {
    const isEditing = editBtn.classList.contains('active-edit');

    if (!isEditing) {
      editBtn.classList.add('active-edit');
      editBtn.textContent = 'Editing...';
      actionsDiv.style.display = 'flex';

      selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.disabled = false;
          originalSelects[id] = el.value;
        }
      });

      checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          el.disabled = false;
          originalCheckboxes[id] = el.checked;
        }
      });
    }
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const primarySport = document.getElementById('primarySport')?.value || 'cricket';
      const expLevel = document.getElementById('expLevel')?.value || 'beginner';
      const ageGroup = document.getElementById('ageGroup')?.value || '11-13';
      
      const interestedSports = [];
      if (document.getElementById('checkCricket')?.checked) interestedSports.push('cricket');
      if (document.getElementById('checkKabaddi')?.checked) interestedSports.push('kabaddi');
      if (document.getElementById('checkAthletics')?.checked) interestedSports.push('athletics');

      if (interestedSports.length === 0) {
        alert('Please select at least one interested sport.');
        return;
      }

      updateUser({
        primarySport,
        expLevel,
        ageGroup,
        interestedSports
      });

      finishEditingSports();
      displayUserInfo();

      saveBtn.textContent = '✓ Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save Preferences'; }, 1500);
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      selects.forEach(id => {
        const el = document.getElementById(id);
        if (el && originalSelects[id] !== undefined) el.value = originalSelects[id];
      });
      checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el && originalCheckboxes[id] !== undefined) el.checked = originalCheckboxes[id];
      });
      finishEditingSports();
    });
  }

  function finishEditingSports() {
    editBtn.classList.remove('active-edit');
    editBtn.textContent = 'Edit';
    actionsDiv.style.display = 'none';

    [...selects, ...checkboxes].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = true;
    });
  }
}

// ========================================
// THEME MANAGEMENT
// ========================================
function initTheme() {
  // Apply saved theme on load
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  const savedAccent = localStorage.getItem(ACCENT_KEY);

  applyTheme(savedTheme);
  if (savedAccent) applyAccent(savedAccent);

  // Mark active theme button on settings page
  const themeButtons = document.querySelectorAll('.theme-option');
  themeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === savedTheme);
  });

  // Mark active accent dot on settings page
  if (savedAccent) {
    document.querySelectorAll('.color-dot').forEach(dot => {
      dot.classList.toggle('active', dot.getAttribute('data-color') === savedAccent);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function applyAccent(color) {
  document.documentElement.style.setProperty('--accent-primary', color);
  document.documentElement.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${color}, #00ff88)`);
  localStorage.setItem(ACCENT_KEY, color);
}

function initSettings() {
  // Theme switcher
  const themeButtons = document.querySelectorAll('.theme-option');
  themeButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      themeButtons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      applyTheme(this.getAttribute('data-theme'));
    });
  });

  // Accent color picker
  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', function() {
      colorDots.forEach(d => d.classList.remove('active'));
      this.classList.add('active');
      applyAccent(this.getAttribute('data-color'));
    });
  });

  // Animation toggle
  const animToggle = document.getElementById('toggleAnimations');
  if (animToggle) {
    animToggle.addEventListener('change', function() {
      if (!this.checked) {
        document.documentElement.style.setProperty('--transition-fast', '0s');
        document.documentElement.style.setProperty('--transition-base', '0s');
        document.documentElement.style.setProperty('--transition-slow', '0s');
      } else {
        document.documentElement.style.setProperty('--transition-fast', '0.2s cubic-bezier(0.4, 0, 0.2, 1)');
        document.documentElement.style.setProperty('--transition-base', '0.3s cubic-bezier(0.4, 0, 0.2, 1)');
        document.documentElement.style.setProperty('--transition-slow', '0.5s cubic-bezier(0.4, 0, 0.2, 1)');
      }
    });
  }
}

// ---- Drill Card Expand/Collapse ----
function toggleDrill(button) {
  const card = button.closest('.drill-card');
  const details = card.querySelector('.drill-card-details');

  if (details.classList.contains('expanded')) {
    details.classList.remove('expanded');
    button.textContent = '▸ View Steps & Tips';
  } else {
    document.querySelectorAll('.drill-card-details.expanded').forEach(d => {
      d.classList.remove('expanded');
      const btn = d.closest('.drill-card').querySelector('.drill-card-expand');
      if (btn) btn.textContent = '▸ View Steps & Tips';
    });

    details.classList.add('expanded');
    button.textContent = '▾ Hide Steps & Tips';
  }
}

// ---- Category Filters ----
function initFilters() {
  const filtersBar = document.getElementById('filtersBar');
  if (!filtersBar) return;

  const filterBtns = filtersBar.querySelectorAll('.filter-btn');
  const drillCards = document.querySelectorAll('.drill-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      filterBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');

      const filter = this.getAttribute('data-filter');

      drillCards.forEach(card => {
        if (filter === 'all' || card.getAttribute('data-category') === filter) {
          card.style.display = '';
          card.style.animation = 'fadeInUp 0.4s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// ---- Global Search ----
function initSearch() {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;

  searchInput.addEventListener('input', function() {
    const query = this.value.toLowerCase().trim();
    const drillCards = document.querySelectorAll('.drill-card');

    if (drillCards.length === 0) return;

    drillCards.forEach(card => {
      const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
      const body = card.querySelector('.drill-card-body p')?.textContent.toLowerCase() || '';
      const category = card.getAttribute('data-category') || '';

      if (query === '' || title.includes(query) || body.includes(query) || category.includes(query)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
}

// ---- Scroll Animations ----
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[class*="delay-"]').forEach(el => {
    observer.observe(el);
  });
}

// ---- Flash Toast (show messages after redirect) ----
function showFlashToast() {
  const msg = sessionStorage.getItem('athletiq_flash');
  if (!msg) return;
  sessionStorage.removeItem('athletiq_flash');

  const toast = document.createElement('div');
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #1a1f35, #111a34);
    border: 1px solid rgba(255, 160, 0, 0.5);
    color: #ffb300;
    padding: 0.85rem 1.5rem;
    border-radius: 12px;
    font-size: 0.9rem;
    font-weight: 600;
    z-index: 99999;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    max-width: 90vw;
    text-align: center;
    animation: fadeInUp 0.4s ease;
  `;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; }, 4000);
  setTimeout(() => toast.remove(), 4600);
}

// ---- Initialize Everything ----
document.addEventListener('DOMContentLoaded', function() {
  // Theme first (before auth guard, so login page also gets themed)
  initTheme();

  // Auth guard
  if (!authGuard()) return;

  // Init all features
  initSidebar();
  displayUserInfo();
  initLogout();
  initFilters();
  initSearch();
  initProfile();
  initSportsPreferences();
  initSettings();
  initScrollAnimations();
  showFlashToast();
  
  // Inject Scheduling UI and Start Polling
  initScheduling();
  
  // Weekly Training Plan Initialization
  initWeeklyPlan();
});

// ========================================
// WEEKLY TRAINING PLAN DATA & LOGIC
// ========================================

const WEEKLY_PLANS = {
  cricket: [
    { day: "Sunday", title: "Batting Foundations", drills: ["Stance Check", "Front Foot Defense", "Shadow Batting", "Walking Sprints"] },
    { day: "Monday", title: "Bowling Accuracy", drills: ["Target Bowling", "Seam Position", "Spot Bowling", "Shoulder mobility"] },
    { day: "Tuesday", title: "Fielding Agility", drills: ["Cone Drills", "Close Catching", "Relay Throws", "Lateral Shuffles"] },
    { day: "Wednesday", title: "Power Hitting", drills: ["Range Hitting", "Pull Technique", "One-Hand Drills", "Medicine Ball Twists"] },
    { day: "Thursday", title: "Spin & Footwork", drills: ["Spin Sweeps", "Coming Down Track", "Box Drills", "Agility Ladder"] },
    { day: "Friday", title: "Match Scenarios", drills: ["Death Bowling", "Gap Piercing", "Scenario Nets", "Target Sprints"] },
    { day: "Saturday", title: "Recovery & Strategy", drills: ["Video Analysis", "Field Placement", "Stretching", "Yoga Session"] }
  ],
  kabaddi: [
    { day: "Sunday", title: "Raiding Basics", drills: ["Footwork Mastery", "Toe Touch Raid", "Cantu Practice", "Shuttle Runs"] },
    { day: "Monday", title: "Defensive Stance", drills: ["Ankle Hold Drill", "Chain Movement", "Thigh Hold", "Static Squats"] },
    { day: "Tuesday", title: "Explosive Raids", drills: ["Dubki Drill", "Frog Jump Escape", "Quick Turn", "Plyometric Jumps"] },
    { day: "Wednesday", title: "Defensive Wall", drills: ["Corner Support", "Block Technique", "Cover Drills", "Medicine Ball Throws"] },
    { day: "Thursday", title: "Speed & Agility", drills: ["Cross Sprints", "Hand Touch Raid", "Zig-Zag Runs", "Burpees"] },
    { day: "Friday", title: "Combat Drills", drills: ["Escape from Chain", "Bonus Point Raid", "Team Tackles", "Mountain Climbers"] },
    { day: "Saturday", title: "Mind & Recovery", drills: ["Breath Control", "Match Tactics", "Full Body Stretch", "Meditation"] }
  ],
  athletics: [
    { day: "Sunday", title: "Sprint Technique", drills: ["A-Skips", "B-Skips", "Block Starts", "High Knees"] },
    { day: "Monday", title: "Endurance Base", drills: ["Fartlek Run", "Hill Repeats", "Tempo Run", "Core Plank"] },
    { day: "Tuesday", title: "Explosive Power", drills: ["Box Jumps", "Broad Jumps", "Weight Sprints", "Power Cleans"] },
    { day: "Wednesday", title: "Agility & Speed", drills: ["Cones Shuttle", "Ladder Drills", "Curved Sprints", "Speed Bounds"] },
    { day: "Thursday", title: "Active Recovery", drills: ["Light Jogging", "Mobility Flows", "Foam Rolling", "Water Aerobics"] },
    { day: "Friday", title: "Performance Test", drills: ["Timed 100m/400m", "Max Long Jump", "Reaction Starts", "Cool Down Cycle"] },
    { day: "Saturday", title: "Rest & Prep", drills: ["Sleep Recovery", "Mental Imagery", "Kit Prep", "Static Stretching"] }
  ]
};

function initWeeklyPlan() {
  const container = document.getElementById('weeklyPlanContainer');
  if (!container) return;

  const sport = container.getAttribute('data-sport');
  const plan = WEEKLY_PLANS[sport];
  if (!plan) return;

  const html = `
    <div class="weekly-plan-section animate-fadeInUp">
      <div class="weekly-plan-header">
        <div>
          <h2>🏆 7-Day ${sport.charAt(0).toUpperCase() + sport.slice(1)} Training Plan</h2>
          <p style="color:var(--text-secondary); font-size:0.95rem; margin-top:0.5rem;">Follow this structured 7-day program to level up your skills.</p>
        </div>
        <button class="schedule-full-week-btn" onclick="scheduleFullWeek('${sport}')">
          🗓️ Schedule Full Week
        </button>
      </div>
      <div class="weekly-timeline">
        ${plan.map((day, index) => `
          <div class="weekly-day-card animate-fadeInUp" style="animation-delay: ${0.1 * index}s">
            <div class="day-badge">${day.day}</div>
            <div class="day-content">
              <h4>${day.title}</h4>
              <ul class="day-drills">
                ${day.drills.map(drill => `<li>${drill}</li>`).join('')}
              </ul>
            </div>
            <div class="day-actions">
              <button class="schedule-day-btn" onclick="scheduleWeeklyDay('${sport}', ${index})">
                Schedule Day
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function scheduleWeeklyDay(sport, dayIndex) {
  const plan = WEEKLY_PLANS[sport][dayIndex];
  // Calculate date: Day 1 = Today, Day 2 = Tomorrow, etc.
  const date = new Date();
  date.setDate(date.getDate() + dayIndex);

  // We'll use 10:00 AM as default
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  // Call existing API to save
  saveSchedule({
    sport: sport,
    drill_title: plan.title,
    drill_date: formattedDate,
    drill_time: "10:00",
    phone: getUser()?.phone || "",
    sms_reminder: 1
  }).then(res => {
    if (res.success) {
      alert(`✅ ${plan.day} (${plan.title}) scheduled for ${date.toLocaleDateString()} at 10:00 AM`);
    }
  });
}

function scheduleFullWeek(sport) {
  if (!confirm(`Are you sure you want to schedule the entire 7-day ${sport} plan?`)) return;
  
  const plan = WEEKLY_PLANS[sport];
  let promises = [];

  plan.forEach((day, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    promises.push(saveSchedule({
      sport: sport,
      drill_title: `${day.day}: ${day.title}`,
      drill_date: formattedDate,
      drill_time: "10:00",
      phone: getUser()?.phone || "",
      sms_reminder: 1
    }));
  });

  Promise.all(promises).then(results => {
    const successCount = results.filter(r => r.success).length;
    alert(`📅 Success! ${successCount}/7 days scheduled for your ${sport} training week.`);
    if (window.location.pathname.includes('dashboard.html')) {
      location.reload();
    }
  });
}

// ---- Scheduling Feature ──────────────────────────────────────────────

let currentScheduleContext = null;

// Helper: build <option> elements for a <select>
function buildOptions(sel, items, selected) {
  sel.innerHTML = '';
  items.forEach(([val, label]) => {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = label;
    if (val === selected) o.selected = true;
    sel.appendChild(o);
  });
}

const DAYS_OF_WEEK = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Update the displayed day-of-week badge whenever date fields change
function updateDayOfWeek() {
  const y = +document.getElementById('schedPickYear').value;
  const m = +document.getElementById('schedPickMonth').value - 1;
  const d = +document.getElementById('schedPickDay').value;
  if (!y || m < 0 || !d) return;
  const date = new Date(y, m, d);
  const dow  = DAYS_OF_WEEK[date.getDay()];
  document.getElementById('schedDayOfWeek').textContent = dow;
}

// Re-populate the Day dropdown whenever month/year changes (handles Feb 28/29 etc.)
function refreshDayOptions() {
  const year  = +document.getElementById('schedPickYear').value  || new Date().getFullYear();
  const month = +document.getElementById('schedPickMonth').value || (new Date().getMonth() + 1);
  const maxDays = new Date(year, month, 0).getDate();
  const daysSel = document.getElementById('schedPickDay');
  const curDay  = +daysSel.value;
  daysSel.innerHTML = '';
  for (let d = 1; d <= maxDays; d++) {
    const o = document.createElement('option');
    o.value = d;
    o.textContent = String(d).padStart(2, '0');
    if (d === curDay) o.selected = true;
    daysSel.appendChild(o);
  }
  updateDayOfWeek();
}

function initScheduling() {
  // ── Inject the rich schedule modal once ────────────────────────
  const selectStyle = `
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(0,212,255,0.25);
    border-radius: 8px;
    color: #fff;
    padding: 0.55rem 0.6rem;
    font-family: inherit;
    font-size: 0.92rem;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    text-align: center;
  `;

  const inputStyle = `
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(0,212,255,0.25);
    border-radius: 8px;
    color: #fff;
    padding: 0.55rem 0.6rem;
    font-family: inherit;
    font-size: 0.92rem;
    width: 100%;
    box-sizing: border-box;
  `;

  const modalHTML = `
  <div class="fp-overlay" id="scheduleModal" style="z-index:9999;">
    <div class="fp-modal" style="
      background: linear-gradient(145deg, #0d1225, #111a34);
      border: 1px solid rgba(0,212,255,0.3);
      border-radius: 18px;
      padding: 2rem;
      max-width: 480px;
      width: 95%;
    ">
      <!-- Header -->
      <div style="display:flex; align-items:center; gap:0.7rem; margin-bottom:0.5rem;">
        <div style="font-size:1.6rem;">🗓️</div>
        <div style="flex:1;">
          <h3 style="margin:0; color:#fff; font-size:1.15rem;">Schedule Drill</h3>
          <p id="scheduleDrillTitle" style="color:#00d4ff; margin:0; font-size:0.9rem; font-weight:600;"></p>
          
          <!-- Custom Entry Fields (Hidden by default) -->
          <div id="scheduleCustomInputs" style="display:none; margin-top:0.8rem; gap:0.5rem; flex-direction:column;">
            <select id="schedCustomSport" style="${selectStyle}">
              <option value="athletics">🏃 Athletics</option>
              <option value="cricket">🏏 Cricket</option>
              <option value="kabaddi">🤼 Kabaddi</option>
              <option value="other">🏅 General Fitness</option>
            </select>
            <input type="text" id="schedCustomTitle" placeholder="What drill are you doing?" style="${inputStyle}">
          </div>
        </div>
      </div>

      <hr style="border-color:rgba(255,255,255,0.08); margin:1rem 0;">

      <!-- Day of Week Display -->
      <div style="text-align:center; margin-bottom:1rem;">
        <span id="schedDayOfWeek" style="
          display:inline-block;
          background: linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,255,136,0.15));
          border: 1px solid rgba(0,212,255,0.3);
          border-radius: 50px;
          padding: 0.3rem 1.2rem;
          color: #00d4ff;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 1px;
        ">— Select a date —</span>
      </div>

      <!-- Date Row (Month / Day / Year) -->
      <p style="color:rgba(255,255,255,0.45); font-size:0.75rem; text-transform:uppercase; letter-spacing:.08em; margin:0 0 0.4rem;">Date</p>
      <div style="display:grid; grid-template-columns:2fr 1fr 1.4fr; gap:0.5rem; margin-bottom:1.1rem;">
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">MONTH</label>
          <select id="schedPickMonth" style="${selectStyle}"></select>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">DAY</label>
          <select id="schedPickDay" style="${selectStyle}"></select>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">YEAR</label>
          <select id="schedPickYear" style="${selectStyle}"></select>
        </div>
      </div>

      <!-- Time Row (Hour / Minute / AM-PM) -->
      <p style="color:rgba(255,255,255,0.45); font-size:0.75rem; text-transform:uppercase; letter-spacing:.08em; margin:0 0 0.4rem;">Time</p>
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; margin-bottom:1.5rem;">
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">HOUR</label>
          <select id="schedPickHour" style="${selectStyle}"></select>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">MINUTE</label>
          <select id="schedPickMinute" style="${selectStyle}"></select>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.25rem;">
          <label style="color:rgba(255,255,255,0.4); font-size:0.72rem;">AM / PM</label>
          <select id="schedPickAmPm" style="${selectStyle}">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
      </div>

      <!-- Preview bar -->
      <div id="schedPreviewBar" style="
        background: rgba(0,212,255,0.06);
        border: 1px solid rgba(0,212,255,0.15);
        border-radius: 10px;
        padding: 0.7rem 1rem;
        color: rgba(255,255,255,0.75);
        font-size: 0.88rem;
        margin-bottom: 1.2rem;
        min-height: 2.4rem;
      ">📅 Pick a date and time above</div>

      <div id="scheduleMsg" class="auth-msg" style="display:none; margin-bottom:1rem;"></div>

      <!-- Buttons -->
      <div style="display:flex; gap:10px;">
        <button type="button" id="scheduleCancelBtn" style="flex:1; padding:0.85rem; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); border-radius:10px; color:#fff; cursor:pointer; font-size:0.95rem;">Cancel</button>
        <button type="button" id="scheduleSaveBtn" style="flex:2; padding:0.85rem; background:linear-gradient(135deg,#00d4ff,#00ff88); border:none; border-radius:10px; color:#0a0e1a; font-weight:800; cursor:pointer; font-size:0.95rem; letter-spacing:.5px;">⏰ Set Reminder</button>
      </div>
    </div>
  </div>`;
  
  if (!document.getElementById('scheduleModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // ── Populate dropdowns ─────────────────────────────────────────
  const now = new Date();
  const user = getUser();

  // Custom Sport Dropdown
  const customSportSelect = document.getElementById('schedCustomSport');
  if (customSportSelect) {
    const allSports = [
      { id: 'athletics', label: '🏃 Athletics' },
      { id: 'cricket', label: '🏏 Cricket' },
      { id: 'kabaddi', label: '🤼 Kabaddi' }
    ];
    let userSports = allSports;
    if (user && user.interestedSports && user.interestedSports.length > 0) {
      userSports = allSports.filter(s => user.interestedSports.includes(s.id));
    }
    customSportSelect.innerHTML = '';
    userSports.forEach(s => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = s.label;
      customSportSelect.appendChild(option);
    });
    const fitnessOpt = document.createElement('option');
    fitnessOpt.value = 'other';
    fitnessOpt.textContent = '🏅 General Fitness';
    customSportSelect.appendChild(fitnessOpt);
  }

  // Month
  buildOptions(
    document.getElementById('schedPickMonth'),
    MONTH_NAMES.map((name, i) => [i + 1, name]),
    now.getMonth() + 1
  );

  // Year (current year + 2 years ahead)
  const yearItems = [];
  for (let y = now.getFullYear(); y <= now.getFullYear() + 2; y++) yearItems.push([y, y]);
  buildOptions(document.getElementById('schedPickYear'), yearItems, now.getFullYear());

  // Hour (1–12)
  buildOptions(
    document.getElementById('schedPickHour'),
    Array.from({length:12}, (_, i) => [i+1, String(i+1).padStart(2,'0')]),
    now.getHours() % 12 || 12
  );

  // Minute (00, 05, 10 … 55)
  buildOptions(
    document.getElementById('schedPickMinute'),
    Array.from({length:12}, (_, i) => [i*5, String(i*5).padStart(2,'0')]),
    Math.round(now.getMinutes() / 5) * 5 % 60
  );

  // AM / PM
  document.getElementById('schedPickAmPm').value = now.getHours() < 12 ? 'AM' : 'PM';

  // Populate days (depends on month/year)
  refreshDayOptions();

  // ── Live event listeners ──────────────────────────────────────
  ['schedPickMonth','schedPickYear'].forEach(id => {
    document.getElementById(id).addEventListener('change', refreshDayOptions);
  });
  document.getElementById('schedPickDay').addEventListener('change', updateDayOfWeek);

  function updatePreview() {
    const month  = +document.getElementById('schedPickMonth').value;
    const day    = +document.getElementById('schedPickDay').value;
    const year   = +document.getElementById('schedPickYear').value;
    const hour   = +document.getElementById('schedPickHour').value;
    const minute = +document.getElementById('schedPickMinute').value;
    const ampm   =  document.getElementById('schedPickAmPm').value;
    if (!month || !day || !year) return;
    const date = new Date(year, month - 1, day);
    const dow  = DAYS_OF_WEEK[date.getDay()];
    const h12  = hour;
    const timeStr = `${String(h12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${ampm}`;
    document.getElementById('schedPreviewBar').innerHTML =
      `📅 <b>${dow}</b>, ${MONTH_NAMES[month-1]} ${day}, ${year} &nbsp;·&nbsp; ⏰ ${timeStr}`;
  }

  ['schedPickMonth','schedPickDay','schedPickYear','schedPickHour','schedPickMinute','schedPickAmPm'].forEach(id => {
    document.getElementById(id).addEventListener('change', updatePreview);
  });
  updatePreview();

  // ── Cancel / Save ─────────────────────────────────────────────
  const modal   = document.getElementById('scheduleModal');
  const closeBtn = document.getElementById('scheduleCancelBtn');
  const saveBtn  = document.getElementById('scheduleSaveBtn');
  
  closeBtn.addEventListener('click', () => modal.classList.remove('open'));
  
  saveBtn.addEventListener('click', async () => {
    const month  = +document.getElementById('schedPickMonth').value;
    const day    = +document.getElementById('schedPickDay').value;
    const year   = +document.getElementById('schedPickYear').value;
    let   hour   = +document.getElementById('schedPickHour').value;
    const minute = +document.getElementById('schedPickMinute').value;
    const ampm   =  document.getElementById('schedPickAmPm').value;
    const msg    =  document.getElementById('scheduleMsg');

    msg.style.display = 'none';

    if (!month || !day || !year) {
      msg.textContent = 'Please select a complete date and time.';
      msg.className = 'auth-msg auth-msg-error';
      msg.style.display = 'block';
      return;
    }

    // Convert 12-hour to 24-hour
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    const selectedDate = new Date(year, month - 1, day, hour, minute, 0);
    if (selectedDate <= new Date()) {
      msg.textContent = 'Please select a future date and time.';
      msg.className = 'auth-msg auth-msg-error';
      msg.style.display = 'block';
      return;
    }

    let { sport, title } = currentScheduleContext;
    
    // Fallback to custom inputs if no context (e.g., opened globally)
    if (!sport || !title) {
      const customSportInput = document.getElementById('schedCustomSport');
      const customTitleInput = document.getElementById('schedCustomTitle');
      sport = customSportInput ? customSportInput.value : 'other';
      title = customTitleInput ? customTitleInput.value.trim() : '';
      
      if (!title) {
        msg.textContent = 'Please enter a name for your drill.';
        msg.className = 'auth-msg auth-msg-error';
        msg.style.display = 'block';
        return;
      }
    }

    if (!user) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      const res = await fetch(`/api/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          sport: sport,
          title: title,
          scheduled_time: selectedDate.toISOString()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const dow = DAYS_OF_WEEK[selectedDate.getDay()];
      const h12 = selectedDate.getHours() % 12 || 12;
      const am  = selectedDate.getHours() < 12 ? 'AM' : 'PM';
      const timeStr = `${String(h12).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${am}`;
      msg.textContent = `✅ Reminder set for ${dow}, ${MONTH_NAMES[month-1]} ${day}, ${year} at ${timeStr}. SMS reminder 30 min before!`;
      msg.className = 'auth-msg auth-msg-success';
      msg.style.display = 'block';
      
      setTimeout(() => {
        modal.classList.remove('open');
        msg.style.display = 'none';
      }, 2500);
      
      // Refresh local schedules
      loadSchedules(user.id);
      
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'auth-msg auth-msg-error';
      msg.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '⏰ Set Reminder';
    }
  });

  // Start polling
  if (user) {
    loadSchedules(user.id);
    setInterval(checkUpcomingDrills, 60000); // Check every minute
  }
}

// Called from HTML onclick buttons
window.scheduleDrill = function(button, sport, title) {
  currentScheduleContext = { sport, title };
  const titleEl = document.getElementById('scheduleDrillTitle');
  const customInputs = document.getElementById('scheduleCustomInputs');
  const customTitle = document.getElementById('schedCustomTitle');
  
  if (sport && title) {
    titleEl.textContent = `${title} — ${sport.charAt(0).toUpperCase() + sport.slice(1)}`;
    titleEl.style.display = 'block';
    customInputs.style.display = 'none';
  } else {
    titleEl.style.display = 'none';
    customInputs.style.display = 'flex';
    customTitle.value = ''; // Reset
  }
  
  document.getElementById('scheduleMsg').style.display = 'none';

  // Reset to current date/time
  const now = new Date();
  document.getElementById('schedPickMonth').value = now.getMonth() + 1;
  document.getElementById('schedPickYear').value  = now.getFullYear();
  refreshDayOptions();
  document.getElementById('schedPickDay').value   = now.getDate();
  updateDayOfWeek();

  const h = now.getHours();
  const h12 = h % 12 || 12;
  const min = Math.ceil(now.getMinutes() / 5) * 5 % 60;
  document.getElementById('schedPickHour').value   = h12;
  document.getElementById('schedPickMinute').value  = min;
  document.getElementById('schedPickAmPm').value    = h < 12 ? 'AM' : 'PM';

  // Trigger preview update
  ['schedPickMonth','schedPickDay','schedPickYear','schedPickHour','schedPickMinute','schedPickAmPm'].forEach(id => {
    document.getElementById(id).dispatchEvent(new Event('change'));
  });

  document.getElementById('scheduleModal').classList.add('open');
};

let userSchedules = [];

async function loadSchedules(userId) {
  try {
    const res = await fetch(`/api/schedules/${userId}`);
    if (res.ok) {
      userSchedules = await res.json();
      // Immediately render the panel without waiting for the 60s interval
      if (window.location.pathname.endsWith('dashboard.html')) {
        renderUpcomingDrills();
        const now = new Date();
        const dashStats = document.querySelectorAll('.stat-value');
        if (dashStats.length >= 4) {
          const upcoming = userSchedules.filter(s => new Date(s.scheduled_time) > now);
          dashStats[0].textContent = upcoming.length;
          dashStats[2].textContent = Math.round((userSchedules.length * 20) / 60) + 'h';
          const progress = Math.min((userSchedules.length / 5) * 100, 100);
          dashStats[3].textContent = Math.round(progress) + '%';
        }
      }
    }
  } catch (err) {
    console.error('Failed to load schedules: ', err);
  }
}

// ── Sport emoji map
const SPORT_EMOJI = { cricket: '🏏', kabaddi: '🤼', athletics: '🏃' };

// ── Render the Upcoming Drills panel on dashboard
function renderUpcomingDrills() {
  const container = document.getElementById('upcomingDrillsContainer');
  if (!container) return;

  const now = new Date();

  // Sort: upcoming first, then past
  let sorted = [...userSchedules].sort((a, b) =>
    new Date(a.scheduled_time) - new Date(b.scheduled_time)
  );

  // Filter based on user's interested sports
  const user = getUser();
  if (user && user.interestedSports && user.interestedSports.length > 0) {
    sorted = sorted.filter(s => user.interestedSports.includes(s.sport) || s.sport === 'other');
  }

  if (sorted.length === 0) {
    const defaultSports = ['athletics', 'cricket', 'kabaddi'];
    const sportsToShow = (user && user.interestedSports && user.interestedSports.length > 0)
                          ? user.interestedSports
                          : defaultSports;
                          
    let buttonsHtml = '';
    sportsToShow.forEach(sport => {
      const emoji = SPORT_EMOJI[sport] || '🏅';
      const label = sport.charAt(0).toUpperCase() + sport.slice(1);
      buttonsHtml += `
        <a href="${sport}.html" class="schedule-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:0.5rem; background:rgba(0,212,255,0.1); border:1px solid rgba(0,212,255,0.3); color:#00d4ff; padding:0.6rem 1.2rem; border-radius:8px;">
          ${emoji} ${label}
        </a>
      `;
    });

    container.innerHTML = `
      <div class="stat-card animate-fadeInUp delay-1"
        style="text-align:center; padding:2.5rem 2rem;">
        <div style="font-size:2.5rem; margin-bottom:1rem;">📅</div>
        <div style="font-weight:700; color:#fff; font-size:1.2rem; margin-bottom:0.5rem;">No upcoming drills scheduled</div>
        <div style="color:rgba(255,255,255,0.6); margin-bottom:1.5rem; max-width:400px; margin-inline:auto;">
          Select a sport below to browse drills and click <b>🕒 Schedule Drill</b> to get an SMS reminder.
        </div>
        <div style="display:flex; justify-content:center; gap:1rem; flex-wrap:wrap;">
          ${buttonsHtml}
        </div>
      </div>`;
    return;
  }

  const cards = sorted.map(s => {
    const dt       = new Date(s.scheduled_time);
    const isPast   = dt < now;
    const h12      = dt.getHours() % 12 || 12;
    const ampm     = dt.getHours() < 12 ? 'AM' : 'PM';
    const minStr   = String(dt.getMinutes()).padStart(2, '0');
    const timeStr  = `${String(h12).padStart(2,'0')}:${minStr} ${ampm}`;
    const dayName  = DAYS_OF_WEEK[dt.getDay()];
    const monthName = MONTH_NAMES[dt.getMonth()];
    const dayNum   = dt.getDate();
    const year     = dt.getFullYear();
    const sportEmoji = SPORT_EMOJI[s.sport] || '🏅';
    const sportLabel = s.sport.charAt(0).toUpperCase() + s.sport.slice(1);

    // Countdown
    let countdownHtml = '';
    const diffMs = dt - now;
    if (!isPast) {
      const diffMins = Math.round(diffMs / 60000);
      if (diffMins < 60) {
        countdownHtml = `<span style="color:#00ff88; font-weight:700;">⏱ In ${diffMins} min</span>`;
      } else if (diffMins < 1440) {
        countdownHtml = `<span style="color:#00d4ff; font-weight:600;">⏱ In ${Math.round(diffMins/60)}h ${diffMins%60}m</span>`;
      } else {
        countdownHtml = `<span style="color:rgba(255,255,255,0.5);">⏱ In ${Math.round(diffMins/1440)} day(s)</span>`;
      }
    } else {
      countdownHtml = `<span style="color:rgba(255,255,255,0.3); font-size:0.8rem;">Completed</span>`;
    }

    return `
      <div class="stat-card animate-fadeInUp" style="
        padding: 1.25rem 1.5rem;
        border-left: 3px solid ${isPast ? 'rgba(255,255,255,0.08)' : 'rgba(0,212,255,0.5)'};
        opacity: ${isPast ? '0.5' : '1'};
        transition: all 0.2s;
      ">
        <!-- Sport + title row -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem;">
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <span style="font-size:1.4rem;">${sportEmoji}</span>
            <div>
              <div style="font-weight:700; font-size:0.95rem; color:#fff;">${s.title}</div>
              <div style="font-size:0.8rem; color:rgba(255,255,255,0.45);">${sportLabel}</div>
            </div>
          </div>
          ${countdownHtml}
        </div>

        <!-- Full date/time breakdown -->
        <div style="
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.85rem;
        ">
          <div style="background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.15); border-radius:8px; padding:0.5rem; text-align:center;">
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.2rem;">Day</div>
            <div style="font-weight:700; color:#00d4ff; font-size:0.85rem;">${dayName}</div>
          </div>
          <div style="background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.15); border-radius:8px; padding:0.5rem; text-align:center;">
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.2rem;">Date</div>
            <div style="font-weight:700; color:#fff; font-size:0.85rem;">${dayNum} ${monthName}</div>
          </div>
          <div style="background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.15); border-radius:8px; padding:0.5rem; text-align:center;">
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.2rem;">Year</div>
            <div style="font-weight:700; color:#fff; font-size:0.85rem;">${year}</div>
          </div>
          <div style="background:rgba(0,212,255,0.06); border:1px solid rgba(0,212,255,0.15); border-radius:8px; padding:0.5rem; text-align:center;">
            <div style="font-size:0.68rem; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.2rem;">Time</div>
            <div style="font-weight:700; color:#fff; font-size:0.85rem;">${timeStr}</div>
          </div>
        </div>

        <!-- SMS reminder badge -->
        ${!isPast ? `
        <div style="
          display:inline-flex; align-items:center; gap:0.4rem;
          background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.25);
          border-radius: 20px; padding: 0.3rem 0.8rem;
          font-size: 0.78rem; font-weight: 600; color: #00ff88;
        ">
          📱 SMS reminder 30 min before · ${s.notified ? 'Sent ✓' : 'Scheduled'}
        </div>` : ''}
      </div>`;
  }).join('');

  container.innerHTML = `<div style="display:flex; flex-direction:column; gap:0.75rem;">${cards}</div>`;
}

// ── 30-minute SMS reminder checker (runs every 60s)
function checkUpcomingDrills() {
  const now = new Date();
  const leadTimeMs = 30 * 60 * 1000;

  // Update dashboard stat cards
  if (window.location.pathname.endsWith('dashboard.html')) {
    const dashStats = document.querySelectorAll('.stat-value');
    if (dashStats.length >= 4) {
      const upcoming = userSchedules.filter(s => new Date(s.scheduled_time) > now);
      dashStats[0].textContent = upcoming.length;
      dashStats[2].textContent = Math.round((userSchedules.length * 20) / 60) + 'h';
      const progress = Math.min((userSchedules.length / 5) * 100, 100);
      dashStats[3].textContent = Math.round(progress) + '%';
    }
    renderUpcomingDrills();
  }

  // Fire 30-min SMS alert for each upcoming drill
  userSchedules.forEach(async schedule => {
    if (schedule.notified) return;
    const schedTime = new Date(schedule.scheduled_time);
    const diff = schedTime - now;
    if (diff > 0 && diff <= leadTimeMs + 60000) {
      schedule.notified = 1;
      const user = getUser();
      if (!user) return;
      const dow      = DAYS_OF_WEEK[schedTime.getDay()];
      const mon      = MONTH_NAMES[schedTime.getMonth()];
      const h12      = schedTime.getHours() % 12 || 12;
      const ampm     = schedTime.getHours() < 12 ? 'AM' : 'PM';
      const minStr   = String(schedTime.getMinutes()).padStart(2,'0');
      const timeStr  = `${String(h12).padStart(2,'0')}:${minStr} ${ampm}`;
      const dateStr  = `${dow}, ${mon} ${schedTime.getDate()}, ${schedTime.getFullYear()}`;
      const smsBody  = `AthletiQ 🏆: Hi ${user.name}! Your ${schedule.sport} drill "${schedule.title}" starts in 30 minutes — ${dateStr} at ${timeStr}. Get ready! 💪`;
      try {
        await fetch('/api/send-sms', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: user.phone, message: smsBody })
        });
      } catch (err) { console.error('SMS error:', err); }

      // In-browser notification as backup
      const shortMsg = `"${schedule.title}" starts in 30 min – ${timeStr}`;
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("⚡ AthletiQ Drill Reminder", { body: shortMsg });
      } else if ("Notification" in window && Notification.permission !== "denied") {
        Notification.requestPermission().then(p => {
          if (p === "granted") new Notification("⚡ AthletiQ Drill Reminder", { body: shortMsg });
        });
      }
    }
  });
}

