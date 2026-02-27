const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Gemini API Key
const GEMINI_API_KEY = 'AIzaSyDCmAQBsDSJxQZOUdYOCQxt5_pBC0ms2z8';

// Ensure directories exist
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const GENERATED_DIR = path.join(__dirname, 'public', 'generated');
const DATA_FILE = path.join(__dirname, 'data', 'projects.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf-8');

// Middleware
app.use(express.json({ limit: '50mb' }));
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
    limits: { fileSize: 500 * 1024 * 1024 }
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

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ====== Gemini API Helper ======

function geminiRequest(model, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (parsed.error) {
                        reject(new Error(parsed.error.message || 'Gemini API error'));
                    } else {
                        resolve(parsed);
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Gemini response'));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(120000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.write(data);
        req.end();
    });
}

// ====== PROJECT ROUTES ======

app.get('/api/projects', (req, res) => {
    const projects = readProjects();
    projects.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(projects);
});

app.get('/api/projects/:id', (req, res) => {
    const projects = readProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });
    res.json(project);
});

app.post('/api/projects', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const { name, description, category, tags } = req.body;

    if (!name || !name.trim()) {
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

app.get('/api/projects/:id/download', (req, res) => {
    const projects = readProjects();
    const project = projects.find(p => p.id === req.params.id);
    if (!project) return res.status(404).json({ error: 'Проект не найден' });

    const filePath = path.join(UPLOADS_DIR, project.fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Файл не найден' });

    project.downloads = (project.downloads || 0) + 1;
    writeProjects(projects);

    res.download(filePath, project.originalName);
});

app.delete('/api/projects/:id', (req, res) => {
    let projects = readProjects();
    const index = projects.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Проект не найден' });

    const project = projects[index];
    const filePath = path.join(UPLOADS_DIR, project.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    projects.splice(index, 1);
    writeProjects(projects);

    res.json({ message: 'Проект удалён' });
});

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

// ====== GEMINI CHAT ROUTE ======

app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        // Build conversation contents
        const contents = [];

        // Add history
        if (history && Array.isArray(history)) {
            for (const msg of history) {
                contents.push({
                    role: msg.role === 'user' ? 'user' : 'model',
                    parts: [{ text: msg.text }]
                });
            }
        }

        // Add current message
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const result = await geminiRequest('gemini-2.0-flash', {
            contents,
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 8192
            }
        });

        const reply = result.candidates?.[0]?.content?.parts?.[0]?.text || 'Не удалось получить ответ';

        res.json({ reply });

    } catch (err) {
        console.error('Chat error:', err.message);
        res.status(500).json({ error: err.message || 'Ошибка AI' });
    }
});

// ====== GEMINI IMAGE GENERATION ROUTE ======

app.post('/api/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || !prompt.trim()) {
            return res.status(400).json({ error: 'Промпт не может быть пустым' });
        }

        const result = await geminiRequest('gemini-2.0-flash-exp-image-generation', {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        });

        // Extract image and text from response
        const parts = result.candidates?.[0]?.content?.parts || [];
        let imageUrl = null;
        let text = '';

        for (const part of parts) {
            if (part.inlineData) {
                // Save image to file
                const ext = part.inlineData.mimeType === 'image/png' ? '.png' : '.jpg';
                const filename = uuidv4() + ext;
                const filePath = path.join(GENERATED_DIR, filename);

                const buffer = Buffer.from(part.inlineData.data, 'base64');
                fs.writeFileSync(filePath, buffer);

                imageUrl = `/generated/${filename}`;
            }
            if (part.text) {
                text += part.text;
            }
        }

        if (!imageUrl) {
            return res.status(500).json({
                error: 'Не удалось сгенерировать изображение. Попробуй другой промпт.',
                text: text || undefined
            });
        }

        res.json({ imageUrl, text });

    } catch (err) {
        console.error('Image generation error:', err.message);
        res.status(500).json({ error: err.message || 'Ошибка генерации' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📁 Файлы хранятся в: ${UPLOADS_DIR}`);
    console.log(`🤖 Gemini AI подключен`);
});
