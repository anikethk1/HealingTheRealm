const slides = document.querySelectorAll('.slide');
const toast = document.getElementById('toast');
let toastTimer = null;
let authUser = localStorage.getItem('authUser') || null;
const fullscreenBtn = document.getElementById('fullscreen-toggle');

// Toast helper
function showToast(message, type = 'success', duration = 2200) {
    if (!toast) return;
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration);
}

// Auth helpers
function isAuthenticated() {
    return Boolean(authUser);
}
function setAuthUser(username) {
    authUser = username;
    if (username) {
        localStorage.setItem('authUser', username);
    } else {
        localStorage.removeItem('authUser');
    }
}

// Navigation
function showSlide(id) {
    const next = document.getElementById(id);
    if (!next) return;
    const publicSlides = new Set(['login-slide', 'signup-slide']);
    if (!isAuthenticated() && !publicSlides.has(id)) {
        return showSlide('login-slide');
    }
    slides.forEach(slide => {
        const active = slide === next;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
        if (active && slide.id === 'world-slide') {
            startWorldDemo();
        }
    });
    const focusTarget = next.querySelector('[autofocus], .world-card, .btn, input');
    focusTarget?.focus({ preventScroll: true });
}

function navigateTo(id, push = true) {
    showSlide(id);
    const method = push ? 'pushState' : 'replaceState';
    try {
        history[method]({ slide: id }, '', `#${id}`);
    } catch (_) {}
}

// Delegate clicks
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-target]');
    if (!target) return;
    const id = target.getAttribute('data-target');
    if (id) navigateTo(id);
});

// Start button
document.getElementById('start-game')?.addEventListener('click', () => navigateTo('world-slide'));

// History pop
window.addEventListener('popstate', (e) => {
    const id = e.state?.slide || (location.hash ? location.hash.slice(1) : 'login-slide');
    showSlide(id);
});

// Messages helper
function showMessage(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
    element.hidden = !message;
}

// Forms / API helper
async function submitForm(endpoint, payload, method = 'POST') {
    const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        throw new Error(data.message || 'Request failed.');
    }
    return data;
}

// Auth forms
const signupForm = document.getElementById('signup-form');
const signupMessage = document.getElementById('signup-message');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage(signupMessage, '', 'info');
        const formData = new FormData(signupForm);
        const username = formData.get('username')?.trim();
        const password = formData.get('password') || '';
        const confirmPassword = formData.get('confirmPassword') || '';
        try {
            await submitForm('/api/signup', { username, password, confirmPassword });
            showToast('Account created. You can log in now.', 'success');
            signupForm.reset();
            navigateTo('login-slide');
        } catch (err) {
            showMessage(signupMessage, err.message, 'error');
        }
    });
}

const loginForm = document.getElementById('login-form');
const loginMessage = document.getElementById('login-message');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showMessage(loginMessage, '', 'info');
        const formData = new FormData(loginForm);
        const username = formData.get('username')?.trim();
        const password = formData.get('password') || '';
        try {
            const data = await submitForm('/api/login', { username, password });
            setAuthUser(data.username);
            await loadGoals();
            await loadCheckin();
            navigateTo('intro-slide');
            showToast('Login successful!', 'success');
        } catch (err) {
            showMessage(loginMessage, err.message, 'error');
        }
    });
}

// Logout
document.querySelectorAll('[data-logout]').forEach(btn => {
    btn.addEventListener('click', () => {
        setAuthUser(null);
        showMessage(loginMessage, '', 'info');
        showMessage(signupMessage, '', 'info');
        showToast('Logged out', 'success');
        navigateTo('login-slide');
    });
});

// Goals logic
const goalForm = document.getElementById('goal-form');
const goalList = document.getElementById('goal-list');
const goalMessage = document.getElementById('goal-message');
let goals = [];

