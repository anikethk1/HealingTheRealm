const slides = document.querySelectorAll('.slide');
const toast = document.getElementById('toast');
let toastTimer = null;
let authUser = null;
const playfield = document.querySelector('.playfield');
const storyResetBtn = document.getElementById('story-reset');
const fullscreenBtn = document.getElementById('fullscreen-toggle');
const fullscreenBtnIcon = fullscreenBtn?.querySelector('.fullscreen-btn__icon');
const guidePopup = document.getElementById('guide-popup');
const guidePopupTitle = document.getElementById('guide-popup-title');
const guideAvatar = document.getElementById('guide-avatar');
const guideQuests = document.getElementById('guide-quests');
const guideQuestsClose = document.getElementById('guide-quests-close');
const guidePopupNext = document.getElementById('guide-popup-next');
const guidePopupOption2 = document.getElementById('guide-popup-option-2');
const guidePopupOption3 = document.getElementById('guide-popup-option-3');
const guidePopupLine = document.getElementById('guide-popup-line');
const guideAvatarAlert = document.getElementById('guide-avatar-alert');

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
    const id = e.state?.slide || (location.hash ? location.hash.slice(1) : 'world-slide');
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
    // Always drop into the world slide for a fresh NPC scene
    navigateTo('world-slide', false);
    startWorldDemo();
});

