const sourceLangSelect = document.getElementById('source-lang');
const targetLangSelect = document.getElementById('target-lang');
const swapBtn = document.getElementById('swap-btn');
const sourceTextarea = document.getElementById('source-text');
const translatedTextarea = document.getElementById('translated-text');
const translateBtn = document.getElementById('translate-btn');
const speakSourceBtn = document.getElementById('speak-source-btn');
const copySourceBtn = document.getElementById('copy-source-btn');
const speakTargetBtn = document.getElementById('speak-target-btn');
const copyTargetBtn = document.getElementById('copy-target-btn');
const errorMessage = document.getElementById('error-message');
const fileInput = document.getElementById('file-input');
const autoDetectToggle = document.getElementById('auto-detect-toggle');
const voiceInputBtn = document.getElementById('voice-input-btn');
const historyBtn = document.getElementById('history-btn');
const historyPanel = document.getElementById('history-panel');
const historyList = document.getElementById('history-list');
const favoriteBtn = document.getElementById('favorite-btn');
const favoritesPanel = document.getElementById('favorites-panel');
const favoritesList = document.getElementById('favorites-list');
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox');

// Translation endpoints and fallbacks
const LIBRE_ENDPOINTS = [
    'https://libretranslate.com/translate',
    'https://libretranslate.de/translate',
    'https://translate.argosopentech.com/translate'
];

// MyMemory fallback (public, rate-limited, GET-based)
const MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get';

// helper: fetch with timeout
function fetchWithTimeout(url, opts = {}, timeout = 8000){
    return Promise.race([
        fetch(url, opts),
        new Promise((_, rej) => setTimeout(()=>rej(new Error('timeout')), timeout))
    ]);
}

// LibreTranslate দ্বারা সমর্থিত কিছু ভাষার তালিকা
// এটি Google এর থেকে কম, কিন্তু শেখার জন্য যথেষ্ট
const supportedLanguages = [
    { code: 'en', name: 'English' },
    { code: 'bn', name: 'Bengali' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'hi', name: 'Hindi' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ru', name: 'Russian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' }
];

// ড্রপডাউন মেনুগুলোতে ভাষা যুক্ত করার ফাংশন
function populateLanguages() {
    supportedLanguages.forEach(lang => {
        const option1 = document.createElement('option');
        option1.value = lang.code;
        option1.textContent = lang.name;
        sourceLangSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = lang.code;
        option2.textContent = lang.name;
        targetLangSelect.appendChild(option2);
    });

    // ডিফল্ট ভাষা সেট করা
    sourceLangSelect.value = 'en';
    targetLangSelect.value = 'bn';
}
populateLanguages();

// Apply saved theme
function applySavedTheme(){
    const t = localStorage.getItem('theme') || 'light';
    if(t === 'dark') document.body.classList.add('dark');
    themeToggleCheckbox.checked = (t === 'dark');
}
applySavedTheme();
themeToggleCheckbox.addEventListener('change', ()=>{
    if(themeToggleCheckbox.checked){
        document.body.classList.add('dark');
        localStorage.setItem('theme','dark');
    } else {
        document.body.classList.remove('dark');
        localStorage.setItem('theme','light');
    }
});

// ভাষা পরিবর্তন (swap) করার ফাংশন
swapBtn.addEventListener('click', () => {
    // add small swap animation
    swapBtn.classList.add('swap-anim');
    const tempLang = sourceLangSelect.value;
    sourceLangSelect.value = targetLangSelect.value;
    targetLangSelect.value = tempLang;
    setTimeout(()=>swapBtn.classList.remove('swap-anim'),350);
});

// অনুবাদ করার মূল ফাংশন
async function translateText() {
    const text = sourceTextarea.value.trim();
    if (!text) {
        errorMessage.textContent = 'অনুবাদের জন্য কিছু লিখুন।';
        return;
    }
    errorMessage.textContent = '';
    
    const sourceLang = sourceLangSelect.value;
    const targetLang = targetLangSelect.value;
    
    translatedTextarea.value = 'অনুবাদ হচ্ছে...';
    // Try LibreTranslate endpoints in sequence with timeout
    let translated = '';
    let lastError = null;
    for(const endpoint of LIBRE_ENDPOINTS){
        try{
            const res = await fetchWithTimeout(endpoint, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({q: text, source: sourceLang, target: targetLang, format: 'text'})
            }, 8000);

            if(!res.ok){
                lastError = new Error(`Endpoint ${endpoint} returned ${res.status}`);
                continue;
            }

            const payload = await res.json();
            // LibreTranslate commonly returns {translatedText: '...'}
            translated = payload.translatedText || payload.result || payload.translated || '';
            if(translated) break;
        } catch(err){
            lastError = err;
            // try next endpoint
            console.warn('Libre endpoint failed', endpoint, err);
            continue;
        }
    }

    // If LibreTranslate attempts failed or returned empty, try MyMemory fallback
    if(!translated){
        try{
            const url = `${MYMEMORY_ENDPOINT}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(sourceLang+'|'+targetLang)}`;
            const res2 = await fetchWithTimeout(url, {}, 8000);
            if(res2.ok){
                const json = await res2.json();
                translated = (json && json.responseData && json.responseData.translatedText) ? json.responseData.translatedText : '';
            } else {
                lastError = new Error('MyMemory returned ' + res2.status);
            }
        } catch(err){
            lastError = err;
        }
    }

    if(translated){
        translatedTextarea.value = translated;
        saveToHistory(text, sourceLang, translated, targetLang);
    } else {
        console.error('Translation failed', lastError);
        errorMessage.textContent = 'অনুবাদ সার্ভারে সমস্যা হয়েছে — অনুগ্রহ করে পরে চেষ্টা করুন।';
        translatedTextarea.value = '';
    }
}