function renderGoals() {
    if (!goalList) return;
    goalList.innerHTML = '';
    if (!goals.length) {
        const empty = document.createElement('p');
        empty.className = 'goal-empty';
        empty.textContent = 'No goals added.';
        goalList.appendChild(empty);
        return;
    }
    goals.forEach(goal => {
        const card = document.createElement('div');
        card.className = 'goal-card';
        if (goal.completed) card.classList.add('completed');

        const info = document.createElement('div');
        info.className = 'goal-card__info';
        const title = document.createElement('p');
        title.className = 'goal-card__title';
        title.textContent = goal.title;
        info.appendChild(title);
        const desc = document.createElement('p');
        desc.className = 'goal-card__desc';
        desc.textContent = goal.description;
        info.appendChild(desc);

        const actions = document.createElement('div');
        actions.className = 'goal-card__actions';
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn btn--secondary btn--accent btn--small';
        toggleBtn.textContent = goal.completed ? 'Mark Incomplete' : 'Mark Completed';
        toggleBtn.addEventListener('click', () => setGoalCompleted(goal.id, goal.completed ? 0 : 1));
        actions.appendChild(toggleBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn btn--secondary btn--small';
        deleteBtn.textContent = '🗑 Delete';
        deleteBtn.addEventListener('click', () => deleteGoal(goal.id));
        actions.appendChild(deleteBtn);

        card.appendChild(info);
        card.appendChild(actions);
        goalList.appendChild(card);
    });
}

async function loadGoals() {
    if (!authUser) return;
    try {
        const res = await fetch(`/api/goals?username=${encodeURIComponent(authUser)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to load goals.');
        goals = data.goals || [];
        renderGoals();
    } catch (err) {
        showToast(err.message || 'Could not load goals.', 'error');
    }
}

async function setGoalCompleted(id, completedValue) {
    if (!authUser) return;
    try {
        const data = await submitForm(`/api/goals/${id}/complete`, { username: authUser, completed: completedValue }, 'PATCH');
        if (data.ok) {
            goals = goals.map(g => g.id === id ? { ...g, completed: completedValue } : g);
            renderGoals();
            showToast(completedValue ? 'Goal marked completed.' : 'Goal marked incomplete.', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Update failed.', 'error');
    }
}

async function deleteGoal(id) {
    if (!authUser) return;
    try {
        const data = await submitForm(`/api/goals/${id}`, { username: authUser }, 'DELETE');
        if (data.ok) {
            goals = goals.filter(g => g.id !== id);
            renderGoals();
            showToast('Goal deleted.', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Delete failed.', 'error');
    }
}

if (goalForm) {
    goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authUser) return navigateTo('login-slide');
        const formData = new FormData(goalForm);
        const title = formData.get('title')?.trim();
        const description = formData.get('description')?.trim();
        if (!title || !description) {
            showMessage(goalMessage, 'Please fill in both fields.', 'error');
            return;
        }
        try {
            const data = await submitForm('/api/goals', { username: authUser, title, description });
            goals = [data.goal, ...goals];
            renderGoals();
            goalForm.reset();
            showMessage(goalMessage, '', 'info');
            showToast('Goal added.', 'success');
        } catch (err) {
            showMessage(goalMessage, err.message, 'error');
        }
    });
}

// Daily Check-in logic
const checkinForm = document.getElementById('checkin-form');
const checkinMessage = document.getElementById('checkin-message');
const checkinStatus = document.getElementById('checkin-status');
const checkinResult = document.getElementById('checkin-result');
const checkinTimer = document.getElementById('checkin-timer');
let checkinTimerInterval = null;

function clearCheckinTimer() {
    if (checkinTimerInterval) clearInterval(checkinTimerInterval);
    checkinTimerInterval = null;
    if (checkinTimer) checkinTimer.textContent = '';
}

function startCheckinCountdown(lastTimeMs) {
    clearCheckinTimer();
    const durationMs = 24 * 60 * 60 * 1000;
    const end = lastTimeMs + durationMs;
    const update = () => {
        const remaining = end - Date.now();
        if (remaining <= 0) {
            clearCheckinTimer();
            if (checkinStatus) checkinStatus.textContent = 'You can submit today\'s check-in.';
            if (checkinResult) checkinResult.textContent = '';
            if (checkinForm) {
                checkinForm.hidden = false;
                checkinForm.reset();
            }
            return;
        }
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        if (checkinTimer) {
            checkinTimer.textContent = `Next check-in in ${hours}h ${minutes}m ${seconds}s`;
        }
    };
    update();
    checkinTimerInterval = setInterval(update, 1000);
}

async function loadCheckin() {
    if (!authUser) return;
    try {
        const res = await fetch(`/api/checkins/latest?username=${encodeURIComponent(authUser)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.message || 'Failed to load check-in.');
        const latest = data.checkin;
        if (!latest) {
            if (checkinStatus) checkinStatus.textContent = 'No check-in yet today.';
            if (checkinResult) checkinResult.textContent = '';
            if (checkinForm) {
                checkinForm.hidden = false;
                checkinForm.reset();
            }
            clearCheckinTimer();
            return;
        }
        const lastTime = new Date(latest.created_at).getTime();
        const canSubmit = (Date.now() - lastTime) >= 24 * 60 * 60 * 1000;
        if (checkinStatus) {
            checkinStatus.textContent = canSubmit
                ? 'You can submit today\'s check-in.'
                : `Today's Daily Check-in Complete (${new Date(latest.created_at).toLocaleString()})`;
        }
        if (checkinResult) checkinResult.textContent = canSubmit ? '' : 'Today\'s Daily Check-in Complete.';
        if (checkinForm) {
            checkinForm.hidden = !canSubmit;
            if (canSubmit) checkinForm.reset();
        }
        if (!canSubmit) startCheckinCountdown(lastTime);
        else clearCheckinTimer();
    } catch (err) {
        showToast(err.message || 'Could not load check-in.', 'error');
    }
}

if (checkinForm) {
    checkinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!authUser) return navigateTo('login-slide');
        const formData = new FormData(checkinForm);
        const mood = formData.get('mood');
        const hasGoals = formData.get('hasGoals');
        const hasSelftime = formData.get('hasSelftime');
        if (!mood || hasGoals == null || hasSelftime == null) {
            showMessage(checkinMessage, 'Please answer all questions.', 'error');
            return;
        }
        try {
            const data = await submitForm('/api/checkins', {
                username: authUser,
                mood: Number(mood),
                hasGoals: hasGoals === 'yes',
                hasSelftime: hasSelftime === 'yes'
            });
            showMessage(checkinMessage, '', 'info');
            showToast('Daily check-in submitted.', 'success');
            if (checkinResult) checkinResult.textContent = 'Today\'s Daily Check-in Complete.';
            if (checkinForm) checkinForm.hidden = true;
            if (checkinStatus && data.checkin) {
                checkinStatus.textContent = `Today's Daily Check-in Complete (${new Date(data.checkin.created_at).toLocaleString()})`;
                const lastTime = new Date(data.checkin.created_at).getTime();
                startCheckinCountdown(lastTime);
            }
        } catch (err) {
            showMessage(checkinMessage, err.message, 'error');
        }
    });
}

