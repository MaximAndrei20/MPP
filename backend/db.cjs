const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let sqliteDb = null;
const isTest = process.env.NODE_ENV === 'test';
const jsonFilePath = path.join(__dirname, isTest ? 'database_test.json' : 'database.json');
const sqliteFilePath = path.join(__dirname, isTest ? 'database_test.sqlite' : 'database.sqlite');
const usersJsonFilePath = path.join(__dirname, isTest ? 'users_test.json' : 'users.json');

try {
  const sqlite3 = require('sqlite3').verbose();
  sqliteDb = new sqlite3.Database(sqliteFilePath);
  dbType = 'sqlite';
  console.log('Using SQLite Database:', sqliteFilePath);
} catch (error) {
  dbType = 'json';
  console.log('SQLite failed to load, falling back to JSON file database:', jsonFilePath);
}

// Helper for SQL execution in Promise style
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Initialize SQLite schema
async function initSqliteSchema() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT,
      category TEXT,
      subCategory TEXT,
      date TEXT,
      readingTime TEXT,
      abstract TEXT,
      authorName TEXT,
      authorTitle TEXT,
      authorInstitution TEXT,
      authorAvatar TEXT,
      metricsCoefficient REAL,
      metricsSomatic INTEGER,
      metricsAcademicHeat REAL,
      status TEXT DEFAULT 'published',
      editor_id TEXT
    )
  `);

  // Migration: Add columns if they don't exist
  try {
    await runQuery("ALTER TABLE articles ADD COLUMN status TEXT DEFAULT 'published'");
  } catch (e) { /* already exists */ }
  try {
    await runQuery("ALTER TABLE articles ADD COLUMN editor_id TEXT");
  } catch (e) { /* already exists */ }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT,
      paragraph_text TEXT,
      idx INTEGER,
      FOREIGN KEY(article_id) REFERENCES articles(id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS citations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT,
      citation_text TEXT,
      idx INTEGER,
      FOREIGN KEY(article_id) REFERENCES articles(id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      article_id TEXT,
      reviewer TEXT,
      institution TEXT,
      date TEXT,
      avatar TEXT,
      sentiment TEXT,
      comment TEXT,
      FOREIGN KEY(article_id) REFERENCES articles(id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS article_journalists (
      article_id TEXT,
      user_id TEXT,
      PRIMARY KEY (article_id, user_id),
      FOREIGN KEY(article_id) REFERENCES articles(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS article_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT,
      placeholder_text TEXT,
      FOREIGN KEY(article_id) REFERENCES articles(id)
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT,
      editor_id TEXT,
      comment_text TEXT,
      date TEXT,
      FOREIGN KEY(article_id) REFERENCES articles(id),
      FOREIGN KEY(editor_id) REFERENCES users(id)
    )
  `);
}