// Fullscreen toggle
function syncFullscreenButton() {
    if (!fullscreenBtn) return;
    const isFullscreen = Boolean(document.fullscreenElement);
    fullscreenBtn.setAttribute('aria-label', isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
    fullscreenBtn.title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
    if (fullscreenBtnIcon) {
        fullscreenBtnIcon.innerHTML = isFullscreen ? '&times;' : '&#9974;';
    }
}

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
document.addEventListener('fullscreenchange', syncFullscreenButton);
syncFullscreenButton();
storyResetBtn?.addEventListener('click', () => {
    currentStartScene = 'intro';
    navigateTo('world-slide', false);
    showToast('Story reset to the beginning.', 'info');
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
const loadingOverlayText = loadingOverlay?.querySelector('p');
let dialogTimer = null;
let dialogActive = false;
let dialogComplete = false;
let currentDialog = '';
let dialogStep = 0;
let currentStartScene = 'gym';
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
let schoolRect = null;
const door = { x: 0, y: 0, w: 34, h: 48 };
let doorCooldown = false;
let guidePopupVisible = false;
let guideQuestsVisible = false;
let guideIntroShown = false;
let guideWalkTime = 0;
let guideLineIdx = 0;
let guideLineComplete = false;
let guideTypeTimer = null;
let guidePopupTimer = null;
let newQuest = null;
let newQuestAlert = false;
let inGrey = false;
let inGym = false;
let inMusicRoom = false;
let inBasketballGame = false;
let inPianoGame = false;
const girl = { x: 0, y: 0, visible: true, talked: false };
let doorLocked = true;
let girlWalking = false;
let playerFrozen = false;
let meetingNPCs = [];
let meetingObstacles = [];
let meetingChairs = [];
let meetingPortalVisible = false;
let gymObstacles = [];
let gymNPCs = [];
let musicRoomObstacles = [];
let activeLines = [];
let activeFace = 'images/player_idle.png';
let activeConversation = 'guide';
let popupPrimaryLabel = 'Next';
let popupInstantMode = false;
let managerIntroShown = false;
let pendingChoiceSet = null;
let popupChoices = null;
let albertState = 'intro';
let albertTalkCooldown = false;
let albertQuestCompleted = false;
let leenaState = 'intro';
let leenaQuestCompleted = false;
const albert = { x: 0, y: 0 };
const leena = { x: 0, y: 0 };
let leenaTalkCooldown = false;
const basketballQuestInstructions = [
    '\n1. Objective: Successfully make 3 baskets to complete the quest.\n\n2. The Shot Meter: A bar will appear at the bottom of the screen with a moving arrow.\n- Green Area: Represents an accurate shot.\n- Red Area: Represents an inaccurate shot.\n\n3. Controls: Press the Space Bar when the arrow is inside the green area to make the basket.\n\n4. Increasing Difficulty: With every successful shot:\n- The arrow will move faster.\n- The green target area will become smaller.\n\n5. Failure Condition: If you fail to reach 3 baskets, you must speak to Albert to restart the quest.\n\nGood luck!'
];
const basketballRewardLines = [
    'That was a delightful game, we should play again sometime!',
    'But I know you have to find some items for the upcoming festival, good news for you, I have one of the items, here is a DODGEBALL!'
];
const basketballReplayPromptLines = [
    "My good friend, you've come again to see me! Would you like to play basketball!"
];
const basketballReplayRewardLines = [
    'That was a delightful game. We should play again sometime!'
];
const basketballReplayDeclineLines = [
    'Ah, I see you are busy, we should play another time! Come back soon!'
];
const basketballItemLines = [
    "CONGRATULATIONS YOU'VE OBTAINED ITEM 1: DODGEBALL."
];
const leenaIntroLines = [
    "I'm so glad you are here! You're here to get one of the items, right?",
    "Well there's a problem. I still need to tune the piano for the band.",
    "Since you're here, would you be able to spare some time and help me please?"
];
const leenaRetryLines = [
    'Would you be able to help me tune the piano?'
];
const leenaAcceptLines = [
    'I love your enthusiasm! Thank you so much! I will be so grateful to you.'
];
const leenaRewardLines = [
    "You're done? You did it so quickly!",
    'Thank you so much. I am so grateful for having a friend like you. Here is a fine tuned fiddle for the festival!'
];
const leenaCompletedLines = [
    'Thank you again for tuning the piano. The band is ready for the festival now!'
];
const pianoQuestInstructions = [
    '\n1. Objective: Match 10 falling notes to finish tuning the piano.\n\n2. Controls: Press the number keys 1 through 5 or click the matching piano key on screen.\n\n3. Timing: Only play the note when it touches the white key.\n\n4. Failure Condition: Pressing too early, pressing the wrong key, or missing a note will end the game and you must talk to Leena to restart.\n\nGood luck!'
];
const pianoItemLines = [
    "CONGRATULATIONS YOU'VE OBTAINED ITEM 2: FIDDLE."
];
const pianoEncouragements = [
    'You play wonderfully!',
    'That note was perfect!',
    'Beautiful timing!',
    'The tune is coming together!',
    "You've got a great ear for this!"
];
const basketballGame = {
    required: 3,
    made: 0,
    mode: 'idle',
    meterPos: 0.5,
    meterDir: 1,
    meterSpeed: 0.7,
    greenCenter: 0.5,
    greenWidth: 0.34,
    shotTime: 0,
    shotDuration: 1.05,
    shotSuccess: false,
    armTimer: 0
};
const pianoGame = {
    required: 10,
    matched: 0,
    laneCount: 5,
    currentLane: 2,
    noteY: -56,
    noteSpeed: 240,
    spawnTimer: 0.4,
    active: false,
    feedback: 'Press 1-5 or click a piano key when the note touches the white key.',
    feedbackTimer: 0,
    flashLane: -1,
    flashTimer: 0
};
const guideLines = [
    'Oh, hey there!',
    "I'm the Guide Master, your guide through your first mental health journey here at Mirlow High School!",
    'During your time here at Mirlow, you will have to complete quests to complete this story, make sure to talk to the characters in the rooms and areas you\'re in, walk around and explore the map, you might find some hidden secrets :).',
    'Once you\'re done reading this message, you can click on my face at the top left of your screen and all your current quests can be seen!',
    'Start your journey by talking to the girl in front of your high school. Good luck!'
];
const girlLines = [
    'Hello! Thank you so much for joining the Student Advisory Committee of Mirlow High.',
    'We have a meeting today about the upcoming cultural festival that is being held at the school.',
    'Let\'s go! They are waiting for us, come with me into school!'
];
const advisoryManagerIntroLines = [
    'Hello everyone! Thank you for coming to this meeting!',
    'We need all hands on deck to make sure that this cultural festival goes well and it is up to you guys to get the school ready for the festival on time!',
    'I have most of the supplies but there are still some missing items. Can one of you help me with a favor, please help me find these missing items!',
    'The good news is that all of the items are on school grounds! You will get a reward at the end!',
    'Will you help the manager?'
];
const advisoryManagerAcceptLines = [
    'Perfect! Thank you so much! You are an amazing person!',
    'Here is the list, from what I know, I think Albert in the gym could help you with some sports equipment that we need if it helps you start.'
];
const albertIntroLines = [
    "Hello, what's up with that list in your hand? Oh you are trying to find something?",
    "I'm trying to practice for the big basketball game next week but I don't think I'm good enough. What if they laugh at me if I don't get the ball in the net."
];
const albertOfferLines = [
    "You are such a good friend for offering, I'd love to practice with you, if you're free now we can do some shooting drills to build my confidence?"
];
const albertEmpathyLines = [
    'Thanks. I just keep overthinking it.',
    "You're saying the one helpful way to overcome this anxiety might be to have a bit of shooting practice?",
    'Will you help me practice my shooting to help build my confidence?'
];
const albertPracticePromptLines = [
    'Will you help me practice my shooting to help build my confidence?'
];
const albertNoLines = [
    "Alright, I'm free whenever you are!"
];

function syncPlayfieldTheme() {
    playfield?.classList.toggle('playfield--meeting', inGrey || inGym || inMusicRoom || inBasketballGame || inPianoGame);
}

function setQuest(quest, showAlert = false) {
    newQuest = quest;
    newQuestAlert = Boolean(quest && showAlert);
    if (guideAvatarAlert) guideAvatarAlert.hidden = !newQuestAlert;
    renderQuests();
}

function setLoadingMessage(message = '') {
    if (loadingOverlayText) loadingOverlayText.textContent = message;
}

function resetPopupChoices() {
    popupChoices = null;
    if (guidePopupOption2) guidePopupOption2.hidden = true;
    if (guidePopupOption3) guidePopupOption3.hidden = true;
}

function resetBasketballGame() {
    basketballGame.made = 0;
    basketballGame.mode = 'idle';
    basketballGame.meterPos = 0.5;
    basketballGame.meterDir = 1;
    basketballGame.meterSpeed = 0.7;
    basketballGame.greenCenter = 0.5;
    basketballGame.greenWidth = 0.34;
    basketballGame.shotTime = 0;
    basketballGame.shotDuration = 1.05;
    basketballGame.shotSuccess = false;
    basketballGame.armTimer = 0;
}

function resetPianoGame() {
    pianoGame.matched = 0;
    pianoGame.currentLane = Math.floor(Math.random() * pianoGame.laneCount);
    pianoGame.noteY = -56;
    pianoGame.noteSpeed = 240;
    pianoGame.spawnTimer = 0.4;
    pianoGame.active = false;
    pianoGame.feedback = 'Press 1-5 or click a piano key when the note touches the white key.';
    pianoGame.feedbackTimer = 0;
    pianoGame.flashLane = -1;
    pianoGame.flashTimer = 0;
}

function updatePopupChoiceButtons() {
    const buttons = [guidePopupNext, guidePopupOption2, guidePopupOption3];
    buttons.forEach((button, idx) => {
        if (!button) return;
        const choice = popupChoices?.[idx];
        if (choice) {
            button.hidden = false;
            button.textContent = choice.label;
        } else if (idx > 0) {
            button.hidden = true;
            button.textContent = '';
        }
    });
}

function closeGuideConversation() {
    guidePopupVisible = false;
    clearGuideTimer();
    if (guidePopup) guidePopup.hidden = true;
    pendingChoiceSet = null;
    resetPopupChoices();
    popupPrimaryLabel = 'Next';
    popupInstantMode = false;
}

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

function startWorldDemo(startScene = currentStartScene) {
    currentStartScene = startScene;
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
    guidePopupVisible = false;
    guideQuestsVisible = false;
    if (guidePopup) guidePopup.hidden = true;
    if (guideQuests) guideQuests.hidden = true;
    if (loadingOverlay) loadingOverlay.hidden = true;
    hideDialog();
    guideIntroShown = false;
    guideWalkTime = 0;
    guideLineIdx = 0;
    guideLineComplete = false;
    setQuest(null);
    doorLocked = true;
    inGrey = false;
    inGym = false;
    inMusicRoom = false;
    inBasketballGame = false;
    inPianoGame = false;
    managerIntroShown = false;
    meetingPortalVisible = false;
    albertState = 'intro';
    albertTalkCooldown = false;
    albertQuestCompleted = false;
    leenaState = 'intro';
    leenaQuestCompleted = false;
    leenaTalkCooldown = false;
    musicRoomObstacles = [];
    resetBasketballGame();
    resetPianoGame();
    girl.visible = true;
    girl.talked = false;
    girlWalking = false;
    playerFrozen = false;
    // place girl to the right/front of door
    // place girl in front-right of the school
    girl.x = door.x + 110;
    girl.y = door.y + 20;
    girlWalking = false;
    playerFrozen = false;
    activeLines = guideLines;
    activeFace = 'images/player_idle.png';
    activeConversation = 'guide';
    pendingChoiceSet = null;
    resetPopupChoices();
    clearGuideTimer();
    keysDown.clear();
    lastTime = performance.now();
    setLoadingMessage();
    syncPlayfieldTheme();

    if (startScene === 'gym') {
        inGym = true;
        initGymCourt();
        if (guideAvatar) guideAvatar.hidden = false;
        setQuest('Go to the gym and talk to Albert', true);
        syncPlayfieldTheme();
    } else {
        if (guideAvatar) guideAvatar.hidden = true;
        setQuest(null);
    }

    if (!worldBooted) {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        dialogNext?.addEventListener('click', handleDialogNext);
        canvas?.addEventListener('mousedown', handleCanvasPointerDown);
        document.addEventListener('mousedown', (e) => {
            if (dialogActive && !dialogComplete) {
                finishDialog();
                e.stopPropagation();
            }
        });
        requestAnimationFrame(loop);
        worldBooted = true;
    }
}

function handleDialogNext() {
    if (!dialogActive) return;
    if (!dialogComplete) {
        finishDialog();
        return;
    }

    // NPC 3-line sequence
    if (!portalVisible && dialogStep < npcDialog.length - 1) {
        dialogStep += 1;
        showDialog(npcDialog[dialogStep]);
        return;
    }
    // Finished the last line: reveal portal and close dialog
    if (!portalVisible && dialogStep === npcDialog.length - 1) {
        portalVisible = true;
        hideDialog();
        return;
    }

    // Generic dialogs (door / loading) just close
    hideDialog();
}

function handleKeyDown(e) {
    const k = e.key.toLowerCase();
    if (inPianoGame && !guidePopupVisible && !loading && ['1', '2', '3', '4', '5'].includes(k)) {
        e.preventDefault();
        handlePianoInput(Number(k) - 1);
        return;
    }
    if (inBasketballGame && !guidePopupVisible && !loading && k === ' ') {
        e.preventDefault();
        handleBasketballShot();
        return;
    }
    if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        if (dialogActive || loading || guidePopupVisible || guideQuestsVisible) {
            e.preventDefault();
            return;
        }
        keysDown.add(k);
        e.preventDefault();
    }
    if (guidePopupVisible && ['enter',' '].includes(k)) {
        e.preventDefault();
        guidePopupNext?.click();
        return;
    }
    if (dialogActive && ['enter',' '].includes(k)) {
        e.preventDefault();
        if (!dialogComplete) finishDialog(); else hideDialog();
    }
}
function handleKeyUp(e) {
    keysDown.delete(e.key.toLowerCase());
}

function handleCanvasPointerDown(e) {
    if (!inPianoGame || guidePopupVisible || loading || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const pointerX = (e.clientX - rect.left) * scaleX;
    const pointerY = (e.clientY - rect.top) * scaleY;
    const layout = getPianoLayout();

    if (pointerY < layout.keyY || pointerY > layout.keyY + layout.keyHeight) return;

    for (let lane = 0; lane < pianoGame.laneCount; lane++) {
        const keyX = layout.keyX + lane * (layout.keyWidth + layout.keyGap);
        if (pointerX >= keyX && pointerX <= keyX + layout.keyWidth) {
            handlePianoInput(lane);
            return;
        }
    }
}

function blocked(x, y) {
    if (inGrey) return meetingBlocked(x, y);
    if (inGym) return gymBlocked(x, y);
    if (inMusicRoom) return musicRoomBlocked(x, y);
    if (inSchool && schoolRect) {
        const inside = x > schoolRect.x1 && x < schoolRect.x2 && y > schoolRect.y1 && y < schoolRect.y2;
        if (!inside) return false;

        // Doorway passage: allow through the doorway from ground up to the door height
        const doorwayWidth = door.w + 8;
        const dx1 = door.x - doorwayWidth / 2;
        const dx2 = door.x + doorwayWidth / 2;
        const dy1 = door.y - door.h / 2 - 4; // just below the door top
        const dy2 = schoolRect.y2 + 20;      // extend to ground
    const inDoorway = x > dx1 && x < dx2 && y > dy1 && y < dy2;
        return !inDoorway; // block everywhere except doorway
    }
    const col = Math.floor(x / tile);
    const row = Math.floor(y / tile);
    return fieldMap[row]?.[col] === 1;
}

function meetingBlocked(x, y) {
    // Boundaries
    const margin = 12;
    if (x < margin || x > canvas.width - margin || y < margin || y > canvas.height - margin) return true;
    // Tables / furniture
    for (const r of meetingObstacles) {
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    return false;
}

function gymBlocked(x, y) {
    const margin = 12;
    if (x < margin || x > canvas.width - margin || y < margin || y > canvas.height - margin) return true;
    return false;
}

function musicRoomBlocked(x, y) {
    const margin = 12;
    if (x < margin || x > canvas.width - margin || y < margin || y > canvas.height - margin) return true;
    for (const r of musicRoomObstacles) {
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return true;
    }
    return false;
}

function initMeetingRoom() {
    meetingObstacles = [];
    meetingNPCs = [];
    meetingChairs = [];
    meetingPortalVisible = false;

    // Player start point inside meeting room
    hero.x = canvas.width * 0.54;
    hero.y = canvas.height - 44;

    const topTable = { x: 110, y: 54, w: 360, h: 26, kind: 'table' };
    const leftTable = { x: 86, y: 80, w: 26, h: 196, kind: 'table' };
    const bottomTable = { x: 110, y: 250, w: 360, h: 26, kind: 'table' };
    const presenterTable = { x: 546, y: 116, w: 26, h: 96, kind: 'table' };

    meetingObstacles.push(topTable, leftTable, bottomTable, presenterTable);

    const topChairXs = [132, 174, 216, 258, 300, 342, 384, 426];
    topChairXs.forEach(x => meetingChairs.push({ x, y: 38, w: 18, h: 10, dir: 'down' }));

    const bottomChairXs = [132, 174, 216, 258, 300, 342, 384, 426];
    bottomChairXs.forEach(x => meetingChairs.push({ x, y: 288, w: 18, h: 10, dir: 'up' }));

    const leftChairYs = [102, 146, 190, 234];
    leftChairYs.forEach(y => meetingChairs.push({ x: 58, y, w: 10, h: 18, dir: 'right' }));

    meetingNPCs.push(
        { x: 132, y: 52, facing: 'down', shirt: '#d45c5c', hair: '#654321', skin: '#f0c9a4', pose: 'seated' },
        { x: 174, y: 52, facing: 'down', shirt: '#5c6bc0', hair: '#33261f', skin: '#e7c19e', pose: 'seated' },
        { x: 216, y: 52, facing: 'down', shirt: '#3aa76d', hair: '#3b2a1e', skin: '#f1d5b0', pose: 'seated' },
        { x: 258, y: 52, facing: 'down', shirt: '#d9a93f', hair: '#4c3427', skin: '#deb58b', pose: 'seated' },
        { x: 342, y: 52, facing: 'down', shirt: '#8e5ad6', hair: '#2f2320', skin: '#f2cfb1', pose: 'seated' },
        { x: 384, y: 52, facing: 'down', shirt: '#e07a34', hair: '#472d1d', skin: '#e8bd93', pose: 'seated' },
        { x: 426, y: 52, facing: 'down', shirt: '#3a6de0', hair: '#241914', skin: '#f1d5b0', pose: 'seated' },
        { x: 132, y: 276, facing: 'up', shirt: '#3a6de0', hair: '#2c211a', skin: '#efcfaa', pose: 'seated' },
        { x: 174, y: 276, facing: 'up', shirt: '#d45c5c', hair: '#5b3d2c', skin: '#dfb086', pose: 'seated' },
        { x: 216, y: 276, facing: 'up', shirt: '#3aa76d', hair: '#3a291e', skin: '#f0c8a0', pose: 'seated' },
        { x: 342, y: 276, facing: 'up', shirt: '#d9a93f', hair: '#4b3324', skin: '#e9c19a', pose: 'seated' },
        { x: 384, y: 276, facing: 'up', shirt: '#5c6bc0', hair: '#2d2016', skin: '#f1d5b0', pose: 'seated' },
        { x: 426, y: 276, facing: 'up', shirt: '#8e5ad6', hair: '#3b2924', skin: '#e7be99', pose: 'seated' },
        { x: 72, y: 104, facing: 'right', shirt: '#e07a34', hair: '#2f2117', skin: '#eec9a4', pose: 'seated' },
        { x: 72, y: 148, facing: 'right', shirt: '#5c6bc0', hair: '#4a3328', skin: '#f1d0b0', pose: 'seated' },
        { x: 72, y: 192, facing: 'right', shirt: '#3aa76d', hair: '#3d2618', skin: '#e2b68a', pose: 'seated' },
        { x: 72, y: 236, facing: 'right', shirt: '#d45c5c', hair: '#2d211b', skin: '#f0c49d', pose: 'seated' },
        { x: 516, y: 174, facing: 'left', shirt: '#d45c5c', hair: '#231913', skin: '#f0caa2', pose: 'standing' }
    );
}

function initGymCourt() {
    gymObstacles = [];
    gymNPCs = [];
    meetingPortalVisible = false;
    hero.x = canvas.width * 0.2;
    hero.y = canvas.height * 0.72;
    albert.x = canvas.width - 92;
    albert.y = canvas.height * 0.5 + 34;
    gymNPCs.push({ x: albert.x, y: albert.y, facing: 'left', pose: 'standing' });
    albertTalkCooldown = false;
}

function initMusicRoom() {
    musicRoomObstacles = [];
    hero.x = canvas.width - 104;
    hero.y = canvas.height - 64;
    leena.x = 108;
    leena.y = 108;
    leenaTalkCooldown = false;

    musicRoomObstacles.push(
        { x: 204, y: 14, w: 238, h: 42 },
        { x: 44, y: 146, w: 182, h: 136 },
        { x: 274, y: 84, w: 158, h: 64 }
    );
}

function drawMeetingRoom() {
    // Warm wood floor with planks
    ctx.fillStyle = '#caa06b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < 22; i++) {
        const y = i * 22;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.035)';
        ctx.fillRect(0, y, canvas.width, 10);
    }

    ctx.strokeStyle = '#7d5d38';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    meetingObstacles.forEach(r => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
    });

    meetingChairs.forEach(chair => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(chair.x, chair.y, chair.w, chair.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 1;
        ctx.strokeRect(chair.x, chair.y, chair.w, chair.h);
    });

    meetingNPCs.forEach(attendee => {
        drawMeetingNPC(attendee);
    });

    if (meetingPortalVisible) {
        const x = 58;
        const y = 54;
        drawIndoorPortal(x, y);
        portalPos = { x, y: y - 10, rx: 10, ry: 5, target: 'gym' };
    } else {
        portalPos = null;
    }

    // Draw hero last in room
    drawHero();
}

function drawIndoorPortal(x, y) {
    const grd = ctx.createRadialGradient(x, y, 8, x, y, 26);
    grd.addColorStop(0, 'rgba(80,180,255,0.75)');
    grd.addColorStop(1, 'rgba(80,180,255,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#102235';
    ctx.beginPath();
    ctx.ellipse(x, y, 21, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fd6ff';
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
}

function drawGymCourt() {
    portalPos = null;
    ctx.fillStyle = '#dfaf85';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#8b5f3b';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#fff6ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 16);
    ctx.lineTo(canvas.width / 2, canvas.height - 16);
    ctx.stroke();

    ctx.fillStyle = '#ff7365';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff6ee';
    ctx.stroke();

    const drawHalfCourt = (left) => {
        const midY = canvas.height / 2;
        const rimX = left ? 54 : canvas.width - 54;
        const paintX = left ? 16 : canvas.width - 74;
        const paintW = 58;
        const paintH = 96;
        const paintY = midY - paintH / 2;
        const freeThrowX = left ? paintX + paintW : paintX;
        const threePointCenterX = left ? 16 : canvas.width - 16;
        const threePointRadius = 108;

        ctx.fillStyle = '#ff7365';
        ctx.fillRect(paintX, paintY, paintW, paintH);
        ctx.strokeStyle = '#fff6ee';
        ctx.strokeRect(paintX, paintY, paintW, paintH);

        ctx.beginPath();
        if (left) {
            ctx.arc(freeThrowX, midY, 30, -Math.PI / 2, Math.PI / 2);
        } else {
            ctx.arc(freeThrowX, midY, 30, Math.PI / 2, Math.PI * 1.5);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.setLineDash([6, 5]);
        if (left) {
            ctx.arc(freeThrowX, midY, 30, Math.PI / 2, Math.PI * 1.5);
        } else {
            ctx.arc(freeThrowX, midY, 30, -Math.PI / 2, Math.PI / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        if (left) {
            ctx.arc(threePointCenterX, midY, threePointRadius, -Math.PI / 2, Math.PI / 2);
        } else {
            ctx.arc(threePointCenterX, midY, threePointRadius, Math.PI / 2, Math.PI * 1.5);
        }
        ctx.stroke();
    };

    drawHalfCourt(true);
    drawHalfCourt(false);

    if (albertQuestCompleted) {
        const portalX = 58;
        const portalY = 54;
        drawIndoorPortal(portalX, portalY);
        portalPos = { x: portalX, y: portalY - 10, rx: 10, ry: 5, target: 'music-room' };
    }

    drawMeetingNPC({ x: albert.x, y: albert.y, facing: 'left', pose: 'standing', shirt: '#3a6de0', hair: '#2d2018', skin: '#efcb9d' });
    drawHero();
}

function drawMusicRoom() {
    const w = canvas.width;
    const h = canvas.height;
    portalPos = null;

    ctx.fillStyle = '#3d8f8f';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#4c9f9b';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(40, 48);
    ctx.lineTo(40, h - 18);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w - 40, 48);
    ctx.lineTo(w - 40, h - 18);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5fb3ac';
    ctx.fillRect(0, 0, w, 52);

    const floorY = 54;
    ctx.fillStyle = '#6b3321';
    ctx.fillRect(24, floorY, w - 48, h - floorY - 12);

    for (let i = 0; i < 10; i++) {
        const plankY = floorY + i * 26;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(24, plankY, w - 48, 14);
    }
    for (let i = 0; i < 12; i++) {
        const seamX = 54 + i * 46;
        ctx.strokeStyle = 'rgba(80, 28, 18, 0.28)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(seamX, floorY + 4);
        ctx.lineTo(seamX + (i % 2 === 0 ? 10 : -8), h - 20);
        ctx.stroke();
    }

    ctx.fillStyle = '#b98a53';
    ctx.fillRect(202, 16, 236, 34);
    ctx.fillStyle = '#2f7a46';
    ctx.fillRect(214, 22, 212, 22);
    ctx.strokeStyle = '#7a522d';
    ctx.lineWidth = 3;
    ctx.strokeRect(214, 22, 212, 22);
    ctx.fillStyle = '#f7f4ec';
    ctx.fillRect(356, 37, 18, 3);
    ctx.fillRect(380, 36, 14, 3);
    ctx.fillStyle = '#d7c48d';
    ctx.fillRect(406, 31, 16, 8);

    const drawDrum = (x, y, r, shell = '#cf4d42') => {
        ctx.fillStyle = shell;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dcdcdc';
        ctx.beginPath();
        ctx.arc(x, y, r - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6a6a6a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
    };
    const drawCymbal = (x, y, rx, ry) => {
        ctx.fillStyle = '#dfc160';
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9d7e2d';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#8a6d21';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
    };

    drawCymbal(98, 150, 24, 12);
    drawCymbal(70, 198, 18, 10);
    drawCymbal(178, 242, 28, 14);
    drawDrum(124, 182, 26);
    drawDrum(84, 230, 20);
    drawDrum(156, 230, 24);
    drawDrum(150, 282, 32);
    drawDrum(68, 286, 18, '#444');
    ctx.strokeStyle = '#8c8c8c';
    ctx.lineWidth = 3;
    [
        [98, 163, 98, 208],
        [70, 208, 58, 246],
        [178, 256, 188, 300],
        [124, 208, 114, 252],
        [84, 248, 76, 282],
        [156, 248, 164, 286]
    ].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    });

    ctx.save();
    ctx.translate(348, 110);
    ctx.rotate(-0.18);
    ctx.fillStyle = '#5d2f1d';
    ctx.beginPath();
    ctx.ellipse(-18, 0, 28, 22, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-2, -6, 102, 12);
    ctx.fillStyle = '#f1f1f1';
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(28, -12);
    ctx.lineTo(44, 6);
    ctx.lineTo(16, 20);
    ctx.lineTo(-2, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#be9a62';
    ctx.fillRect(98, -7, 26, 14);
    ctx.fillRect(122, -4, 12, 8);
    ctx.strokeStyle = '#4d2c1c';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const stringY = -5 + i * 2;
        ctx.beginPath();
        ctx.moveTo(0, stringY);
        ctx.lineTo(134, stringY * 0.4);
        ctx.stroke();
    }
    ctx.restore();

    const exitPortalX = w - 56;
    const exitPortalY = h - 42;
    drawIndoorPortal(exitPortalX, exitPortalY);
    portalPos = { x: exitPortalX, y: exitPortalY - 10, rx: 10, ry: 5, target: 'gym' };

    drawMeetingNPC({ x: leena.x, y: leena.y, facing: 'left', pose: 'standing', shirt: '#e56e8f', hair: '#3b2a24', skin: '#f0c8a2' });

    drawHero();
}

function getPianoLayout() {
    const w = canvas.width;
    const h = canvas.height;
    const keyGap = 10;
    const keyWidth = 84;
    const keyHeight = 84;
    const totalWidth = pianoGame.laneCount * keyWidth + (pianoGame.laneCount - 1) * keyGap;
    const keyX = (w - totalWidth) / 2;
    const keyY = h - 98;
    return {
        laneCenter: (lane) => keyX + lane * (keyWidth + keyGap) + keyWidth / 2,
        keyGap,
        keyHeight,
        keyWidth,
        keyX,
        keyY,
        missY: keyY + keyHeight + 12,
        topY: 62,
        noteRadiusY: 10
    };
}

function getNextPianoLane() {
    let next = Math.floor(Math.random() * pianoGame.laneCount);
    if (pianoGame.laneCount > 1) {
        while (next === pianoGame.currentLane) {
            next = Math.floor(Math.random() * pianoGame.laneCount);
        }
    }
    return next;
}

function showPianoInstructions() {
    playerFrozen = true;
    openInstantPopup('Instructions', 'images/player_idle.png', pianoQuestInstructions, 'piano-instructions', 'Done');
}

function startPianoQuest() {
    loading = true;
    playerFrozen = true;
    if (guideQuests) guideQuests.hidden = true;
    guideQuestsVisible = false;
    if (guideAvatar) guideAvatar.hidden = true;
    setLoadingMessage();
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        inMusicRoom = false;
        inPianoGame = true;
        resetPianoGame();
        setQuest('Tune 10 notes for Leena', false);
        syncPlayfieldTheme();
        loading = false;
        showPianoInstructions();
    }, 1400);
}

function exitPianoQuest(message, nextLeenaState = 'awaiting-tune', quest = 'Talk to Leena again to restart the piano tuning.') {
    loading = true;
    playerFrozen = true;
    setLoadingMessage(message);
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        setLoadingMessage();
        inPianoGame = false;
        inMusicRoom = true;
        initMusicRoom();
        if (guideAvatar) guideAvatar.hidden = false;
        leenaState = nextLeenaState;
        setQuest(quest, Boolean(quest));
        syncPlayfieldTheme();
        loading = false;
        playerFrozen = false;
    }, 1800);
}

