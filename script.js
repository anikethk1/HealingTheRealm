const slides = document.querySelectorAll('.slide');
const toast = document.getElementById('toast');
let toastTimer = null;
let authUser = localStorage.getItem('authUser') || null;

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

function showSlide(id) {
    const next = document.getElementById(id);
    if (!next) return;

    // Gate navigation if not authenticated
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
    if (push) {
        try {
            history.pushState({ slide: id }, '', `#${id}`);
        } catch (_) {}
    } else {
        try {
            history.replaceState({ slide: id }, '', `#${id}`);
        } catch (_) {}
    }
}

function showMessage(element, message, type = 'info') {
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
    element.hidden = !message;
}

function showToast(message, type = 'success', duration = 2200) {
    if (!toast) return;
    if (toastTimer) {
        clearTimeout(toastTimer);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => {
        toast.classList.remove('is-visible');
    }, duration);
}

// Delegate clicks for any element with data-target to switch slides
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-target]');
    if (!target) return;
    const id = target.getAttribute('data-target');
    if (id) navigateTo(id);
});

// Handle browser back/forward
window.addEventListener('popstate', (e) => {
    const id = e.state?.slide || (location.hash ? location.hash.slice(1) : 'login-slide');
    showSlide(id);
});

// On load, respect hash or set login if not authed
window.addEventListener('DOMContentLoaded', () => {
    const initialFromHash = location.hash ? location.hash.slice(1) : null;
    const initial = isAuthenticated() ? (initialFromHash || 'intro-slide') : 'login-slide';
    navigateTo(initial, false);
    if (isAuthenticated()) loadGoals();
});

async function submitForm(endpoint, payload) {
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        const message = data.message || 'Request failed.';
        throw new Error(message);
    }
    return data;
}

// Signup handling
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
            showMessage(signupMessage, '', 'success');
            showToast('Account created. You can log in now.', 'success');
            signupForm.reset();
            navigateTo('login-slide');
        } catch (err) {
            showMessage(signupMessage, err.message, 'error');
        }
    });
}

// Login handling
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
            showMessage(loginMessage, '', 'success');
            showToast('Login successful!', 'success');
            await loadGoals();
            navigateTo('intro-slide');
        } catch (err) {
            showMessage(loginMessage, err.message, 'error');
        }
    });
}

// Logout (simple clear and redirect)
const logoutButtons = document.querySelectorAll('[data-logout]');
logoutButtons.forEach(btn => {
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
    goals.forEach((goal) => {
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
        const completeBtn = document.createElement('button');
        completeBtn.type = 'button';
        completeBtn.className = 'btn btn--secondary btn--accent btn--small';
        completeBtn.textContent = goal.completed ? 'Mark Incomplete' : 'Mark Completed';
        completeBtn.addEventListener('click', () => setGoalCompleted(goal.id, goal.completed ? 0 : 1));
        actions.appendChild(completeBtn);

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

async function markGoalComplete(id) {
    return setGoalCompleted(id, 1);
}

async function setGoalCompleted(id, completedValue) {
    if (!authUser) return;
    try {
        const res = await fetch(`/api/goals/${id}/complete`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: authUser, completed: completedValue })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not update goal.');
        goals = goals.map(g => g.id === id ? { ...g, completed: completedValue } : g);
        renderGoals();
        showToast(completedValue ? 'Goal marked completed.' : 'Goal marked incomplete.', 'success');
    } catch (err) {
        showToast(err.message || 'Update failed.', 'error');
    }
}

async function deleteGoal(id) {
    if (!authUser) return;
    try {
        const res = await fetch(`/api/goals/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: authUser })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not delete goal.');
        goals = goals.filter(g => g.id !== id);
        renderGoals();
        showToast('Goal deleted.', 'success');
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
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: authUser, title, description })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) throw new Error(data.message || 'Could not save goal.');
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