// অনুবাদ বাটনে ক্লিক করলে অনুবাদ শুরু হবে
translateBtn.addEventListener('click', translateText);

// simple auto-detect heuristic (overrides source select when enabled)
let autoDetect = false;
autoDetectToggle.addEventListener('click', ()=>{
    autoDetect = !autoDetect;
    autoDetectToggle.classList.toggle('active', autoDetect);
    autoDetectToggle.textContent = autoDetect ? 'Auto ✔' : 'Auto';
});

// try detect: crude detection based on script characters
function detectLanguageFromText(text){
    if(!text) return null;
    const c = text.trim()[0];
    if(/[\u0980-\u09FF]/.test(c)) return 'bn'; // Bengali
    if(/[\u4e00-\u9fff]/.test(c)) return 'zh'; // CJK
    if(/[\u0600-\u06FF]/.test(c)) return 'ar'; // Arabic
    if(/[\u0400-\u04FF]/.test(c)) return 'ru'; // Cyrillic
    if(/[\u0900-\u097F]/.test(c)) return 'hi'; // Devanagari (Hindi)
    // default to english
    return 'en';
}

// intercept input to auto-detect
sourceTextarea.addEventListener('input', ()=>{
    if(autoDetect){
        const detected = detectLanguageFromText(sourceTextarea.value);
        if(detected) sourceLangSelect.value = detected;
    }
});

// টেক্সট টু স্পিচ (Text-to-Speech) ফাংশন
function speakText(text, lang) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        window.speechSynthesis.speak(utterance);
    } else {
        alert("আপনার ব্রাউজার Text-to-Speech সমর্থন করে না।");
    }
}

// ইনপুট টেক্সট পড়ার বাটন
speakSourceBtn.addEventListener('click', () => {
    speakText(sourceTextarea.value, sourceLangSelect.value);
});

// আউটপুট টেক্সট পড়ার বাটন
speakTargetBtn.addEventListener('click', () => {
    speakText(translatedTextarea.value, targetLangSelect.value);
});

// টেক্সট কপি করার ফাংশন
function copyText(textarea) {
    try{
        navigator.clipboard.writeText(textarea.value).then(()=>{
            // small in-page notification instead of alert
            const prev = errorMessage.textContent;
            errorMessage.textContent = 'কপি করা হয়েছে!';
            setTimeout(()=>errorMessage.textContent = prev, 1400);
        });
    } catch(e){
        console.error('কপি করতে সমস্যা হয়েছে:', e);
    }
}

// ইনপুট টেক্সট কপি করার বাটন
copySourceBtn.addEventListener('click', () => {
    copyText(sourceTextarea);
});

