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
      image_data TEXT,
      FOREIGN KEY(article_id) REFERENCES articles(id)
    )
  `);

  try {
    await runQuery("ALTER TABLE article_images ADD COLUMN image_data TEXT");
  } catch (e) { /* already exists */ }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS editorial_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT,
      editor_id TEXT,
      comment_text TEXT,
      date TEXT,
      paragraph_idx INTEGER,
      FOREIGN KEY(article_id) REFERENCES articles(id),
      FOREIGN KEY(editor_id) REFERENCES users(id)
    )
  `);

  try {
    await runQuery("ALTER TABLE editorial_comments ADD COLUMN paragraph_idx INTEGER");
  } catch (e) { /* already exists */ }

  await runQuery(`
    CREATE TABLE IF NOT EXISTS article_reactions (
      article_id TEXT,
      user_id TEXT,
      reaction TEXT,
      PRIMARY KEY (article_id, user_id),
      FOREIGN KEY(article_id) REFERENCES articles(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
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
               GROUP_CONCAT(u.username, ', ') as assignedJournalists,
               GROUP_CONCAT(u.id, ', ') as assignedJournalistIds
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
        assignedJournalistIds: row.assignedJournalistIds ? row.assignedJournalistIds.split(', ') : [],
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
          assignedJournalistIds: art.journalistIds || [],
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

  async getArticleById(id, userId = null) {
    if (dbType === 'sqlite') {
      const art = await getQuery("SELECT * FROM articles WHERE id = ?", [id]);
      if (!art) return null;

      const paragraphs = await allQuery("SELECT paragraph_text FROM paragraphs WHERE article_id = ? ORDER BY idx", [id]);
      const citations = await allQuery("SELECT citation_text FROM citations WHERE article_id = ? ORDER BY idx", [id]);
      const reviews = await allQuery("SELECT * FROM reviews WHERE article_id = ? ORDER BY date DESC", [id]);
      const images = await allQuery("SELECT placeholder_text, image_data FROM article_images WHERE article_id = ?", [id]);
      
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

      // Likes and Dislikes counts
      const likesRow = await getQuery("SELECT COUNT(*) as count FROM article_reactions WHERE article_id = ? AND reaction = 'like'", [id]);
      const dislikesRow = await getQuery("SELECT COUNT(*) as count FROM article_reactions WHERE article_id = ? AND reaction = 'dislike'", [id]);
      const likes = likesRow ? likesRow.count : 0;
      const dislikes = dislikesRow ? dislikesRow.count : 0;

      let userReaction = null;
      if (userId) {
        const userReactionRow = await getQuery("SELECT reaction FROM article_reactions WHERE article_id = ? AND user_id = ?", [id, userId]);
        userReaction = userReactionRow ? userReactionRow.reaction : null;
      }

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
        likes,
        dislikes,
        userReaction,
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
        articleImages: images.map(img => ({
          placeholder: img.placeholder_text,
          data: img.image_data
        })),
        editorialComments: comments.map(c => ({
          id: c.id,
          editorId: c.editor_id,
          editorName: c.editor_name,
          commentText: c.comment_text,
          date: c.date,
          paragraphIdx: c.paragraph_idx
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

      const likes = (art.reactions || []).filter(r => r.reaction === 'like').length;
      const dislikes = (art.reactions || []).filter(r => r.reaction === 'dislike').length;
      const userReaction = userId ? ((art.reactions || []).find(r => r.userId === userId)?.reaction || null) : null;

      return {
        ...art,
        likes,
        dislikes,
        userReaction,
        status: art.status || 'published',
        editorId: art.editorId || null,
        paragraphs: art.paragraphs || [],
        citations: art.citations || [],
        peerReviews: art.peerReviews || [],
        articleImages: (art.articleImages || []).map(img => {
          if (typeof img === 'object' && img !== null) {
            return {
              placeholder: img.placeholder || img.placeholderText || '',
              data: img.data || img.imageData || null
            };
          }
          return {
            placeholder: img,
            data: null
          };
        }),
        editorialComments: (art.editorialComments || []).map(c => ({
          id: c.id,
          editorId: c.editorId,
          editorName: c.editorName,
          commentText: c.commentText,
          date: c.date,
          paragraphIdx: c.paragraphIdx !== undefined ? c.paragraphIdx : null
        })),
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

  async addArticleImage(articleId, placeholderText, imageData = null) {
    if (dbType === 'sqlite') {
      await runQuery("INSERT INTO article_images (article_id, placeholder_text, image_data) VALUES (?, ?, ?)", [articleId, placeholderText, imageData]);
      return { articleId, placeholderText, imageData };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        if (!data[artIdx].articleImages) data[artIdx].articleImages = [];
        data[artIdx].articleImages.push({
          placeholder: placeholderText,
          data: imageData
        });
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return { articleId, placeholderText, imageData };
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

  async addEditorialComment(articleId, editorId, commentText, paragraphIdx) {
    const dateStr = new Date().toLocaleDateString('ro-RO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    if (dbType === 'sqlite') {
      const result = await runQuery(`
        INSERT INTO editorial_comments (article_id, editor_id, comment_text, date, paragraph_idx)
        VALUES (?, ?, ?, ?, ?)
      `, [articleId, editorId, commentText, dateStr, paragraphIdx]);
      
      const user = await getQuery("SELECT username FROM users WHERE id = ?", [editorId]);
      return {
        id: result.lastID,
        articleId,
        editorId,
        editorName: user ? user.username : 'Editor',
        commentText,
        date: dateStr,
        paragraphIdx
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
          date: dateStr,
          paragraphIdx
        };
        data[artIdx].editorialComments.unshift(newComment);
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
        return newComment;
      }
      throw new Error('Article not found');
    }
  },

  async setArticleReaction(articleId, userId, reaction) {
    if (dbType === 'sqlite') {
      if (!reaction) {
        await runQuery("DELETE FROM article_reactions WHERE article_id = ? AND user_id = ?", [articleId, userId]);
      } else {
        const existing = await getQuery("SELECT reaction FROM article_reactions WHERE article_id = ? AND user_id = ?", [articleId, userId]);
        if (existing && existing.reaction === reaction) {
          await runQuery("DELETE FROM article_reactions WHERE article_id = ? AND user_id = ?", [articleId, userId]);
        } else {
          await runQuery("INSERT OR REPLACE INTO article_reactions (article_id, user_id, reaction) VALUES (?, ?, ?)", [articleId, userId, reaction]);
        }
      }
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        if (!data[artIdx].reactions) data[artIdx].reactions = [];
        const existingIdx = data[artIdx].reactions.findIndex(r => r.userId === userId);
        
        if (!reaction) {
          if (existingIdx !== -1) data[artIdx].reactions.splice(existingIdx, 1);
        } else {
          if (existingIdx !== -1) {
            if (data[artIdx].reactions[existingIdx].reaction === reaction) {
              data[artIdx].reactions.splice(existingIdx, 1);
            } else {
              data[artIdx].reactions[existingIdx].reaction = reaction;
            }
          } else {
            data[artIdx].reactions.push({ userId, reaction });
          }
        }
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
      } else {
        throw new Error('Article not found');
      }
    }
  },

  async reorderParagraphs(articleId, paragraphsList, indexMapping) {
    if (dbType === 'sqlite') {
      // 1. Delete all old paragraphs
      await runQuery("DELETE FROM paragraphs WHERE article_id = ?", [articleId]);
      
      // 2. Insert new ones in order
      for (let i = 0; i < paragraphsList.length; i++) {
        await runQuery("INSERT INTO paragraphs (article_id, paragraph_text, idx) VALUES (?, ?, ?)", [articleId, paragraphsList[i], i]);
      }
      
      // 3. Update comments indexMapping
      const comments = await allQuery("SELECT id, paragraph_idx FROM editorial_comments WHERE article_id = ?", [articleId]);
      for (const comment of comments) {
        const oldIdx = comment.paragraph_idx;
        const newIdx = indexMapping[oldIdx];
        if (newIdx !== undefined && newIdx !== null) {
          await runQuery("UPDATE editorial_comments SET paragraph_idx = ? WHERE id = ?", [newIdx, comment.id]);
        }
      }
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const artIdx = data.findIndex(a => a.id === articleId);
      if (artIdx !== -1) {
        // Update paragraphs list
        data[artIdx].paragraphs = paragraphsList;
        
        // Update comments paragraphIdx
        if (data[artIdx].editorialComments) {
          data[artIdx].editorialComments = data[artIdx].editorialComments.map(c => {
            const oldIdx = c.paragraphIdx;
            const newIdx = indexMapping[oldIdx];
            return {
              ...c,
              paragraphIdx: (newIdx !== undefined && newIdx !== null) ? newIdx : oldIdx
            };
          });
        }
        fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2), 'utf-8');
      } else {
        throw new Error('Article not found');
      }
    }
  },

  async getAdminStats() {
    if (dbType === 'sqlite') {
      const totalArticlesRow = await getQuery("SELECT COUNT(*) as count FROM articles");
      
      const statusRows = await allQuery("SELECT status, COUNT(*) as count FROM articles GROUP BY status");
      const categoryRows = await allQuery("SELECT category, COUNT(*) as count FROM articles GROUP BY category");
      
      const totalCommentsRow = await getQuery("SELECT COUNT(*) as count FROM editorial_comments");
      const totalReviewsRow = await getQuery("SELECT COUNT(*) as count FROM reviews");
      
      const likesRow = await getQuery("SELECT COUNT(*) as count FROM article_reactions WHERE reaction = 'like'");
      const dislikesRow = await getQuery("SELECT COUNT(*) as count FROM article_reactions WHERE reaction = 'dislike'");
      
      // Journalists assignments count
      const journalistRows = await allQuery(`
        SELECT u.username, COUNT(*) as count 
        FROM article_journalists aj
        JOIN users u ON aj.user_id = u.id
        GROUP BY u.id
        ORDER BY count DESC
      `);

      // Averages for published articles
      const avgMetricsRow = await getQuery(`
        SELECT 
          AVG(metricsCoefficient) as avgCoefficient,
          AVG(metricsSomatic) as avgSomatic,
          AVG(metricsAcademicHeat) as avgAcademicHeat
        FROM articles
        WHERE status = 'published'
      `);

      return {
        totalArticles: totalArticlesRow.count,
        statusBreakdown: statusRows.reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {}),
        categoryBreakdown: categoryRows.reduce((acc, row) => ({ ...acc, [row.category]: row.count }), {}),
        totalComments: totalCommentsRow.count,
        totalReviews: totalReviewsRow.count,
        totalLikes: likesRow.count,
        totalDislikes: dislikesRow.count,
        journalistRankings: journalistRows.map(row => ({ name: row.username, count: row.count })),
        averages: {
          coefficient: avgMetricsRow.avgCoefficient ? parseFloat(Number(avgMetricsRow.avgCoefficient).toFixed(2)) : 0,
          somatic: avgMetricsRow.avgSomatic ? parseFloat(Number(avgMetricsRow.avgSomatic).toFixed(1)) : 0,
          academicHeat: avgMetricsRow.avgAcademicHeat ? parseFloat(Number(avgMetricsRow.avgAcademicHeat).toFixed(1)) : 0
        }
      };
    } else {
      // JSON database fallback
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));

      const totalArticles = data.length;
      
      const statusBreakdown = {};
      const categoryBreakdown = {};
      let totalComments = 0;
      let totalReviews = 0;
      let totalLikes = 0;
      let totalDislikes = 0;

      const journalistCounts = {};

      let publishedCount = 0;
      let sumCoefficient = 0;
      let sumSomatic = 0;
      let sumAcademicHeat = 0;

      for (const art of data) {
        const status = art.status || 'published';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
        
        const category = art.category || 'Draft';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

        totalComments += (art.editorialComments || []).length;
        totalReviews += (art.peerReviews || []).length;

        const reactions = art.reactions || [];
        totalLikes += reactions.filter(r => r.reaction === 'like').length;
        totalDislikes += reactions.filter(r => r.reaction === 'dislike').length;

        if (art.journalistIds) {
          for (const jId of art.journalistIds) {
            const username = users.find(u => u.id === jId)?.username || jId;
            journalistCounts[username] = (journalistCounts[username] || 0) + 1;
          }
        }

        if (status === 'published' && art.metrics) {
          publishedCount++;
          sumCoefficient += art.metrics.coefficient || 0;
          sumSomatic += art.metrics.somatic || 0;
          sumAcademicHeat += art.metrics.academicHeat || 0;
        }
      }

      const journalistRankings = Object.entries(journalistCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalArticles,
        statusBreakdown,
        categoryBreakdown,
        totalComments,
        totalReviews,
        totalLikes,
        totalDislikes,
        journalistRankings,
        averages: {
          coefficient: publishedCount ? parseFloat((sumCoefficient / publishedCount).toFixed(2)) : 0,
          somatic: publishedCount ? parseFloat((sumSomatic / publishedCount).toFixed(1)) : 0,
          academicHeat: publishedCount ? parseFloat((sumAcademicHeat / publishedCount).toFixed(1)) : 0
        }
      };
    }
  },

  async deleteArticle(id) {
    if (dbType === 'sqlite') {
      await runQuery("DELETE FROM paragraphs WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM citations WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM reviews WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM article_journalists WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM article_images WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM editorial_comments WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM article_reactions WHERE article_id = ?", [id]);
      await runQuery("DELETE FROM articles WHERE id = ?", [id]);
      return { id };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      const filtered = data.filter(art => art.id !== id);
      fs.writeFileSync(jsonFilePath, JSON.stringify(filtered, null, 2), 'utf-8');
      return { id };
    }
  }
};
