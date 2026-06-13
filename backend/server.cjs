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
