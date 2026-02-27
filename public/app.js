// ================================================
// FileShare Hub — Frontend Logic
// ================================================

// State
let currentDeleteId = null;
let searchTimeout = null;

// DOM Elements
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
const navProjects = document.getElementById('navProjects');
const navUpload = document.getElementById('navUpload');

// Stats elements
const statProjects = document.getElementById('statProjects');
const statDownloads = document.getElementById('statDownloads');
const statSize = document.getElementById('statSize');

// ================================================
// View Switching
// ================================================

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    if (viewName === 'upload') {
        document.getElementById('uploadView').classList.add('active');
        navUpload.classList.add('active');
    } else {
        document.getElementById('projectsView').classList.add('active');
        navProjects.classList.add('active');
        loadProjects();
    }
}

navProjects.addEventListener('click', () => showView('projects'));
navUpload.addEventListener('click', () => showView('upload'));

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
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span>${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ================================================
// Format Helpers
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
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;

    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

function getCategoryEmoji(category) {
    const map = {
        'Веб': '🌐',
        'Игры': '🎮',
        'Утилиты': '🔧',
        'Мобильное': '📱',
        'Дизайн': '🎨',
        'Другое': '📦'
    };
    return map[category] || '📦';
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
        console.error('Error loading projects:', err);
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
                <button class="card-delete" onclick="openDeleteModal('${p.id}')" title="Удалить проект">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
            <h3 class="card-title">${escapeHtml(p.name)}</h3>
            ${p.description ? `<p class="card-desc">${escapeHtml(p.description)}</p>` : ''}
            ${p.tags && p.tags.length ? `
                <div class="card-tags">
                    ${p.tags.map(t => `<span class="card-tag">${escapeHtml(t)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="card-meta">
                <span class="card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    ${p.fileSize}
                </span>
                <span class="card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    ${p.downloads || 0}
                </span>
                <span class="card-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    ${formatDate(p.uploadedAt)}
                </span>
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

    const totalBytes = projects.reduce((sum, p) => sum + (p.fileSizeBytes || 0), 0);
    statSize.textContent = formatSize(totalBytes);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================
// File Upload (Drag & Drop + Click)
// ================================================

// Click to select file
dropZone.addEventListener('click', () => fileInput.click());

// Drag events
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

// File selected
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        showFilePreview(fileInput.files[0]);
    }
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

// ================================================
// Form Submission
// ================================================

uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!fileInput.files.length) {
        showToast('Выбери файл для загрузки', 'error');
        return;
    }

    const name = document.getElementById('projectName').value.trim();
    if (!name) {
        showToast('Введи название проекта', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('name', name);
    formData.append('description', document.getElementById('projectDesc').value);
    formData.append('category', document.getElementById('projectCategory').value);
    formData.append('tags', document.getElementById('projectTags').value);

    // Show progress
    progressContainer.classList.remove('hidden');
    uploadBtn.disabled = true;

    try {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                progressFill.style.width = percent + '%';
                progressText.textContent = percent + '%';
            }
        });

        await new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    try {
                        reject(JSON.parse(xhr.responseText));
                    } catch {
                        reject({ error: 'Ошибка загрузки' });
                    }
                }
            };
            xhr.onerror = () => reject({ error: 'Ошибка сети' });
            xhr.open('POST', '/api/projects');
            xhr.send(formData);
        });

        showToast('Проект успешно загружен! 🎉', 'success');

        // Reset form
        uploadForm.reset();
        fileInput.value = '';
        filePreview.classList.add('hidden');
        dropZone.style.display = '';
        progressFill.style.width = '0%';
        progressText.textContent = '0%';

        // Switch to projects view
        setTimeout(() => showView('projects'), 500);

    } catch (err) {
        showToast(err.error || 'Ошибка загрузки файла', 'error');
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

cancelDeleteBtn.addEventListener('click', () => {
    deleteModal.classList.add('hidden');
    currentDeleteId = null;
});

deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) {
        deleteModal.classList.add('hidden');
        currentDeleteId = null;
    }
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (!currentDeleteId) return;

    try {
        const res = await fetch(`/api/projects/${currentDeleteId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();

        showToast('Проект удалён', 'success');
        deleteModal.classList.add('hidden');
        currentDeleteId = null;
        loadProjects();
    } catch {
        showToast('Ошибка удаления проекта', 'error');
    }
});

// ================================================
// Search & Filter
// ================================================

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadProjects, 300);
});

categoryFilter.addEventListener('change', loadProjects);

// ================================================
// Keyboard shortcuts
// ================================================

document.addEventListener('keydown', (e) => {
    // Escape closes modal
    if (e.key === 'Escape' && !deleteModal.classList.contains('hidden')) {
        deleteModal.classList.add('hidden');
        currentDeleteId = null;
    }
});

// ================================================
// Initialize
// ================================================

loadProjects();