// Initial slide on load
window.addEventListener('DOMContentLoaded', () => {
    const initialFromHash = location.hash ? location.hash.slice(1) : null;
    const initial = isAuthenticated() ? (initialFromHash || 'intro-slide') : 'login-slide';
    navigateTo(initial, false);
    if (isAuthenticated()) {
        loadGoals();
        loadCheckin();
    }
});

// Fullscreen toggle
function toggleFullscreen() {
    const target = document.querySelector('.playfield');
    if (!target) return;
    if (document.fullscreenElement) {
        document.exitFullscreen?.();
    } else {
        target.requestFullscreen?.();
    }
}
fullscreenBtn?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
    if (!fullscreenBtn) return;
    fullscreenBtn.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
});
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && !e.repeat) {
        e.preventDefault();
        toggleFullscreen();
    }
});

// --- Simple field + school world demo ---
let worldBooted = false;
let canvas, ctx;
const tile = 32;
const fieldMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];
let colors = [];
let tufts = [];
let hero = { x: 0, y: 0, speed: 140, size: 20, dir: 'right', frame: 0, frameTimer: 0 };
let npc = { x: 0, y: 0, dir: 'left' };
let keysDown = new Set();
let lastTime = 0;
let dialogBox = document.getElementById('dialog-box');
let dialogText = document.getElementById('dialog-text');
let dialogNext = document.getElementById('dialog-next');
const loadingOverlay = document.getElementById('loading-overlay');
let dialogTimer = null;
let dialogActive = false;
let dialogComplete = false;
let currentDialog = '';
let dialogStep = 0;
const npcDialog = [
    'Welcome to the Game!',
    'This game is a mental health game created by MHISA (The Mental Health Initiative for South Asians), a student organization from the University of Texas at Austin.',
    "I'm not going to spoil too much for you, but why don't we get you started. A portal should appear once you've completed reading this, go to the portal to start your mental health journey!"
];
let portalVisible = false;
let loading = false;
let inSchool = false;
const roadHeight = tile * 2;
let roadY = 0;
let portalPos = null;
const door = { x: 0, y: 0, w: 34, h: 48 };
let doorCooldown = false;

