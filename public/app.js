// ================================================
// FileShare Hub — Frontend Logic + AI
// ================================================

let currentDeleteId = null;
let searchTimeout = null;
let chatHistory = [];
let generatedImages = [];
let isChatLoading = false;
let isImageLoading = false;

// DOM Elements — Projects
const projectsGrid = document.getElementById('projectsGrid');
const emptyState = document.getElementById('emptyState');
const uploadForm = document.getElementById('uploadForm');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewSize = document.getElementById('filePreviewSize');
const fileRemoveBtn = document.getElementById('fileRemoveBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadBtn = document.getElementById('uploadBtn');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const toastContainer = document.getElementById('toastContainer');

// Nav
const navProjects = document.getElementById('navProjects');
const navUpload = document.getElementById('navUpload');
const navChat = document.getElementById('navChat');
const navImageGen = document.getElementById('navImageGen');

// Stats
const statProjects = document.getElementById('statProjects');
const statDownloads = document.getElementById('statDownloads');
const statSize = document.getElementById('statSize');

// Chat
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const chatSendBtn = document.getElementById('chatSendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

// Image Gen
const imagePromptInput = document.getElementById('imagePromptInput');
const imageGenBtn = document.getElementById('imageGenBtn');
const imageGenLoading = document.getElementById('imageGenLoading');
const imageGenGallery = document.getElementById('imageGenGallery');
const imageGenEmpty = document.getElementById('imageGenEmpty');

// Image Preview Modal
const imagePreviewModal = document.getElementById('imagePreviewModal');
const imagePreviewClose = document.getElementById('imagePreviewClose');
const imagePreviewImg = document.getElementById('imagePreviewImg');
const imagePreviewDownload = document.getElementById('imagePreviewDownload');

// ================================================
// View Switching
// ================================================

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const viewMap = {
        'projects': { view: 'projectsView', nav: navProjects },
        'upload': { view: 'uploadView', nav: navUpload },
        'chat': { view: 'chatView', nav: navChat },
        'imagegen': { view: 'imagegenView', nav: navImageGen }
    };

    const target = viewMap[viewName];
    if (target) {
        document.getElementById(target.view).classList.add('active');
        target.nav.classList.add('active');
        if (viewName === 'projects') loadProjects();
        if (viewName === 'chat') {
            setTimeout(() => chatInput.focus(), 100);
        }
    }
}

navProjects.addEventListener('click', () => showView('projects'));
navUpload.addEventListener('click', () => showView('upload'));
navChat.addEventListener('click', () => showView('chat'));
navImageGen.addEventListener('click', () => showView('imagegen'));

// ================================================
// Toast Notifications
// ================================================

function showToast(message, type = 'info') {
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ================================================
// Helpers
// ================================================

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getCategoryEmoji(category) {
    return { 'Веб': '🌐', 'Игры': '🎮', 'Утилиты': '🔧', 'Мобильное': '📱', 'Дизайн': '🎨', 'Другое': '📦' }[category] || '📦';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Simple markdown-like renderer
function renderMarkdown(text) {
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    // Wrap consecutive <li> in <ul>
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    // Paragraphs (double newline)
    html = html.replace(/\n\n/g, '</p><p>');
    // Single newline
    html = html.replace(/\n/g, '<br>');
    // Wrap in paragraph
    html = '<p>' + html + '</p>';
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');

    return html;
}

// ================================================
// Load & Render Projects
// ================================================

async function loadProjects() {
    try {
        const q = searchInput.value.trim();
        const cat = categoryFilter.value;
        let url = '/api/search?';
        if (q) url += `q=${encodeURIComponent(q)}&`;
        if (cat !== 'all') url += `category=${encodeURIComponent(cat)}`;
        const res = await fetch(url);
        const projects = await res.json();
        renderProjects(projects);
        updateStats(projects);
    } catch (err) {
        showToast('Ошибка загрузки проектов', 'error');
    }
}

function renderProjects(projects) {
    if (!projects.length) {
        projectsGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');
    projectsGrid.innerHTML = projects.map((p, i) => `
        <div class="project-card" style="animation-delay: ${i * 0.05}s">
            <div class="card-header">
                <span class="card-category">${getCategoryEmoji(p.category)} ${p.category}</span>
                <button class="card-delete" onclick="openDeleteModal('${p.id}')" title="Удалить">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ''}
            ${p.tags && p.tags.length ? `<div class="card-tags">${p.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
            <div class="card-meta">
                <span class="card-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${p.fileSize}</span>
                <span class="card-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> ${p.downloads || 0}</span>
                <span class="card-meta-item"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${formatDate(p.uploadedAt)}</span>
            </div>
            <div class="card-footer">
                <span class="card-filename" title="${escapeHtml(p.originalName)}">${escapeHtml(p.originalName)}</span>
                <a href="/api/projects/${p.id}/download" class="btn btn-download">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Скачать
                </a>
            </div>
        </div>
    `).join('');
}

function updateStats(projects) {
    statProjects.textContent = projects.length;
    statDownloads.textContent = projects.reduce((sum, p) => sum + (p.downloads || 0), 0);
    statSize.textContent = formatSize(projects.reduce((sum, p) => sum + (p.fileSizeBytes || 0), 0));
}

// ================================================
// File Upload
// ================================================

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        showFilePreview(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) showFilePreview(fileInput.files[0]);
});

function showFilePreview(file) {
    filePreviewName.textContent = file.name;
    filePreviewSize.textContent = formatSize(file.size);
    filePreview.classList.remove('hidden');
    dropZone.style.display = 'none';
}

fileRemoveBtn.addEventListener('click', () => {
    fileInput.value = '';
    filePreview.classList.add('hidden');
    dropZone.style.display = '';
});

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files.length) { showToast('Выбери файл', 'error'); return; }
    const name = document.getElementById('projectName').value.trim();
    if (!name) { showToast('Введи название', 'error'); return; }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('description', document.getElementById('projectDesc').value);
    formData.append('category', document.getElementById('projectCategory').value);
    formData.append('tags', document.getElementById('projectTags').value);

    progressContainer.classList.remove('hidden');
    uploadBtn.disabled = true;

    try {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = pct + '%';
                progressText.textContent = pct + '%';
            }
        });
        await new Promise((resolve, reject) => {
            xhr.onload = () => xhr.status < 300 ? resolve() : reject(JSON.parse(xhr.responseText));
            xhr.onerror = () => reject({ error: 'Ошибка сети' });
            xhr.open('POST', '/api/projects');
            xhr.send(formData);
        });
        showToast('Проект загружен! 🎉', 'success');
        uploadForm.reset(); fileInput.value = '';
        filePreview.classList.add('hidden'); dropZone.style.display = '';
        progressFill.style.width = '0%'; progressText.textContent = '0%';
        setTimeout(() => showView('projects'), 500);
    } catch (err) {
        showToast(err.error || 'Ошибка загрузки', 'error');
    } finally {
        progressContainer.classList.add('hidden');
        uploadBtn.disabled = false;
    }
});

// ================================================
// Delete Project
// ================================================

function openDeleteModal(id) {
    currentDeleteId = id;
    deleteModal.classList.remove('hidden');
}
cancelDeleteBtn.addEventListener('click', () => { deleteModal.classList.add('hidden'); currentDeleteId = null; });
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) { deleteModal.classList.add('hidden'); currentDeleteId = null; } });
confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentDeleteId) return;
    try {
        await fetch(`/api/projects/${currentDeleteId}`, { method: 'DELETE' });
        showToast('Проект удалён', 'success');
        deleteModal.classList.add('hidden');
        currentDeleteId = null;
        loadProjects();
    } catch { showToast('Ошибка удаления', 'error'); }
});

// Search & Filter
searchInput.addEventListener('input', () => { clearTimeout(searchTimeout); searchTimeout = setTimeout(loadProjects, 300); });
categoryFilter.addEventListener('change', loadProjects);

// ================================================
// AI CHAT
// ================================================

function addChatMessage(role, text) {
    // Hide welcome if visible
    const welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const msg = document.createElement('div');
    msg.className = `message ${role === 'user' ? 'user' : 'bot'}`;

    const avatarContent = role === 'user' ? '👤' : '🤖';

    msg.innerHTML = `
        <div class="message-avatar">${avatarContent}</div>
        <div class="message-bubble">${role === 'user' ? escapeHtml(text) : renderMarkdown(text)}</div>
    `;

    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
    const typing = document.createElement('div');
    typing.className = 'message bot';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-bubble">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    chatMessages.appendChild(typing);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
    const typing = document.getElementById('typingIndicator');
    if (typing) typing.remove();
}

async function sendChatMessage(text) {
    if (isChatLoading || !text.trim()) return;

    const message = text.trim();
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Add user message
    addChatMessage('user', message);
    chatHistory.push({ role: 'user', text: message });

    isChatLoading = true;
    chatSendBtn.disabled = true;
    showTypingIndicator();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message,
                history: chatHistory.slice(-20) // Keep last 20 messages for context
            })
        });

        const data = await res.json();

        removeTypingIndicator();

        if (data.error) {
            addChatMessage('bot', '⚠️ Ошибка: ' + data.error);
        } else {
            addChatMessage('bot', data.reply);
            chatHistory.push({ role: 'model', text: data.reply });
        }
    } catch (err) {
        removeTypingIndicator();
        addChatMessage('bot', '⚠️ Ошибка подключения к AI. Попробуй снова.');
    } finally {
        isChatLoading = false;
        chatSendBtn.disabled = false;
        chatInput.focus();
    }
}

function sendSuggestion(text) {
    sendChatMessage(text);
}

// Chat input events
chatSendBtn.addEventListener('click', () => sendChatMessage(chatInput.value));
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage(chatInput.value);
    }
});

// Auto-resize textarea
chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// Clear chat
clearChatBtn.addEventListener('click', () => {
    chatHistory = [];
    chatMessages.innerHTML = `
        <div class="chat-welcome">
            <div class="chat-welcome-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3>Привет! Я Gemini AI 👋</h3>
            <p>Спроси меня о чём угодно — программирование, идеи, помощь с проектами и многое другое.</p>
            <div class="chat-suggestions">
                <button class="suggestion-chip" onclick="sendSuggestion('Напиши код для сортировки на Python')">💻 Код на Python</button>
                <button class="suggestion-chip" onclick="sendSuggestion('Придумай идею для мобильного приложения')">💡 Идея для приложения</button>
                <button class="suggestion-chip" onclick="sendSuggestion('Расскажи о нейросетях простым языком')">🧠 Про нейросети</button>
            </div>
        </div>
    `;
    showToast('Чат очищен', 'info');
});

// ================================================
// IMAGE GENERATION
// ================================================

async function generateImage() {
    const prompt = imagePromptInput.value.trim();
    if (isImageLoading || !prompt) {
        showToast('Введи описание изображения', 'error');
        return;
    }

    isImageLoading = true;
    imageGenBtn.disabled = true;
    imageGenLoading.classList.remove('hidden');
    imageGenEmpty.classList.add('hidden');

    try {
        const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
            if (!generatedImages.length) imageGenEmpty.classList.remove('hidden');
        } else {
            generatedImages.unshift({ url: data.imageUrl, prompt, text: data.text });
            renderImageGallery();
            showToast('Изображение сгенерировано! 🎨', 'success');
            imagePromptInput.value = '';
        }
    } catch (err) {
        showToast('Ошибка генерации', 'error');
        if (!generatedImages.length) imageGenEmpty.classList.remove('hidden');
    } finally {
        isImageLoading = false;
        imageGenBtn.disabled = false;
        imageGenLoading.classList.add('hidden');
    }
}

function renderImageGallery() {
    if (!generatedImages.length) {
        imageGenGallery.innerHTML = '';
        imageGenEmpty.classList.remove('hidden');
        return;
    }

    imageGenEmpty.classList.add('hidden');
    imageGenGallery.innerHTML = generatedImages.map((img, i) => `
        <div class="image-card" style="animation-delay: ${i * 0.05}s">
            <img src="${img.url}" alt="${escapeHtml(img.prompt)}" onclick="openImagePreview('${img.url}')" loading="lazy">
            <div class="image-card-info">
                <p class="image-card-prompt">${escapeHtml(img.prompt)}</p>
                <div class="image-card-actions">
                    <a href="${img.url}" download class="btn btn-primary btn-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Скачать
                    </a>
                    <button class="btn btn-ghost btn-sm" onclick="openImagePreview('${img.url}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Открыть
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function openImagePreview(url) {
    imagePreviewImg.src = url;
    imagePreviewDownload.href = url;
    imagePreviewModal.classList.remove('hidden');
}

imagePreviewClose.addEventListener('click', () => imagePreviewModal.classList.add('hidden'));
imagePreviewModal.addEventListener('click', (e) => {
    if (e.target === imagePreviewModal) imagePreviewModal.classList.add('hidden');
});

// Image gen events
imageGenBtn.addEventListener('click', generateImage);
imagePromptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generateImage();
    }
});

// ================================================
// Keyboard shortcuts
// ================================================

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!deleteModal.classList.contains('hidden')) {
            deleteModal.classList.add('hidden');
            currentDeleteId = null;
        }
        if (!imagePreviewModal.classList.contains('hidden')) {
            imagePreviewModal.classList.add('hidden');
        }
    }
});

// ================================================
// Initialize
// ================================================

loadProjects();