function completePianoQuest() {
    loading = true;
    playerFrozen = true;
    setLoadingMessage('The piano is tuned and the band is ready.');
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        setLoadingMessage();
        inPianoGame = false;
        inMusicRoom = true;
        initMusicRoom();
        if (guideAvatar) guideAvatar.hidden = false;
        leenaState = 'completed';
        setQuest(null);
        syncPlayfieldTheme();
        loading = false;
        openGuideConversation('Leena', 'images/leena.jpg', leenaRewardLines, 'leena-reward');
    }, 1800);
}

function openLeenaConversation() {
    playerFrozen = true;
    leenaTalkCooldown = true;
    if (leenaQuestCompleted) {
        openGuideConversation('Leena', 'images/leena.jpg', leenaCompletedLines, 'leena-completed');
        return;
    }
    if (leenaState === 'awaiting-tune') {
        openGuideConversation('Leena', 'images/leena.jpg', leenaRetryLines, 'leena-retry', 'leena-help');
        return;
    }
    openGuideConversation('Leena', 'images/leena.jpg', leenaIntroLines, 'leena-intro', 'leena-help');
}

function handlePianoInput(lane) {
    if (!inPianoGame || !pianoGame.active || guidePopupVisible || loading) return;
    const layout = getPianoLayout();
    const correctLane = lane === pianoGame.currentLane;
    const noteTop = pianoGame.noteY - layout.noteRadiusY;
    const noteBottom = pianoGame.noteY + layout.noteRadiusY;
    const touchingKey = noteBottom >= layout.keyY && noteTop <= layout.keyY + layout.keyHeight;
    if (!correctLane || !touchingKey) {
        exitPianoQuest('The piano slipped out of tune. Talk to Leena again to restart.');
        return;
    }

    pianoGame.matched += 1;
    pianoGame.feedback = pianoEncouragements[(pianoGame.matched - 1) % pianoEncouragements.length];
    pianoGame.feedbackTimer = 1.35;
    pianoGame.flashLane = lane;
    pianoGame.flashTimer = 0.18;

    if (pianoGame.matched >= pianoGame.required) {
        pianoGame.matched = pianoGame.required;
        completePianoQuest();
        return;
    }

    pianoGame.currentLane = getNextPianoLane();
    pianoGame.noteY = -56;
    pianoGame.noteSpeed = Math.min(420, 240 + pianoGame.matched * 24);
    pianoGame.spawnTimer = Math.max(0.12, 0.28 - pianoGame.matched * 0.012);
}