function initFieldPalette() {
    colors = fieldMap.map(row => row.map(() => (Math.random() > 0.5 ? '#84d58a' : '#7ccf82')));
    tufts = fieldMap.map(row => row.map(() => (Math.random() > 0.7)));
}

function showDialog(text, instant = false) {
    if (!dialogBox || !dialogText) return;
    hideDialog();
    dialogActive = true;
    dialogComplete = false;
    currentDialog = text;
    dialogBox.hidden = false;
    if (dialogNext) dialogNext.hidden = true;
    dialogText.textContent = '';
    clearInterval(dialogTimer);
    if (instant) {
        dialogText.textContent = text;
        dialogComplete = true;
        if (dialogNext) dialogNext.hidden = false;
        return;
    }
    let idx = 0;
    dialogTimer = setInterval(() => {
        if (idx >= text.length) {
            finishDialog();
            return;
        }
        dialogText.textContent += text[idx++];
    }, 30);
}
function finishDialog() {
    if (!dialogActive || !dialogText) return;
    dialogText.textContent = currentDialog;
    dialogComplete = true;
    if (dialogNext) dialogNext.hidden = false;
    clearInterval(dialogTimer);
}
function hideDialog() {
    clearInterval(dialogTimer);
    dialogActive = false;
    dialogComplete = false;
    currentDialog = '';
    if (dialogBox) dialogBox.hidden = true;
    if (dialogNext) dialogNext.hidden = true;
    if (dialogText) dialogText.textContent = '';
}

function startWorldDemo() {
    if (worldBooted) return;
    worldBooted = true;
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    canvas.width = fieldMap[0].length * tile;
    canvas.height = fieldMap.length * tile;
    roadY = canvas.height / 2 - roadHeight / 2;
    initFieldPalette();
    hero.x = tile * 2;
    hero.y = canvas.height / 2;
    npc.x = canvas.width - tile * 2;
    npc.y = roadY - 8;
    dialogStep = 0;
    portalVisible = false;
    inSchool = false;
    doorCooldown = false;
    keysDown.clear();
    lastTime = performance.now();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    dialogNext?.addEventListener('click', handleDialogNext);
    document.addEventListener('mousedown', (e) => {
        if (dialogActive && !dialogComplete) {
            finishDialog();
            e.stopPropagation();
        }
    });
    requestAnimationFrame(loop);
}

