const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueName = uuidv4() + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

// Helper: read/write projects
function readProjects() {
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch {
        return [];
    }
}

function writeProjects(projects) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

// Format file size
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ====== API ROUTES ======

// GET all projects
app.get('/api/projects', (req, res) => {
    const projects = readProjects();
    // Sort by date, newest first
    projects.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(projects);
});

// GET single project
app.get('/api/projects/:id', (req, res) => {
    const projects = readProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    res.json(project);
});

// POST upload new project
app.post('/api/projects', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const { name, description, category, tags } = req.body;

    if (!name || !name.trim()) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Название проекта обязательно' });
    }

    const project = {
        id: uuidv4(),
        name: name.trim(),
        description: (description || '').trim(),
        category: (category || 'Другое').trim(),
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileSize: formatSize(req.file.size),
        fileSizeBytes: req.file.size,
        downloads: 0,
        uploadedAt: new Date().toISOString()
    };

    const projects = readProjects();
    projects.push(project);
    writeProjects(projects);

    res.status(201).json(project);
});

// GET download file
app.get('/api/projects/:id/download', (req, res) => {
    const projects = readProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });

    const filePath = path.join(UPLOADS_DIR, project.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });

    // Increment download count
    project.downloads = (project.downloads || 0) + 1;
    writeProjects(projects);

    res.download(filePath, project.originalName);
});

// DELETE project
app.delete('/api/projects/:id', (req, res) => {
    let projects = readProjects();
    const index = projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Проект не найден' });

    const project = projects[index];

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, project.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    projects.splice(index, 1);
    writeProjects(projects);

    res.json({ message: 'Проект удалён' });
});

// GET search projects
app.get('/api/search', (req, res) => {
    const { q, category } = req.query;
    let projects = readProjects();

    if (q) {
        const query = q.toLowerCase();
        projects = projects.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query) ||
            (p.tags && p.tags.some(t => t.toLowerCase().includes(query)))
        );
    }

    if (category && category !== 'all') {
        projects = projects.filter(p => p.category === category);
    }

    projects.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(projects);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Файлы хранятся в: ${UPLOADS_DIR}`);
});