function updatePianoGame(dt) {
    if (!inPianoGame) return;
    if (pianoGame.feedbackTimer > 0) pianoGame.feedbackTimer = Math.max(0, pianoGame.feedbackTimer - dt);
    if (pianoGame.flashTimer > 0) {
        pianoGame.flashTimer = Math.max(0, pianoGame.flashTimer - dt);
        if (pianoGame.flashTimer === 0) pianoGame.flashLane = -1;
    }
    if (!pianoGame.active || guidePopupVisible || loading) return;

    if (pianoGame.spawnTimer > 0) {
        pianoGame.spawnTimer = Math.max(0, pianoGame.spawnTimer - dt);
        return;
    }

    const layout = getPianoLayout();
    pianoGame.noteY += pianoGame.noteSpeed * dt;
    if (pianoGame.noteY > layout.missY) {
        exitPianoQuest('You missed the note. Talk to Leena again to restart.');
    }
}

function drawPianoScene() {
    const w = canvas.width;
    const h = canvas.height;
    const layout = getPianoLayout();
    portalPos = null;

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#16263a');
    bg.addColorStop(0.58, '#223c57');
    bg.addColorStop(1, '#0f1724');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < pianoGame.laneCount; i++) {
        const laneX = layout.keyX + i * (layout.keyWidth + layout.keyGap);
        ctx.fillRect(laneX + 8, layout.topY, layout.keyWidth - 16, layout.keyY - layout.topY);
    }

    ctx.fillStyle = '#3e2b1f';
    ctx.fillRect(0, h - 122, w, 122);
    ctx.fillStyle = '#5f4634';
    ctx.fillRect(0, h - 112, w, 16);

    for (let lane = 0; lane < pianoGame.laneCount; lane++) {
        const keyX = layout.keyX + lane * (layout.keyWidth + layout.keyGap);
        const flashing = pianoGame.flashLane === lane && pianoGame.flashTimer > 0;
        ctx.fillStyle = flashing ? '#ffe8a3' : '#f5f2ea';
        ctx.fillRect(keyX, layout.keyY, layout.keyWidth, layout.keyHeight);
        ctx.strokeStyle = '#2a1f18';
        ctx.lineWidth = 3;
        ctx.strokeRect(keyX, layout.keyY, layout.keyWidth, layout.keyHeight);
        ctx.fillStyle = '#2a1f18';
        ctx.font = '18px "Press Start 2P", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(String(lane + 1), keyX + layout.keyWidth / 2, layout.keyY + 50);
    }

    if (pianoGame.spawnTimer <= 0) {
        const noteX = layout.laneCenter(pianoGame.currentLane);
        const noteY = pianoGame.noteY;
        ctx.fillStyle = '#ffd978';
        ctx.beginPath();
        ctx.ellipse(noteX - 8, noteY, 14, 10, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(noteX + 3, noteY - 44, 6, 40);
        ctx.beginPath();
        ctx.moveTo(noteX + 9, noteY - 44);
        ctx.lineTo(noteX + 28, noteY - 32);
        ctx.lineTo(noteX + 9, noteY - 22);
        ctx.closePath();
        ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    ctx.fillText(`Tune: ${pianoGame.matched}/${pianoGame.required}`, w / 2, 28);

    const feedback = pianoGame.feedbackTimer > 0
        ? pianoGame.feedback
        : 'Match the note when it touches the white key.';
    ctx.font = '11px "Press Start 2P", cursive';
    ctx.fillStyle = '#fff4c4';
    ctx.fillText(feedback, w / 2, 52);

    ctx.fillStyle = '#d8e8ff';
    ctx.font = '9px "Press Start 2P", cursive';
    ctx.fillText('Use keys 1-5 or click the piano keys', w / 2, h - 136);
}

function handleBasketballShot() {
    if (!inBasketballGame || basketballGame.mode !== 'aim') return;
    const greenStart = basketballGame.greenCenter - basketballGame.greenWidth / 2;
    const greenEnd = basketballGame.greenCenter + basketballGame.greenWidth / 2;
    basketballGame.shotSuccess = basketballGame.meterPos >= greenStart && basketballGame.meterPos <= greenEnd;
    basketballGame.mode = 'shot';
    basketballGame.shotTime = 0;
    basketballGame.armTimer = basketballGame.shotDuration;
    playerFrozen = true;
}

function updateBasketballGame(dt) {
    if (!inBasketballGame) return;
    if (basketballGame.armTimer > 0) basketballGame.armTimer = Math.max(0, basketballGame.armTimer - dt);

    if (basketballGame.mode === 'aim') {
        basketballGame.meterPos += basketballGame.meterDir * basketballGame.meterSpeed * dt;
        if (basketballGame.meterPos >= 1) {
            basketballGame.meterPos = 1;
            basketballGame.meterDir = -1;
        } else if (basketballGame.meterPos <= 0) {
            basketballGame.meterPos = 0;
            basketballGame.meterDir = 1;
        }
        return;
    }

    if (basketballGame.mode === 'shot') {
        basketballGame.shotTime += dt;
        if (basketballGame.shotTime < basketballGame.shotDuration) return;

        if (!basketballGame.shotSuccess) {
            exitBasketballQuest('Missed shot. Talk to Albert again to restart the quest.');
            return;
        }

        basketballGame.made += 1;
        if (basketballGame.made >= basketballGame.required) {
            basketballGame.made = basketballGame.required;
            completeBasketballQuest();
            return;
        }

        basketballGame.mode = 'aim';
        basketballGame.shotTime = 0;
        basketballGame.meterPos = 0.5;
        basketballGame.meterDir = 1;
        basketballGame.meterSpeed = Math.min(2.6, basketballGame.meterSpeed + 0.16);
        basketballGame.greenWidth = Math.max(0.12, basketballGame.greenWidth - 0.025);
        playerFrozen = true;
    }
}

function drawBasketballShooter(x, y, shooting = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.ellipse(6, 50, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2f6bb3';
    ctx.fillRect(-4, 6, 28, 34);
    ctx.fillStyle = '#f1d5b0';
    ctx.fillRect(0, -14, 20, 20);
    ctx.fillStyle = '#6b4a31';
    ctx.fillRect(-2, -20, 24, 10);
    ctx.fillRect(-4, -10, 4, 8);
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 40, 10, 30);
    ctx.fillRect(14, 40, 10, 30);

    ctx.strokeStyle = '#f1d5b0';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (shooting) {
        ctx.moveTo(8, 18);
        ctx.lineTo(32, 0);
        ctx.moveTo(14, 18);
        ctx.lineTo(42, 6);
    } else {
        ctx.moveTo(8, 18);
        ctx.lineTo(24, 28);
        ctx.moveTo(14, 18);
        ctx.lineTo(28, 34);
    }
    ctx.stroke();
    ctx.restore();
}

function drawBasketballScene() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#202431';
    ctx.fillRect(0, 0, w, h);

    const drawSeats = (xStart, xEnd, flip = false) => {
        for (let row = 0; row < 6; row++) {
            const y = 24 + row * 30;
            for (let x = xStart; x < xEnd; x += 34) {
                const px = flip ? w - x : x;
                ctx.fillStyle = row % 2 === 0 ? '#6e716f' : '#7f827f';
                ctx.fillRect(px, y, 26, 20);
                ctx.strokeStyle = '#404349';
                ctx.strokeRect(px, y, 26, 20);
            }
        }
    };

    drawSeats(24, 220, false);
    drawSeats(24, 220, true);

    ctx.fillStyle = '#4a5562';
    ctx.beginPath();
    ctx.moveTo(220, 0);
    ctx.lineTo(300, 0);
    ctx.lineTo(210, 190);
    ctx.lineTo(130, 190);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w - 220, 0);
    ctx.lineTo(w - 300, 0);
    ctx.lineTo(w - 210, 190);
    ctx.lineTo(w - 130, 190);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5a6570';
    for (let i = 0; i < 9; i++) {
        ctx.fillRect(188 + i * 8, 0, 3, 190);
        ctx.fillRect(w - 188 - i * 8, 0, 3, 190);
    }

    ctx.fillStyle = '#2d3640';
    ctx.fillRect(0, h - 86, w, 86);
    ctx.fillStyle = '#59636e';
    ctx.beginPath();
    ctx.moveTo(140, h - 86);
    ctx.lineTo(260, h - 86);
    ctx.lineTo(200, h - 26);
    ctx.lineTo(80, h - 26);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#7f8a96';
    ctx.fillRect(w - 118, 74, 18, 240);
    ctx.fillStyle = '#a9b2bb';
    ctx.fillRect(w - 114, 72, 10, 244);
    ctx.fillStyle = '#c2c8ce';
    ctx.fillRect(w - 176, 34, 86, 74);
    ctx.strokeStyle = '#8a949c';
    ctx.lineWidth = 3;
    ctx.strokeRect(w - 176, 34, 86, 74);
    ctx.strokeRect(w - 148, 52, 32, 24);

    ctx.strokeStyle = '#a33a1f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(w - 150, 112, 28, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#d7dde2';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.moveTo(w - 174 + i * 8, 116);
        ctx.lineTo(w - 162 + i * 5, 154);
        ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(w - 174, 122 + i * 6);
        ctx.lineTo(w - 126, 122 + i * 6);
        ctx.stroke();
    }

    const shooterX = 96;
    const shooterY = 220;
    drawBasketballShooter(shooterX, shooterY, basketballGame.armTimer > 0);

    const meterX = 26;
    const meterY = h - 48;
    const meterW = w - 52;
    const meterH = 24;
    const greenW = meterW * basketballGame.greenWidth;
    const greenX = meterX + meterW * basketballGame.greenCenter - greenW / 2;

    ctx.fillStyle = '#da1717';
    ctx.fillRect(meterX, meterY, meterW, meterH);
    ctx.fillStyle = '#39d31b';
    ctx.fillRect(greenX, meterY, greenW, meterH);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(meterX, meterY, meterW, meterH);

    const arrowX = meterX + meterW * basketballGame.meterPos;
    ctx.fillStyle = '#f7f7f7';
    ctx.beginPath();
    ctx.moveTo(arrowX, meterY + meterH + 4);
    ctx.lineTo(arrowX - 12, meterY + meterH + 22);
    ctx.lineTo(arrowX + 12, meterY + meterH + 22);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = '16px "Press Start 2P", cursive';
    ctx.textAlign = 'center';
    const basketsMade = Math.min(basketballGame.made, basketballGame.required);
    ctx.fillText(`Baskets: ${basketsMade}/${basketballGame.required}`, w / 2, 26);

    if (basketballGame.mode === 'shot') {
        const t = Math.min(1, basketballGame.shotTime / basketballGame.shotDuration);
        const startX = shooterX + 58;
        const startY = shooterY + 18;
        const endX = basketballGame.shotSuccess ? w - 150 : w - 86;
        const endY = basketballGame.shotSuccess ? 112 : 188;
        const controlX = (startX + endX) / 2;
        const controlY = basketballGame.shotSuccess ? 22 : 58;
        const bx = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * endX;
        const by = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * endY;
        ctx.fillStyle = '#d57b2a';
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#6b3412';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, 13, 0, Math.PI * 2);
        ctx.moveTo(bx - 13, by);
        ctx.lineTo(bx + 13, by);
        ctx.moveTo(bx, by - 13);
        ctx.lineTo(bx, by + 13);
        ctx.stroke();
    }
}