// আউটপুট টেক্সট কপি করার বাটন
copyTargetBtn.addEventListener('click', () => {
    copyText(translatedTextarea);
});

// Voice input (SpeechRecognition)
let recognition = null;
if('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.addEventListener('result', (e)=>{
        const text = Array.from(e.results).map(r=>r[0].transcript).join('');
        sourceTextarea.value = sourceTextarea.value + (sourceTextarea.value? '\n' : '') + text;
        // if auto-detect on, run detection
        if(autoDetect){
            const detected = detectLanguageFromText(sourceTextarea.value);
            if(detected) sourceLangSelect.value = detected;
        }
    });
    recognition.addEventListener('error', (e)=>{ console.error('Speech recognition error', e); });
}

voiceInputBtn.addEventListener('click', ()=>{
    if(!recognition){
        alert('ভয়েস ইনপুট আপনার ব্রাউজারে সমর্থিত নয়।');
        return;
    }
    try{
        recognition.lang = sourceLangSelect.value || 'en-US';
        recognition.start();
    } catch(e){ console.error(e); }
});

// History & Favorites using localStorage
function loadHistory(){
    const data = JSON.parse(localStorage.getItem('translate_history')||'[]');
    historyList.innerHTML = '';
    data.slice().reverse().forEach((item, idx)=>{
        const li = document.createElement('li');
        li.textContent = `${item.sourceText.slice(0,80)} → ${item.translatedText.slice(0,80)}`;
        const btn = document.createElement('button');
        btn.innerHTML = '<i class="fas fa-arrow-right"></i>';
        btn.addEventListener('click', ()=>{
            sourceTextarea.value = item.sourceText;
            sourceLangSelect.value = item.sourceLang;
            targetLangSelect.value = item.targetLang;
            translatedTextarea.value = item.translatedText;
        });
        li.appendChild(btn);
        historyList.appendChild(li);
    });
}

function saveToHistory(sourceText, sourceLang, translatedText, targetLang){
    const arr = JSON.parse(localStorage.getItem('translate_history')||'[]');
    arr.push({sourceText, sourceLang, translatedText, targetLang, when:Date.now()});
    localStorage.setItem('translate_history', JSON.stringify(arr.slice(-200)));
    loadHistory();
}

historyBtn.addEventListener('click', ()=>{
    historyPanel.classList.toggle('hidden');
    loadHistory();
});

function loadFavorites(){
    const data = JSON.parse(localStorage.getItem('translate_favorites')||'[]');
    favoritesList.innerHTML = '';
    data.forEach((item, idx)=>{
        const li = document.createElement('li');
        li.textContent = `${item.sourceText.slice(0,60)} → ${item.translatedText.slice(0,60)}`;
        const rem = document.createElement('button');
        rem.innerHTML = '<i class="fas fa-trash"></i>';
        rem.addEventListener('click', ()=>{
            const arr = JSON.parse(localStorage.getItem('translate_favorites')||'[]');
            arr.splice(idx,1);
            localStorage.setItem('translate_favorites', JSON.stringify(arr));
            loadFavorites();
        });
        li.appendChild(rem);
        favoritesList.appendChild(li);
    });
}

favoriteBtn.addEventListener('click', ()=>{
    const src = sourceTextarea.value.trim();
    const tgt = translatedTextarea.value.trim();
    if(!src || !tgt) return;
    const arr = JSON.parse(localStorage.getItem('translate_favorites')||'[]');
    arr.push({sourceText:src, translatedText:tgt, sourceLang:sourceLangSelect.value, targetLang:targetLangSelect.value, when:Date.now()});
    localStorage.setItem('translate_favorites', JSON.stringify(arr.slice(-200)));
    // quick feedback
    const prev = errorMessage.textContent;
    errorMessage.textContent = 'Added to favorites';
    setTimeout(()=>errorMessage.textContent = prev,1200);
    loadFavorites();
    favoritesPanel.classList.remove('hidden');
});

// file upload (.txt)
fileInput.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(file.type && !file.type.startsWith('text')){
        alert('মাত্র .txt ফাইল সমর্থিত।');
        return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', (ev)=>{
        sourceTextarea.value = ev.target.result;
        // optionally auto-trigger translation
        // translateText();
    });
    reader.readAsText(file);
});

// initialize lists
loadHistory();
loadFavorites();