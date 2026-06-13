const express = require('express');
const cors = require('cors');
const os = require('os');
const db = require('./db.cjs');
const { generateServerArticles } = require('./serverDataGenerator.cjs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const isIPv4 = iface.family === 'IPv4' || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.get('/api/articles', async (req, res) => {
  try {
    const articles = await db.getArticles();
    res.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  try {
    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (error) {
    console.error('Error fetching article detail:', error);
    res.status(500).json({ error: 'Failed to fetch article details' });
  }
});

app.post('/api/articles/:id/reviews', async (req, res) => {
  const { reviewer, institution, sentiment, comment } = req.body;
  if (!reviewer || !comment) {
    return res.status(400).json({ error: 'Reviewer name and comment are required' });
  }

  try {
    const newReview = {
      id: 'rev-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      reviewer: reviewer.startsWith('Dr. ') || reviewer.startsWith('Prof. ') ? reviewer : 'Dr. ' + reviewer,
      institution: institution || 'Independent Institute of Perspiration',
      date: new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' }),
      avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${reviewer}`,
      sentiment: sentiment || 'Approved with minor revisions',
      comment: comment
    };

    const savedReview = await db.addReview(req.params.id, newReview);
    res.status(201).json(savedReview);
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ error: 'Failed to save peer review' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password and role are required' });
  }

  const allowedRoles = ["user", "journalist", "editor"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role selection' });
  }

  try {
    const existingUser = await db.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const newUser = await db.createUser(username, password, role);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error in register:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user || user.password !== password) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    res.json({
      username: user.username,
      role: user.role
    });
  } catch (error) {
    console.error('Error in login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/journalists', async (req, res) => {
  try {
    const list = await db.getJournalists();
    res.json(list);
  } catch (error) {
    console.error('Error fetching journalists:', error);
    res.status(500).json({ error: 'Failed to fetch journalists' });
  }
});

app.post('/api/articles', async (req, res) => {
  const { title, editorUsername, journalistIds } = req.body;

  // Backend validation
  if (!title || typeof title !== 'string' || title.trim().length < 5) {
    return res.status(400).json({ error: 'Titlul trebuie să aibă cel puțin 5 caractere' });
  }

  if (!editorUsername) {
    return res.status(400).json({ error: 'Editor username is required' });
  }

  if (!journalistIds || !Array.isArray(journalistIds) || journalistIds.length < 1 || journalistIds.length > 2) {
    return res.status(400).json({ error: 'Trebuie să asignezi exact 1 sau 2 jurnaliști' });
  }

  try {
    const editor = await db.getUserByUsername(editorUsername);
    if (!editor || editor.role !== 'editor') {
      return res.status(403).json({ error: 'Doar utilizatorii cu rolul de Editor pot crea articole' });
    }

    const newId = 'art-' + Date.now();
    await db.createArticle(newId, title.trim(), editor.id);
    await db.assignJournalists(newId, journalistIds);

    const createdArticle = await db.getArticleById(newId);
    res.status(201).json(createdArticle);
  } catch (error) {
    console.error('Error creating article:', error);
    res.status(500).json({ error: 'Failed to create article' });
  }
});

app.post('/api/articles/:id/paragraphs', async (req, res) => {
  const { text, username } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Paragraph text is required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (article.status !== 'pending') {
      return res.status(400).json({ error: 'Articolul nu este în starea de lucru (pending)' });
    }

    if (!article.assignedJournalistIds.includes(user.id)) {
      return res.status(403).json({ error: 'Nu ești asignat ca jurnalist la acest articol' });
    }

    const p = await db.addArticleParagraph(req.params.id, text.trim());
    res.status(201).json(p);
  } catch (error) {
    console.error('Error adding paragraph:', error);
    res.status(500).json({ error: 'Failed to add paragraph' });
  }
});

app.post('/api/articles/:id/images', async (req, res) => {
  const { placeholderText, username } = req.body;
  if (!placeholderText || !placeholderText.trim()) {
    return res.status(400).json({ error: 'Image placeholder text is required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (article.status !== 'pending') {
      return res.status(400).json({ error: 'Articolul nu este în starea de lucru (pending)' });
    }

    if (!article.assignedJournalistIds.includes(user.id)) {
      return res.status(403).json({ error: 'Nu ești asignat ca jurnalist la acest articol' });
    }

    const img = await db.addArticleImage(req.params.id, placeholderText.trim());
    res.status(201).json(img);
  } catch (error) {
    console.error('Error adding image placeholder:', error);
    res.status(500).json({ error: 'Failed to add image' });
  }
});

app.post('/api/articles/:id/finalize', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await db.getUserByUsername(username);
    if (!user) {
      return res.status(403).json({ error: 'User not found' });
    }

    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (!article.assignedJournalistIds.includes(user.id)) {
      return res.status(403).json({ error: 'Nu ești asignat ca jurnalist la acest articol' });
    }

    const updated = await db.finalizeArticle(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Error finalizing article:', error);
    res.status(500).json({ error: 'Failed to finalize article' });
  }
});

app.post('/api/articles/:id/publish', async (req, res) => {
  const { username } = req.body;

  try {
    const user = await db.getUserByUsername(username);
    if (!user || user.role !== 'editor') {
      return res.status(403).json({ error: 'Doar un editor poate publica articole' });
    }

    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const updated = await db.publishArticle(req.params.id);
    res.json(updated);
  } catch (error) {
    console.error('Error publishing article:', error);
    res.status(500).json({ error: 'Failed to publish article' });
  }
});

app.post('/api/articles/:id/comments', async (req, res) => {
  const { commentText, username } = req.body;
  if (!commentText || !commentText.trim()) {
    return res.status(400).json({ error: 'Comment text is required' });
  }

  try {
    const user = await db.getUserByUsername(username);
    if (!user || user.role !== 'editor') {
      return res.status(403).json({ error: 'Doar editorii pot adăuga comentarii editoriale' });
    }

    const article = await db.getArticleById(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    const comment = await db.addEditorialComment(req.params.id, user.id, commentText.trim());
    res.status(201).json(comment);
  } catch (error) {
    console.error('Error adding editorial comment:', error);
    res.status(500).json({ error: 'Failed to add editorial comment' });
  }
});

async function startServer() {
  try {
    const initialArticles = generateServerArticles();
    await db.init(initialArticles);
    
    app.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIpAddress();
      console.log('\n==================================================');
      console.log(`EPIDERMIS JOURNAL BACKEND running in mode: [${db.dbType.toUpperCase()}]`);
      console.log(`Backend API URL:      http://localhost:${PORT}`);
      console.log(`Backend LAN API URL:  http://${localIp}:${PORT}`);
      console.log('--------------------------------------------------');
      console.log('PENTRU RULARE PE TELEFON:');
      console.log(`1. Conectează telefonul la aceeași rețea Wi-Fi.`);
      console.log(`2. Deschide în browser pe telefon adresa:`);
      console.log(`   http://${localIp}:5173`);
      console.log('==================================================\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