function drawMeetingNPC(attendee) {
    const shirt = attendee.shirt || '#3a6de0';
    const hair = attendee.hair || '#2c221b';
    const skin = attendee.skin || '#f1d5b0';
    const pose = attendee.pose || 'seated';

    ctx.save();
    ctx.translate(attendee.x, attendee.y);
    if (attendee.facing === 'left') ctx.scale(-1, 1);

    if (pose === 'standing') {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(0, 18, 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shirt;
        ctx.fillRect(-10, -2, 20, 14);
        ctx.fillStyle = '#2d2d2d';
        ctx.fillRect(-10, 10, 20, 4);
        ctx.fillRect(-8, 12, 7, 12);
        ctx.fillRect(1, 12, 7, 12);
        ctx.fillStyle = skin;
        ctx.fillRect(-8, -14, 16, 12);
        ctx.fillStyle = hair;
        ctx.fillRect(-8, -16, 16, 5);
        ctx.fillRect(-8, -11, 3, 4);
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-4, -9, 2, 2);
        ctx.fillRect(2, -9, 2, 2);
        ctx.fillRect(-3, -4, 6, 1);
        ctx.restore();
        return;
    }

    if (attendee.facing === 'down') {
        ctx.fillStyle = shirt;
        ctx.fillRect(-10, -6, 20, 8);
        ctx.fillStyle = skin;
        ctx.fillRect(-8, 2, 16, 10);
        ctx.fillStyle = hair;
        ctx.fillRect(-8, 0, 16, 4);
        ctx.fillRect(-8, 4, 3, 3);
        ctx.fillRect(5, 4, 3, 3);
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-4, 7, 2, 2);
        ctx.fillRect(2, 7, 2, 2);
        ctx.fillRect(-3, 10, 6, 1);
    } else if (attendee.facing === 'up') {
        ctx.fillStyle = skin;
        ctx.fillRect(-8, -12, 16, 10);
        ctx.fillStyle = hair;
        ctx.fillRect(-8, -14, 16, 5);
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-4, -8, 2, 2);
        ctx.fillRect(2, -8, 2, 2);
        ctx.fillRect(-3, -4, 6, 1);
        ctx.fillStyle = shirt;
        ctx.fillRect(-10, -2, 20, 8);
    } else {
        ctx.fillStyle = shirt;
        ctx.fillRect(-1, -8, 11, 18);
        ctx.fillStyle = skin;
        ctx.fillRect(-9, -8, 10, 14);
        ctx.fillStyle = hair;
        ctx.fillRect(-9, -10, 10, 5);
        ctx.fillRect(-9, -5, 2, 5);
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(-4, -3, 2, 2);
        ctx.fillRect(-2, 1, 3, 1);
    }
    ctx.restore();
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
    portalPos = {x, y: y - tile/2, rx:8, ry:3, target: 'school'};
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
    const mainColor='#d55353', shadowColor='rgba(0,0,0,0.18)', roofColor='#b63f3f';
    // Main block
    ctx.fillStyle=mainColor; ctx.fillRect(bX,bY,bW,bH);
    // Shadows along sides and a thin front drop
    ctx.fillStyle = shadowColor;
    ctx.fillRect(bX + bW, bY + 8, 12, bH);      // right side shadow
    ctx.fillRect(bX - 12, bY + 8, 12, bH);      // left side shadow
    ctx.fillRect(bX, bY + bH, bW, 10);          // front base shadow
    // Roof triangle
    ctx.fillStyle=roofColor;
    ctx.beginPath();ctx.moveTo(bX, bY);ctx.lineTo(bX+bW/2, bY-40);ctx.lineTo(bX+bW, bY);ctx.closePath();ctx.fill();
    ctx.fillRect(bX, bY-16, bW, 16);
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
    door.y = bY + bH - door.h/2 + 4; // attached to building, near ground
    // Building collision rect (blocks movement)
    schoolRect = {
        x1: bX,
        x2: bX + bW,
        y1: bY - 20, // include roof area as blocked
        y2: bY + bH
    };
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

    // Position girl in front-right of the school if she hasn't walked away
    if (!girl.talked && !girlWalking) {
        girl.x = door.x + (bW * 0.28); // move right of door
        girl.y = bY + bH + 12;          // slightly in front
    }

    // Girl NPC to the right of the door
    if (girl.visible) {
        ctx.save();
        ctx.translate(girl.x, girl.y);
        // simple shadow + body
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(0,18,10,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#222'; ctx.fillRect(-8, -8, 16, 16); // hair/hat black
        ctx.fillStyle = '#f1d5b0'; ctx.fillRect(-7, -2, 14, 10); // face
        ctx.fillStyle = '#1c1c1c'; ctx.fillRect(-4, 0, 2, 2); ctx.fillRect(2, 0, 2, 2); // eyes
        ctx.fillStyle = '#3aa76d'; ctx.fillRect(-8, 8, 16, 12); // shirt green
        ctx.fillStyle = '#2d2d2d'; ctx.fillRect(-8, 20, 6, 10); ctx.fillRect(2, 20, 6, 10); // legs
        ctx.restore();
    }
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

function renderQuests() {
    if (!guideQuests) return;
    const empty = guideQuests.querySelector('.guide-quests__empty');
    if (!newQuest) {
        if (empty) empty.textContent = 'No Quests';
        return;
    }
    if (empty) empty.textContent = newQuest;
}

// Guide UI helpers
guideAvatar?.addEventListener('click', () => {
    if (!inSchool && !inGrey && !inGym && !inMusicRoom && !inPianoGame) return;
    guideQuestsVisible = true;
    if (guideQuests) guideQuests.hidden = false;
    if (guideAvatarAlert) guideAvatarAlert.hidden = true;
    newQuestAlert = false;
    renderQuests();
});
guideQuestsClose?.addEventListener('click', () => {
    guideQuestsVisible = false;
    if (guideQuests) guideQuests.hidden = true;
});

// Guide popup typewriter
function clearGuideTimer() {
    if (guideTypeTimer) clearInterval(guideTypeTimer);
    guideTypeTimer = null;
}

function updateGuideNextButton() {
    if (!guidePopupNext) return;
    const atChoicePoint = Boolean(popupChoices)
        && guideLineIdx === activeLines.length - 1
        && guideLineComplete;
    if (atChoicePoint) {
        updatePopupChoiceButtons();
        return;
    }
    resetPopupChoices();
    const isManagerChoice = activeConversation === 'manager-intro'
        && guideLineIdx === activeLines.length - 1
        && guideLineComplete;
    guidePopupNext.hidden = false;
    guidePopupNext.textContent = isManagerChoice ? 'Absolutely' : popupPrimaryLabel;
}

function buildPopupChoices(choiceSet) {
    switch (choiceSet) {
        case 'albert-opening':
            return [
                {
                    label: 'We should practice together!',
                    action: () => openGuideConversation('Albert', 'images/albert.jpg', albertOfferLines, 'albert-offer', 'albert-practice')
                },
                {
                    label: 'You must be nervous.',
                    action: () => openGuideConversation('Albert', 'images/albert.jpg', albertEmpathyLines, 'albert-empathy', 'albert-practice')
                },
                {
                    label: "Maybe just don't play the game",
                    action: () => restartGymAfterWrongChoice()
                }
            ];
        case 'albert-practice':
            return [
                {
                    label: 'Yes',
                    action: () => {
                        albertState = 'practice';
                        albertTalkCooldown = true;
                        closeGuideConversation();
                        startBasketballQuest();
                    }
                },
                {
                    label: 'No',
                    action: () => {
                        albertState = 'awaiting-practice';
                        openGuideConversation('Albert', 'images/albert.jpg', albertNoLines, 'albert-no');
                    }
                }
            ];
        case 'albert-replay-practice':
            return [
                {
                    label: 'Yes',
                    action: () => {
                        albertState = 'practice';
                        albertTalkCooldown = true;
                        closeGuideConversation();
                        startBasketballQuest();
                    }
                },
                {
                    label: 'No',
                    action: () => {
                        albertState = 'completed';
                        openGuideConversation('Albert', 'images/albert.jpg', basketballReplayDeclineLines, 'albert-replay-no');
                    }
                }
            ];
        case 'leena-help':
            return [
                {
                    label: 'Yes',
                    action: () => openGuideConversation('Leena', 'images/leena.jpg', leenaAcceptLines, 'leena-accept')
                },
                {
                    label: 'Absolutely!',
                    action: () => openGuideConversation('Leena', 'images/leena.jpg', leenaAcceptLines, 'leena-accept')
                },
                {
                    label: 'YES!!!',
                    action: () => openGuideConversation('Leena', 'images/leena.jpg', leenaAcceptLines, 'leena-accept')
                }
            ];
        default:
            return null;
    }
}

function maybeActivatePopupChoices() {
    if (!pendingChoiceSet || popupChoices || !guideLineComplete || guideLineIdx !== activeLines.length - 1) return;
    popupChoices = buildPopupChoices(pendingChoiceSet);
    if (popupChoices) updatePopupChoiceButtons();
}

function openGuideConversation(title, face, lines, conversation, choiceSet = null) {
    guidePopupVisible = true;
    activeLines = lines;
    activeFace = face;
    activeConversation = conversation;
    pendingChoiceSet = choiceSet;
    popupChoices = null;
    guideLineIdx = 0;
    guideLineComplete = false;
    guideWalkTime = 0;
    popupPrimaryLabel = 'Next';
    popupInstantMode = false;
    clearGuideTimer();
    if (guidePopupTitle) guidePopupTitle.textContent = title;
    if (guidePopup) guidePopup.hidden = false;
    if (guidePopupLine) guidePopupLine.textContent = '';
    setGuideFace(face);
    updateGuideNextButton();
    typeGuideLine();
}

function openInstantPopup(title, face, lines, conversation, primaryLabel = 'Done') {
    guidePopupVisible = true;
    activeLines = lines;
    activeFace = face;
    activeConversation = conversation;
    pendingChoiceSet = null;
    popupChoices = null;
    guideLineIdx = 0;
    guideLineComplete = true;
    guideWalkTime = 0;
    popupPrimaryLabel = primaryLabel;
    popupInstantMode = true;
    clearGuideTimer();
    if (guidePopupTitle) guidePopupTitle.textContent = title;
    if (guidePopup) guidePopup.hidden = false;
    if (guidePopupLine) guidePopupLine.textContent = lines[0] || '';
    setGuideFace(face);
    updateGuideNextButton();
}

function showGuidePopup() {
    openGuideConversation('The Guide Master', 'images/player_idle.png', guideLines, 'guide');
}

function showAdvisoryManagerPopup() {
    managerIntroShown = true;
    playerFrozen = true;
    openGuideConversation(
        'Advisory Manager',
        'images/character_malePerson_idle.png',
        advisoryManagerIntroLines,
        'manager-intro'
    );
}

function showBasketballInstructions() {
    playerFrozen = true;
    openInstantPopup('Instructions', 'images/player_idle.png', basketballQuestInstructions, 'basketball-instructions', 'Done');
}

function startBasketballQuest() {
    loading = true;
    playerFrozen = true;
    if (guideQuests) guideQuests.hidden = true;
    guideQuestsVisible = false;
    if (guideAvatar) guideAvatar.hidden = true;
    setLoadingMessage();
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        inGym = false;
        inBasketballGame = true;
        resetBasketballGame();
        setQuest('Make 3 baskets for Albert', false);
        syncPlayfieldTheme();
        loading = false;
        showBasketballInstructions();
    }, 1400);
}

