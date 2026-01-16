const slides = document.querySelectorAll('.slide');
const toast = document.getElementById('toast');
let toastTimer = null;
let authUser = localStorage.getItem('authUser') || null;

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
