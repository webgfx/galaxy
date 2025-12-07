import { Simulation } from './simulation.js';

const canvas = document.getElementById('canvas');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnStop = document.getElementById('btn-stop');
const btnLang = document.getElementById('btn-lang');

// UI text elements
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');
const controlsTitleEl = document.getElementById('controls-title');
const hintEl = document.getElementById('hint');

// State
let isPaused = false;
let currentLang = 'en';

// UI Translations
const uiTranslations = {
    en: {
        title: 'Solar System',
        subtitle: 'Explore the planets with mouse and controls.',
        controls: 'Controls',
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out',
        pause: 'Pause',
        resume: 'Resume',
        hint: 'Use mouse to orbit, scroll to zoom',
        langBtn: '中文'
    },
    zh: {
        title: '太阳系',
        subtitle: '使用鼠标和控制按钮探索行星',
        controls: '控制',
        zoomIn: '放大',
        zoomOut: '缩小',
        pause: '暂停',
        resume: '继续',
        hint: '使用鼠标旋转视角，滚轮缩放',
        langBtn: 'English'
    }
};

// Initialize Simulation
const simulation = new Simulation(canvas);

// Button Events
if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
        simulation.zoomIn();
        btnZoomIn.style.background = '#4CAF50';
        setTimeout(() => { btnZoomIn.style.background = ''; }, 200);
    });
}

if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
        simulation.zoomOut();
        btnZoomOut.style.background = '#4CAF50';
        setTimeout(() => { btnZoomOut.style.background = ''; }, 200);
    });
}

if (btnStop) {
    btnStop.addEventListener('click', () => {
        isPaused = !isPaused;
        const t = uiTranslations[currentLang];
        btnStop.textContent = isPaused ? t.resume : t.pause;
        btnStop.style.background = isPaused ? '#f44336' : '';
    });
}

// Language toggle
function updateUILanguage() {
    const t = uiTranslations[currentLang];
    if (titleEl) titleEl.textContent = t.title;
    if (subtitleEl) subtitleEl.textContent = t.subtitle;
    if (controlsTitleEl) controlsTitleEl.textContent = t.controls;
    if (hintEl) hintEl.textContent = t.hint;
    if (btnZoomIn) btnZoomIn.textContent = t.zoomIn;
    if (btnZoomOut) btnZoomOut.textContent = t.zoomOut;
    if (btnStop) btnStop.textContent = isPaused ? t.resume : t.pause;
    if (btnLang) btnLang.textContent = t.langBtn;
}

if (btnLang) {
    btnLang.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'zh' : 'en';
        updateUILanguage();
        simulation.setLanguage(currentLang);
    });
}

// Resize Handler
window.addEventListener('resize', () => {
    simulation.resize();
});

// Hook into animation loop
setTimeout(() => {
    const originalAnimate = simulation.animate.bind(simulation);
    
    simulation.animate = () => {
        simulation.updateInteraction({ isStopped: isPaused });
        originalAnimate();
    };
    
    if (simulation.renderer) {
        simulation.renderer.setAnimationLoop(simulation.animate);
    }
}, 100);