function exitBasketballQuest(message, nextAlbertState = null, quest = undefined) {
    if (nextAlbertState === null) nextAlbertState = albertQuestCompleted ? 'completed' : 'awaiting-practice';
    if (quest === undefined) quest = albertQuestCompleted ? null : 'Talk to Albert again and restart the quest.';
    loading = true;
    playerFrozen = true;
    setLoadingMessage(message);
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        setLoadingMessage();
        inBasketballGame = false;
        inGym = true;
        initGymCourt();
        if (guideAvatar) guideAvatar.hidden = false;
        albertState = nextAlbertState;
        setQuest(quest, Boolean(quest));
        syncPlayfieldTheme();
        loading = false;
        playerFrozen = false;
    }, 1800);
}

function completeBasketballQuest() {
    loading = true;
    playerFrozen = true;
    setLoadingMessage('Nice work! Albert feels more confident now.');
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        setLoadingMessage();
        inBasketballGame = false;
        inGym = true;
        initGymCourt();
        if (guideAvatar) guideAvatar.hidden = false;
        hero.x = albert.x - 38;
        hero.y = albert.y + 6;
        hero.dir = 'right';
        albertState = 'completed';
        setQuest(null);
        syncPlayfieldTheme();
        loading = false;
        if (!albertQuestCompleted) {
            openGuideConversation('Albert', 'images/albert.jpg', basketballRewardLines, 'basketball-reward');
            return;
        }
        openGuideConversation('Albert', 'images/albert.jpg', basketballReplayRewardLines, 'basketball-replay-reward');
    }, 1800);
}