function handleDialogNext() {
    if (!dialogActive) return;
    if (!dialogComplete) {
        finishDialog();
        return;
    }

    // NPC 3-line sequence
    if (dialogStep < npcDialog.length - 1) {
        dialogStep += 1;
        showDialog(npcDialog[dialogStep]);
        return;
    }
    // Finished the last line: reveal portal and close dialog
    if (dialogStep === npcDialog.length - 1) {
        portalVisible = true;
        hideDialog();
        return;
    }

    // Generic dialogs (door / loading) just close
    hideDialog();
}

function handleKeyDown(e) {
    const k = e.key.toLowerCase();
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        if (dialogActive || loading) {
            e.preventDefault();
            return;
        }
        keysDown.add(k);
        e.preventDefault();
    }
    if (dialogActive && ['enter',' '].includes(k)) {
        e.preventDefault();
        if (!dialogComplete) finishDialog(); else hideDialog();
    }
}
function handleKeyUp(e) {
    keysDown.delete(e.key.toLowerCase());
}

function blocked(x, y) {
    const col = Math.floor(x / tile);
    const row = Math.floor(y / tile);
    return fieldMap[row]?.[col] === 1;
}

function drawField() {
    for (let r=0;r<fieldMap.length;r++){
        for (let c=0;c<fieldMap[r].length;c++){
            ctx.fillStyle = colors[r][c];
            ctx.fillRect(c*tile, r*tile, tile, tile);
            if (!fieldMap[r][c] && tufts[r][c]) {
                ctx.fillStyle = '#5ba764';
                ctx.fillRect(c*tile+10, r*tile+10, 4, 8);
            }
        }
    }
    // road
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, roadY, canvas.width, roadHeight);
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 4;
    ctx.setLineDash([16,10]);
    ctx.beginPath();
    ctx.moveTo(0, roadY + roadHeight/2);
    ctx.lineTo(canvas.width, roadY + roadHeight/2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawHero() {
    ctx.save();
    ctx.translate(hero.x, hero.y);
    if (hero.dir === 'left') ctx.scale(-1,1);
    ctx.fillStyle = '#2e2e2e';
    ctx.beginPath();
    ctx.ellipse(0,20,10,4,0,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(-9 + (hero.frame?2:-2), 12, 6, 10);
    ctx.fillRect(3 - (hero.frame?2:-2), 12, 6, 10);
    ctx.fillStyle = '#e45c5c';
    ctx.fillRect(-10, 0, 20, 12);
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(-10, 10, 20, 3);
    ctx.fillStyle = '#f1d5b0';
    ctx.fillRect(-8, -10, 16, 10);
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, -12, 16, 4);
    ctx.fillStyle = '#1c1c1c';
    const eyeY = hero.dir === 'up' ? -7 : -6;
    ctx.fillRect(-4, eyeY, 2, 2);
    ctx.fillRect(2, eyeY, 2, 2);
    ctx.restore();
}

function drawNPC() {
    ctx.save();
    ctx.translate(npc.x, npc.y);
    ctx.scale(-1,1);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();ctx.ellipse(0,18,10,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#3a6de0';ctx.fillRect(-9,-2,18,12);
    ctx.fillStyle = '#2b2b2b';ctx.fillRect(-8,10,6,10);ctx.fillRect(2,10,6,10);
    ctx.fillStyle = '#f1d5b0';ctx.fillRect(-7,-10,14,10);
    ctx.fillStyle = '#222';ctx.fillRect(-7,-12,14,4);
    ctx.fillStyle = '#1c1c1c';ctx.fillRect(-3,-6,2,2);ctx.fillRect(1,-6,2,2);
    ctx.restore();
}

function drawPortal() {
    if (!portalVisible || inSchool) { portalPos = null; return; }
    const x = tile * 1.5; // centered left on road
    const y = roadY + roadHeight / 2; // exact road center
    const grd = ctx.createRadialGradient(x,y,6,x,y,22);
    grd.addColorStop(0,'rgba(80,180,255,0.6)');
    grd.addColorStop(1,'rgba(80,180,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#0f1c2b';
    ctx.beginPath();ctx.ellipse(x,y,18,8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle = '#57c5ff';
    ctx.beginPath();ctx.ellipse(x,y,10,4,0,0,Math.PI*2);ctx.fill();
    // Hitbox raised to align with the visible portal center
    // Raise hitbox roughly half a tile above the portal center
    portalPos = {x, y: y - tile/2, rx:8, ry:3};
}

function drawSchool() {
    // background grass reused
    for (let r=0;r<fieldMap.length;r++){
        for (let c=0;c<fieldMap[r].length;c++){
            ctx.fillStyle = colors[r][c];
            ctx.fillRect(c*tile, r*tile, tile, tile);
            if (tufts[r][c]) {
                ctx.fillStyle = '#5ba764';
                ctx.fillRect(c*tile+10, r*tile+10, 4, 8);
            }
        }
    }
    const bW = canvas.width*0.68;
    const bH = canvas.height*0.55;
    const bX = (canvas.width-bW)/2;
    const bY = canvas.height*0.18;
    const depth = 28;
    const mainColor='#d55353', sideColor='#c14343', roofColor='#b63f3f', roofShade='#9e2f2f';
    ctx.fillStyle=mainColor; ctx.fillRect(bX,bY,bW,bH);
    ctx.fillStyle=sideColor;
    ctx.beginPath();ctx.moveTo(bX,bY);ctx.lineTo(bX-depth,bY-10);ctx.lineTo(bX-depth,bY+bH-10);ctx.lineTo(bX,bY+bH);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(bX+bW,bY);ctx.lineTo(bX+bW+depth,bY-10);ctx.lineTo(bX+bW+depth,bY+bH-10);ctx.lineTo(bX+bW,bY+bH);ctx.closePath();ctx.fill();
    ctx.fillStyle=roofColor;
    ctx.beginPath();ctx.moveTo(bX,bY);ctx.lineTo(bX+bW/2,bY-50);ctx.lineTo(bX+bW,bY);ctx.closePath();ctx.fill();
    ctx.fillRect(bX,bY-18,bW,18);
    ctx.fillStyle=roofShade;
    ctx.beginPath();ctx.moveTo(bX+bW,bY-18);ctx.lineTo(bX+bW+depth,bY-6);ctx.lineTo(bX+bW+depth,bY+6);ctx.lineTo(bX+bW,bY-6);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(bX,bY-18);ctx.lineTo(bX-depth,bY-6);ctx.lineTo(bX-depth,bY+6);ctx.lineTo(bX,bY-6);ctx.closePath();ctx.fill();
    // windows
    ctx.fillStyle='#f0f7ff'; ctx.strokeStyle='#b43d3d'; ctx.lineWidth=2;
    const cols=5, rows=3, padX=20, padY=40, winW=34, winH=28, gapX=(bW-padX*2-cols*winW)/(cols-1), gapY=22;
    for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
            const wx=bX+padX+c*(winW+gapX), wy=bY+padY+r*(winH+gapY);
            ctx.fillRect(wx,wy,winW,winH);
            ctx.strokeRect(wx,wy,winW,winH);
            ctx.strokeRect(wx+winW/2-1, wy, 2, winH);
            ctx.strokeRect(wx, wy+winH/2-1, winW, 2);
        }
    }
    // door
    door.x = canvas.width*0.5;
    door.y = bY + bH - door.h/2 - 8;
    drawDoor();
    // sign
    const signW=145, signH=18;
    const signX = canvas.width*0.5 - signW/2;
    const signY = bY + 8;
    ctx.fillStyle = '#f4ebeb';
    ctx.fillRect(signX, signY, signW, signH);
    ctx.strokeStyle = '#a43a3a'; ctx.lineWidth=2; ctx.strokeRect(signX, signY, signW, signH);
    ctx.fillStyle = '#1e1e1e'; ctx.font = '7px "Press Start 2P", cursive'; ctx.textBaseline='middle'; ctx.textAlign='center';
    ctx.fillText('Mirlow High School', signX+signW/2, signY+signH/2);
}

function drawDoor() {
    ctx.save();
    ctx.translate(door.x, door.y);
    ctx.fillStyle = '#a57c52';
    ctx.fillRect(-door.w/2, -door.h/2, door.w, door.h);
    ctx.fillStyle = '#8b623c';
    ctx.fillRect(-door.w/2+3, -door.h/2+3, door.w-6, door.h-8);
    ctx.fillStyle = '#d9c7a7';
    ctx.beginPath();ctx.arc(door.w/2-6, 0, 3, 0, Math.PI*2);ctx.fill();
    ctx.restore();
}

function loop(now) {
    const dt = Math.min((now-lastTime)/1000, 0.05);
    lastTime = now;
    let vx=0, vy=0;
    if (!dialogActive && !loading) {
        if (keysDown.has('w')||keysDown.has('arrowup')) vy -= 1;
        if (keysDown.has('s')||keysDown.has('arrowdown')) vy += 1;
        if (keysDown.has('a')||keysDown.has('arrowleft')) vx -= 1;
        if (keysDown.has('d')||keysDown.has('arrowright')) vx += 1;
    }
    const mag = Math.hypot(vx,vy) || 1;
    vx = (vx/mag)*hero.speed*dt;
    vy = (vy/mag)*hero.speed*dt;
    const nx = hero.x + vx;
    const ny = hero.y + vy;
    const pad = hero.size/2;
    const block = (x,y)=> inSchool ? false : blocked(x,y);
    if (!block(nx-pad, hero.y) && !block(nx+pad, hero.y)) hero.x = nx;
    if (!block(hero.x, ny-pad) && !block(hero.x, ny+pad)) hero.y = ny;

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
        hero.frameTimer += dt * 8;
        if (hero.frameTimer > 1) {
            hero.frame = 1 - hero.frame;
            hero.frameTimer = 0;
        }
    } else {
        hero.frame = 0;
        hero.frameTimer = 0;
    }

    if (!inSchool) {
        const fx1 = npc.x - 24, fx2 = npc.x + 24, fy1 = npc.y - 10, fy2 = npc.y + 40;
        const inFront = hero.x > fx1 && hero.x < fx2 && hero.y > fy1 && hero.y < fy2;
        if (inFront && !dialogActive && !portalVisible) {
            dialogStep = 0;
            showDialog(npcDialog[0]);
        }
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (!inSchool) {
        drawField();
        drawNPC();
        drawPortal();
    } else {
        drawSchool();
    }
    drawHero();

    // portal collide
    if (portalPos && !inSchool && !loading) {
        const dx = hero.x - portalPos.x;
        const dy = hero.y - portalPos.y;
        const inside = (dx*dx)/(portalPos.rx*portalPos.rx) + (dy*dy)/(portalPos.ry*portalPos.ry) <= 1;
        if (inside) {
            loading = true;
            if (loadingOverlay) loadingOverlay.hidden = false;
            showDialog('...', true);
            setTimeout(() => {
                if (loadingOverlay) loadingOverlay.hidden = true;
                hideDialog();
                inSchool = true;
                hero.x = tile*2;
                hero.y = canvas.height - tile*2;
                loading = false;
            }, 800);
        }
    }

    // door message
    if (inSchool && !dialogActive) {
        const padX=6, padY=6;
        const withinX = hero.x > door.x - door.w/2 - padX && hero.x < door.x + door.w/2 + padX;
        const withinY = hero.y > door.y - door.h/2 - padY && hero.y < door.y + door.h/2 + padY;
        if (withinX && withinY && !doorCooldown) {
            doorCooldown = true;
            showDialog('This door is locked.', true);
        }
        if (!withinX || !withinY) doorCooldown = false;
    }

    requestAnimationFrame(loop);
}