module.exports = {
  dbType,

  async init(initialArticles) {
    if (dbType === 'sqlite') {
      await initSqliteSchema();
      
      // Seed default accounts
      const userRow = await getQuery("SELECT COUNT(*) as count FROM users WHERE username = 'admin'");
      if (userRow.count === 0) {
        console.log('Seeding initial system users...');
        await runQuery("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", ['u-admin', 'admin', 'admin', 'admin']);
        await runQuery("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", ['u-editor', 'editor', 'editor', 'editor']);
        await runQuery("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", ['u-jour1', 'journalist1', 'journalist', 'journalist']);
        await runQuery("INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)", ['u-jour2', 'journalist2', 'journalist', 'journalist']);
      }
      
      const row = await getQuery("SELECT COUNT(*) as count FROM articles");
      if (row.count === 0) {
        console.log('Populating SQLite database with initial data...');
        for (const art of initialArticles) {
          await runQuery(`
            INSERT INTO articles (
              id, title, category, subCategory, date, readingTime, abstract,
              authorName, authorTitle, authorInstitution, authorAvatar,
              metricsCoefficient, metricsSomatic, metricsAcademicHeat, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')
          `, [
            art.id, art.title, art.category, art.subCategory, art.date, art.readingTime, art.abstract,
            art.author.name, art.author.title, art.author.institution, art.author.avatar,
            art.metrics.coefficient, art.metrics.somatic, art.metrics.academicHeat
          ]);

          for (let i = 0; i < art.paragraphs.length; i++) {
            await runQuery("INSERT INTO paragraphs (article_id, paragraph_text, idx) VALUES (?, ?, ?)", [
              art.id, art.paragraphs[i], i
            ]);
          }

          for (let i = 0; i < art.citations.length; i++) {
            await runQuery("INSERT INTO citations (article_id, citation_text, idx) VALUES (?, ?, ?)", [
              art.id, art.citations[i], i
            ]);
          }

          for (const rev of art.peerReviews) {
            await runQuery(`
              INSERT INTO reviews (id, article_id, reviewer, institution, date, avatar, sentiment, comment)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              rev.id, art.id, rev.reviewer, rev.institution, rev.date, rev.avatar, rev.sentiment, rev.comment
            ]);
          }
        }
        console.log('SQLite database populated successfully.');
      }
    } else {
      if (!fs.existsSync(jsonFilePath)) {
        console.log('Populating JSON database with initial data...');
        fs.writeFileSync(jsonFilePath, JSON.stringify(initialArticles, null, 2), 'utf-8');
      }
      if (!fs.existsSync(usersJsonFilePath)) {
        console.log('Seeding initial system users into JSON database...');
        const initialUsers = [
          { id: 'u-admin', username: 'admin', password: 'admin', role: 'admin' },
          { id: 'u-editor', username: 'editor', password: 'editor', role: 'editor' },
          { id: 'u-jour1', username: 'journalist1', password: 'journalist', role: 'journalist' },
          { id: 'u-jour2', username: 'journalist2', password: 'journalist', role: 'journalist' }
        ];
        fs.writeFileSync(usersJsonFilePath, JSON.stringify(initialUsers, null, 2), 'utf-8');
      }
    }
  },

  async getArticles() {
    if (dbType === 'sqlite') {
      const rows = await allQuery(`
        SELECT a.id, a.title, a.category, a.subCategory, a.date, a.readingTime, a.abstract, a.status, a.editor_id,
               GROUP_CONCAT(u.username, ', ') as assignedJournalists
        FROM articles a
        LEFT JOIN article_journalists aj ON a.id = aj.article_id
        LEFT JOIN users u ON aj.user_id = u.id
        GROUP BY a.id
      `);
      return rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        subCategory: row.subCategory,
        date: row.date,
        readingTime: row.readingTime,
        abstract: row.abstract,
        status: row.status,
        editorId: row.editor_id,
        author: {
          name: row.assignedJournalists || 'Draft (Neatribuit)',
          title: 'Autori Articol',
          institution: 'Epidermis Research Group',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${row.id}`
        }
      }));
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      
      return data.map(art => {
        let authorNames = 'Draft (Neatribuit)';
        if (art.journalistIds && art.journalistIds.length > 0) {
          authorNames = art.journalistIds
            .map(jId => users.find(u => u.id === jId)?.username || jId)
            .join(', ');
        }

        return {
          id: art.id,
          title: art.title,
          category: art.category,
          subCategory: art.subCategory,
          date: art.date,
          readingTime: art.readingTime,
          abstract: art.abstract,
          status: art.status || 'published',
          editorId: art.editorId || null,
          author: {
            name: authorNames,
            title: 'Autori Articol',
            institution: 'Epidermis Research Group',
            avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${art.id}`
          }
        };
      });
    }
  },

  async getArticleById(id) {
    if (dbType === 'sqlite') {
      const art = await getQuery("SELECT * FROM articles WHERE id = ?", [id]);
      if (!art) return null;

      const paragraphs = await allQuery("SELECT paragraph_text FROM paragraphs WHERE article_id = ? ORDER BY idx", [id]);
      const citations = await allQuery("SELECT citation_text FROM citations WHERE article_id = ? ORDER BY idx", [id]);
      const reviews = await allQuery("SELECT * FROM reviews WHERE article_id = ? ORDER BY date DESC", [id]);
      const images = await allQuery("SELECT placeholder_text FROM article_images WHERE article_id = ?", [id]);
      
      const journalists = await allQuery(`
        SELECT u.id, u.username 
        FROM article_journalists aj 
        JOIN users u ON aj.user_id = u.id 
        WHERE aj.article_id = ?
      `, [id]);

      const comments = await allQuery(`
        SELECT ec.*, u.username as editor_name 
        FROM editorial_comments ec 
        JOIN users u ON ec.editor_id = u.id 
        WHERE ec.article_id = ?
        ORDER BY ec.id DESC
      `, [id]);

      const authorNames = journalists.map(j => j.username).join(', ') || 'Draft (Neatribuit)';

      return {
        id: art.id,
        title: art.title,
        category: art.category,
        subCategory: art.subCategory,
        date: art.date,
        readingTime: art.readingTime,
        abstract: art.abstract,
        status: art.status,
        editorId: art.editor_id,
        author: {
          name: authorNames,
          title: 'Autori Articol',
          institution: 'Epidermis Research Group',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${art.id}`
        },
        metrics: {
          coefficient: art.metricsCoefficient,
          somatic: art.metricsSomatic,
          academicHeat: art.metricsAcademicHeat
        },
        paragraphs: paragraphs.map(p => p.paragraph_text),
        citations: citations.map(c => c.citation_text),
        peerReviews: reviews.map(r => ({
          id: r.id,
          reviewer: r.reviewer,
          institution: r.institution,
          date: r.date,
          avatar: r.avatar,
          sentiment: r.sentiment,
          comment: r.comment
        })),
        articleImages: images.map(img => img.placeholder_text),
        editorialComments: comments.map(c => ({
          id: c.id,
          editorId: c.editor_id,
          editorName: c.editor_name,
          commentText: c.comment_text,
          date: c.date
        })),
        assignedJournalistIds: journalists.map(j => j.id)
      };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const art = data.find(a => a.id === id);
      if (!art) return null;

      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      let authorNames = 'Draft (Neatribuit)';
      if (art.journalistIds && art.journalistIds.length > 0) {
        authorNames = art.journalistIds
          .map(jId => users.find(u => u.id === jId)?.username || jId)
          .join(', ');
      }

      return {
        ...art,
        status: art.status || 'published',
        editorId: art.editorId || null,
        paragraphs: art.paragraphs || [],
        citations: art.citations || [],
        peerReviews: art.peerReviews || [],
        articleImages: art.articleImages || [],
        editorialComments: art.editorialComments || [],
        assignedJournalistIds: art.journalistIds || [],
        author: {
          name: authorNames,
          title: 'Autori Articol',
          institution: 'Epidermis Research Group',
          avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${art.id}`
        }
      };
    }
  },

  async addReview(articleId, review) {
    if (dbType === 'sqlite') {
      await runQuery(`
        INSERT INTO reviews (id, article_id, reviewer, institution, date, avatar, sentiment, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        review.id, articleId, review.reviewer, review.institution, review.date, review.avatar, review.sentiment, review.comment
      ]);
      return review;
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const articleIdx = data.findIndex(art => art.id === articleId);
      if (articleIdx !== -1) {
        if (!data[articleIdx].peerReviews) data[articleIdx].peerReviews = [];
        data[articleIdx].peerReviews.unshift(review);
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return review;
      }
      throw new Error('Article not found');
    }
  },

  async getUserByUsername(username) {
    if (dbType === 'sqlite') {
      const user = await getQuery("SELECT * FROM users WHERE username = ?", [username]);
      return user || null;
    } else {
      if (!fs.existsSync(usersJsonFilePath)) return null;
      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      return users.find(u => u.username === username) || null;
    }
  },

  async createUser(username, password, role) {
    const id = 'u-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    if (dbType === 'sqlite') {
      await runQuery(`
        INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)
      `, [id, username, password, role]);
      return { id, username, role };
    } else {
      let users = [];
      if (fs.existsSync(usersJsonFilePath)) {
        users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      }
      const newUser = { id, username, password, role };
      users.push(newUser);
      fs.writeFileSync(usersJsonFilePath, JSON.stringify(users, null, 2), 'utf-8');
      return { id, username, role };
    }
  },

  // Collaboration functions
  async getJournalists() {
    if (dbType === 'sqlite') {
      const rows = await allQuery("SELECT id, username FROM users WHERE role = 'journalist'");
      return rows;
    } else {
      if (!fs.existsSync(usersJsonFilePath)) return [];
      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      return users.filter(u => u.role === 'journalist').map(u => ({ id: u.id, username: u.username }));
    }
  },

  async createArticle(id, title, editorId) {
    const dateStr = new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric' });
    if (dbType === 'sqlite') {
      await runQuery(`
        INSERT INTO articles (
          id, title, category, subCategory, date, readingTime, abstract,
          authorName, authorTitle, authorInstitution, authorAvatar,
          metricsCoefficient, metricsSomatic, metricsAcademicHeat, status, editor_id
        ) VALUES (?, ?, 'Draft', 'Collaboration', ?, '1 min read', 'Draft in lucru...', '', '', '', '', 0.0, 0, 0.0, 'started', ?)
      `, [id, title, dateStr, editorId]);
      return { id, title, status: 'started', editorId };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const newArt = {
        id,
        title,
        category: 'Draft',
        subCategory: 'Collaboration',
        date: dateStr,
        readingTime: '1 min read',
        abstract: 'Draft in lucru...',
        status: 'started',
        editorId,
        journalistIds: [],
        paragraphs: [],
        citations: [],
        peerReviews: [],
        articleImages: [],
        editorialComments: [],
        metrics: { coefficient: 0.0, somatic: 0, academicHeat: 0.0 }
      };
      data.unshift(newArt);
      fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
      return newArt;
    }
  },

  async assignJournalists(articleId, journalistIds) {
    if (dbType === 'sqlite') {
      await runQuery("UPDATE articles SET status = 'pending' WHERE id = ?", [articleId]);
      await runQuery("DELETE FROM article_journalists WHERE article_id = ?", [articleId]);
      for (const jId of journalistIds) {
        await runQuery("INSERT INTO article_journalists (article_id, user_id) VALUES (?, ?)", [articleId, jId]);
      }
      return { articleId, journalistIds, status: 'pending' };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        data[artIdx].status = 'pending';
        data[artIdx].journalistIds = journalistIds;
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return data[artIdx];
      }
      throw new Error('Article not found');
    }
  },

  async addArticleParagraph(articleId, text) {
    if (dbType === 'sqlite') {
      const row = await getQuery("SELECT COUNT(*) as count FROM paragraphs WHERE article_id = ?", [articleId]);
      const idx = row.count;
      await runQuery("INSERT INTO paragraphs (article_id, paragraph_text, idx) VALUES (?, ?, ?)", [articleId, text, idx]);
      
      // Update reading time dynamically
      const paragraphs = await allQuery("SELECT paragraph_text FROM paragraphs WHERE article_id = ?", [articleId]);
      const totalWords = paragraphs.map(p => p.paragraph_text).join(" ").split(" ").length;
      const readingTime = `${Math.ceil(totalWords / 200)} min read`;
      await runQuery("UPDATE articles SET readingTime = ? WHERE id = ?", [readingTime, articleId]);

      return { articleId, text, idx };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        if (!data[artIdx].paragraphs) data[artIdx].paragraphs = [];
        data[artIdx].paragraphs.push(text);
        
        const totalWords = data[artIdx].paragraphs.join(" ").split(" ").length;
        data[artIdx].readingTime = `${Math.ceil(totalWords / 200)} min read`;

        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return { articleId, text };
      }
      throw new Error('Article not found');
    }
  },

  async addArticleImage(articleId, placeholderText) {
    if (dbType === 'sqlite') {
      await runQuery("INSERT INTO article_images (article_id, placeholder_text) VALUES (?, ?)", [articleId, placeholderText]);
      return { articleId, placeholderText };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        if (!data[artIdx].articleImages) data[artIdx].articleImages = [];
        data[artIdx].articleImages.push(placeholderText);
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return { articleId, placeholderText };
      }
      throw new Error('Article not found');
    }
  },

  async finalizeArticle(articleId) {
    if (dbType === 'sqlite') {
      await runQuery("UPDATE articles SET status = 'finalized' WHERE id = ?", [articleId]);
      return { articleId, status: 'finalized' };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        data[artIdx].status = 'finalized';
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return data[artIdx];
      }
      throw new Error('Article not found');
    }
  },

  async publishArticle(articleId) {
    if (dbType === 'sqlite') {
      // Give the article an abstract from first paragraph if empty
      const pRow = await getQuery("SELECT paragraph_text FROM paragraphs WHERE article_id = ? ORDER BY idx LIMIT 1", [articleId]);
      const abstract = pRow ? pRow.paragraph_text.substring(0, 150) + '...' : 'Studiu publicat despre teoria transpiratiei.';
      
      // Update status, abstract, and randomized academic metrics
      const coef = (Math.random() * 0.5 + 0.4).toFixed(2);
      const som = Math.floor(Math.random() * 40 + 60);
      const heat = (Math.random() * 3 + 7).toFixed(1);

      await runQuery(`
        UPDATE articles 
        SET status = 'published', abstract = ?, metricsCoefficient = ?, metricsSomatic = ?, metricsAcademicHeat = ?, category = 'Cercetare', subCategory = 'Colaborare'
        WHERE id = ?
      `, [abstract, coef, som, heat, articleId]);
      return { articleId, status: 'published' };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        const firstP = data[artIdx].paragraphs[0] || 'Studiu publicat despre teoria transpiratiei.';
        data[artIdx].status = 'published';
        data[artIdx].abstract = firstP.substring(0, 150) + '...';
        data[artIdx].category = 'Cercetare';
        data[artIdx].subCategory = 'Colaborare';
        data[artIdx].metrics = {
          coefficient: parseFloat((Math.random() * 0.5 + 0.4).toFixed(2)),
          somatic: Math.floor(Math.random() * 40 + 60),
          academicHeat: parseFloat((Math.random() * 3 + 7).toFixed(1))
        };
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return data[artIdx];
      }
      throw new Error('Article not found');
    }
  },

  async addEditorialComment(articleId, editorId, commentText) {
    const dateStr = new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (dbType === 'sqlite') {
      const result = await runQuery(`
        INSERT INTO editorial_comments (article_id, editor_id, comment_text, date)
        VALUES (?, ?, ?, ?)
      `, [articleId, editorId, commentText, dateStr]);
      
      const user = await getQuery("SELECT username FROM users WHERE id = ?", [editorId]);
      return {
        id: result.lastID,
        articleId,
        editorId,
        editorName: user ? user.username : 'Editor',
        commentText,
        date: dateStr
      };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      const editorName = users.find(u => u.id === editorId)?.username || 'Editor';

      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        if (!data[artIdx].editorialComments) data[artIdx].editorialComments = [];
        const newComment = {
          id: Date.now(),
          editorId,
          editorName,
          commentText,
          date: dateStr
        };
        data[artIdx].editorialComments.unshift(newComment);
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return newComment;
      }
      throw new Error('Article not found');
    }
  }
};