function openAlbertConversation() {
    if (albertState === 'accepted') {
        albertTalkCooldown = true;
        return;
    }
    playerFrozen = true;
    albertTalkCooldown = true;
    if (albertQuestCompleted) {
        openGuideConversation('Albert', 'images/albert.jpg', basketballReplayPromptLines, 'albert-replay-prompt', 'albert-replay-practice');
        return;
    }
    if (albertState === 'awaiting-practice') {
        openGuideConversation('Albert', 'images/albert.jpg', albertPracticePromptLines, 'albert-practice-prompt', 'albert-practice');
        return;
    }
    openGuideConversation('Albert', 'images/albert.jpg', albertIntroLines, 'albert-intro', 'albert-opening');
}

function restartGymAfterWrongChoice() {
    closeGuideConversation();
    loading = true;
    playerFrozen = true;
    setLoadingMessage("It's good to offer support and validate a friend's feelings instead of dismissing their emotions.");
    if (loadingOverlay) loadingOverlay.hidden = false;
    setTimeout(() => {
        if (loadingOverlay) loadingOverlay.hidden = true;
        setLoadingMessage();
        initGymCourt();
        albertState = 'intro';
        loading = false;
        playerFrozen = false;
    }, 2400);
}

function typeGuideLine() {
    if (!guidePopupLine) return;
    clearGuideTimer();
    guideLineComplete = false;
    updateGuideNextButton();
    const text = activeLines[guideLineIdx] || '';
    let i = Math.min(1, text.length);
    guidePopupLine.textContent = text.slice(0, i);
    if (text.length <= 1) {
        guideLineComplete = true;
        maybeActivatePopupChoices();
        updateGuideNextButton();
        return;
    }
    guideTypeTimer = setInterval(() => {
        guidePopupLine.textContent = text.slice(0, ++i);
        if (i >= text.length) {
            guideLineComplete = true;
            clearGuideTimer();
            maybeActivatePopupChoices();
            updateGuideNextButton();
        }
    }, 22);
}
function finishGuideLine() {
    if (!guidePopupLine) return;
    guidePopupLine.textContent = activeLines[guideLineIdx] || '';
    guideLineComplete = true;
    clearGuideTimer();
    maybeActivatePopupChoices();
    updateGuideNextButton();
}

guidePopupNext?.addEventListener('click', () => {
    if (!guidePopupVisible) return;
    if (popupChoices && guideLineComplete && guideLineIdx === activeLines.length - 1) {
        popupChoices[0]?.action?.();
        return;
    }
    if (!guideLineComplete) {
        finishGuideLine();
        return;
    }
    if (guideLineIdx < activeLines.length - 1) {
        guideLineIdx += 1;
        if (popupInstantMode) {
            if (guidePopupLine) guidePopupLine.textContent = activeLines[guideLineIdx] || '';
            guideLineComplete = true;
            updateGuideNextButton();
        } else {
            typeGuideLine();
        }
        return;
    }
    if (activeConversation === 'manager-intro') {
        openGuideConversation(
            'Advisory Manager',
            'images/character_malePerson_idle.png',
            advisoryManagerAcceptLines,
            'manager-accept'
        );
        return;
    }
    if (activeConversation === 'basketball-instructions') {
        closeGuideConversation();
        basketballGame.mode = 'aim';
        playerFrozen = false;
        return;
    }
    if (activeConversation === 'piano-instructions') {
        closeGuideConversation();
        pianoGame.active = true;
        playerFrozen = false;
        return;
    }
    if (activeConversation === 'basketball-reward') {
        openInstantPopup('Item Obtained', 'images/player_idle.png', basketballItemLines, 'basketball-item', 'Done');
        return;
    }
    if (activeConversation === 'leena-reward') {
        openInstantPopup('Item Obtained', 'images/player_idle.png', pianoItemLines, 'piano-item', 'Done');
        return;
    }
    // done
    closeGuideConversation();
    if (activeLines === girlLines) {
        girl.talked = true;
        girlWalking = true;
        playerFrozen = true;
        setQuest('Enter the meeting room', true);
    } else if (activeConversation === 'manager-accept') {
        playerFrozen = false;
        meetingPortalVisible = true;
        setQuest('Go to the gym and talk to Albert', true);
    } else if (activeConversation === 'albert-offer') {
        playerFrozen = false;
        albertTalkCooldown = true;
    } else if (activeConversation === 'albert-no') {
        playerFrozen = false;
        albertTalkCooldown = true;
    } else if (activeConversation === 'albert-replay-no') {
        playerFrozen = false;
        albertTalkCooldown = true;
    } else if (activeConversation === 'leena-intro' || activeConversation === 'leena-retry') {
        playerFrozen = false;
        leenaTalkCooldown = true;
    } else if (activeConversation === 'leena-accept') {
        leenaTalkCooldown = true;
        startPianoQuest();
    } else if (activeConversation === 'basketball-success') {
        playerFrozen = false;
    } else if (activeConversation === 'basketball-replay-reward') {
        playerFrozen = false;
        albertTalkCooldown = true;
    } else if (activeConversation === 'basketball-item') {
        albertQuestCompleted = true;
        playerFrozen = false;
        albertTalkCooldown = true;
        setQuest('Go through the portal in the top-left corner to reach the music room', true);
    } else if (activeConversation === 'piano-item') {
        leenaQuestCompleted = true;
        leenaState = 'completed';
        playerFrozen = false;
        leenaTalkCooldown = true;
        setQuest(null);
    } else if (activeConversation === 'leena-completed') {
        playerFrozen = false;
        leenaTalkCooldown = true;
    } else {
        guideIntroShown = true;
        setQuest('Talk to the girl in front of Mirlow High School.', true);
    }
    updateGuideNextButton();
});

guidePopupOption2?.addEventListener('click', () => {
    if (!popupChoices) return;
    popupChoices[1]?.action?.();
});

guidePopupOption3?.addEventListener('click', () => {
    if (!popupChoices) return;
    popupChoices[2]?.action?.();
});

function loop(now) {
    const dt = Math.min((now-lastTime)/1000, 0.05);
    lastTime = now;
    updateBasketballGame(dt);
    updatePianoGame(dt);
    let vx=0, vy=0;
    if (!dialogActive && !loading && !guidePopupVisible && !guideQuestsVisible && !girlWalking && !playerFrozen && !inBasketballGame && !inPianoGame) {
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
    const block = (x,y)=> blocked(x,y);
    if (!block(nx-pad, hero.y) && !block(nx+pad, hero.y)) hero.x = nx;
    if (!block(hero.x, ny-pad) && !block(hero.x, ny+pad)) hero.y = ny;

    const moving = (vx !== 0 || vy !== 0) && !playerFrozen;
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

    if (!inSchool && !inGrey && !inGym && !inMusicRoom && !inPianoGame) {
        // Interaction zone: near the NPC along the road band
        const fx1 = npc.x - 48;
        const fx2 = npc.x + 48;
        const fy1 = npc.y - 6;   // slightly above eyes
        const fy2 = npc.y + 34;  // extends down the road but not behind
        const inFront = hero.x > fx1 && hero.x < fx2 && hero.y > fy1 && hero.y < fy2;
        if (inFront && !dialogActive && !portalVisible) {
            dialogStep = 0;
            showDialog(npcDialog[0]);
        }
    } else if (inSchool) {
        // Girl interaction in school
        if (girl.visible && !girl.talked && !girlWalking && !dialogActive && !guidePopupVisible) {
            const gx1 = girl.x - 30, gx2 = girl.x + 30;
            const gy1 = girl.y - 10, gy2 = girl.y + 32;
            const nearGirl = hero.x > gx1 && hero.x < gx2 && hero.y > gy1 && hero.y < gy2;
            if (nearGirl) {
                openGuideConversation('Eshal', 'images/character_femaleperson_idle.png', girlLines, 'girl');
            }
        }
        // Girl walking into door
        if (girlWalking) {
            const speed = 80 * dt;
            const dx = door.x - girl.x;
            const dy = (door.y + door.h/2) - girl.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 2) {
                girlWalking = false;
                girl.visible = false;
                doorLocked = false;
                playerFrozen = false;
            } else {
                const nxg = girl.x + (dx/dist) * speed;
                const nyg = girl.y + (dy/dist) * speed;
                girl.x = nxg;
                girl.y = nyg;
            }
        }
    } else if (inGym) {
        const nearAlbert = hero.x > albert.x - 34 && hero.x < albert.x + 34 && hero.y > albert.y - 28 && hero.y < albert.y + 34;
        if (nearAlbert && !albertTalkCooldown && !dialogActive && !guidePopupVisible) {
            openAlbertConversation();
        }
        if (!nearAlbert) albertTalkCooldown = false;
    } else if (inMusicRoom) {
        const nearLeena = hero.x > leena.x - 34 && hero.x < leena.x + 34 && hero.y > leena.y - 28 && hero.y < leena.y + 34;
        if (nearLeena && !leenaTalkCooldown && !dialogActive && !guidePopupVisible) {
            openLeenaConversation();
        }
        if (!nearLeena) leenaTalkCooldown = false;
    }

    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (inGrey) {
        drawMeetingRoom();
    } else if (inBasketballGame) {
        drawBasketballScene();
    } else if (inPianoGame) {
        drawPianoScene();
    } else if (inGym) {
        drawGymCourt();
    } else if (inMusicRoom) {
        drawMusicRoom();
    } else if (!inSchool) {
        drawField();
        drawNPC();
        drawPortal();
        drawHero();
    } else {
        drawSchool();
        drawHero();
    }

    // portal collide
    if (portalPos && !loading) {
        const dx = hero.x - portalPos.x;
        const dy = hero.y - portalPos.y;
        const inside = (dx*dx)/(portalPos.rx*portalPos.rx) + (dy*dy)/(portalPos.ry*portalPos.ry) <= 1;
        if (inside) {
            const target = portalPos.target;
            loading = true;
            setLoadingMessage();
            if (loadingOverlay) loadingOverlay.hidden = false;
            setTimeout(() => {
                if (loadingOverlay) loadingOverlay.hidden = true;
                if (target === 'school') {
                    inSchool = true;
                    inGrey = false;
                    inGym = false;
                    inMusicRoom = false;
                    inPianoGame = false;
                    hero.x = tile*2;
                    hero.y = canvas.height - tile*2;
                    loading = false;
                    guidePopupVisible = false;
                    guideIntroShown = false;
                    guideWalkTime = 0;
                    guideLineIdx = 0;
                    guideLineComplete = false;
                    guidePopupTimer = setTimeout(() => {
                        if (!guideIntroShown) showGuidePopup();
                    }, 2000);
                    if (guideAvatar) guideAvatar.hidden = false;
                    syncPlayfieldTheme();
                    girl.x = door.x + 70;
                    girl.y = door.y + door.h/2 - 10;
                } else if (target === 'gym') {
                    inGrey = false;
                    inSchool = false;
                    inGym = true;
                    inMusicRoom = false;
                    inPianoGame = false;
                    playerFrozen = false;
                    hideDialog();
                    initGymCourt();
                    syncPlayfieldTheme();
                    loading = false;
                } else if (target === 'music-room') {
                    inGrey = false;
                    inSchool = false;
                    inGym = false;
                    inMusicRoom = true;
                    inPianoGame = false;
                    playerFrozen = false;
                    hideDialog();
                    initMusicRoom();
                    setQuest(leenaQuestCompleted ? null : 'Talk to Leena in the music room', !leenaQuestCompleted);
                    syncPlayfieldTheme();
                    loading = false;
                }
            }, 1400);
        }
    }

    // door interaction (locked/unlocked)
    if (inSchool && !dialogActive && !guidePopupVisible && !guideQuestsVisible) {
        const padX=6, padY=6;
        const withinX = hero.x > door.x - door.w/2 - padX && hero.x < door.x + door.w/2 + padX;
        const withinY = hero.y > door.y - door.h/2 - padY && hero.y < door.y + door.h/2 + padY;
        if (withinX && withinY && !doorCooldown) {
            doorCooldown = true;
            if (doorLocked) {
                showDialog('This door is locked.', true);
            } else {
                // enter building
                loading = true;
                setLoadingMessage();
                if (loadingOverlay) loadingOverlay.hidden = false;
                setTimeout(() => {
                    if (loadingOverlay) loadingOverlay.hidden = true;
                    inGrey = true;
                    inSchool = false;
                    inGym = false;
                    inMusicRoom = false;
                    inPianoGame = false;
                    hideDialog();
                    initMeetingRoom();
                    playerFrozen = true;
                    guideQuestsVisible = false;
                    if (guideQuests) guideQuests.hidden = true;
                    setQuest(null);
                    syncPlayfieldTheme();
                    loading = false;
                    showAdvisoryManagerPopup();
                }, 1400);
            }
        }
        if (!withinX || !withinY) doorCooldown = false;
    }

    requestAnimationFrame(loop);
}
function setGuideFace(url) {
    if (guidePopup) {
        const face = guidePopup.querySelector('.guide-popup__face');
        if (face) face.style.background = `#2c2f3a url('${url}') center/cover no-repeat`;
    }
}
