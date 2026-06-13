const fs = require('fs');
const path = require('path');

let dbType = 'sqlite';
let sqliteDb = null;
const jsonFilePath = path.join(__dirname, 'database.json');
const sqliteFilePath = path.join(__dirname, 'database.sqlite');

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
      metricsAcademicHeat REAL
    )
  `);

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
}

module.exports = {
  dbType,

  async init(initialArticles) {
    if (dbType === 'sqlite') {
      await initSqliteSchema();
      
      // Seed admin user
      const userRow = await getQuery("SELECT COUNT(*) as count FROM users WHERE username = 'admin'");
      if (userRow.count === 0) {
        console.log('Seeding hardcoded admin user into SQLite...');
        const adminId = 'u-' + Date.now();
        await runQuery(`
          INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)
        `, [adminId, 'admin', 'admin', 'admin']);
      }
      
      const row = await getQuery("SELECT COUNT(*) as count FROM articles");
      if (row.count === 0) {
        console.log('Populating SQLite database with initial data...');
        for (const art of initialArticles) {
          await runQuery(`
            INSERT INTO articles (
              id, title, category, subCategory, date, readingTime, abstract,
              authorName, authorTitle, authorInstitution, authorAvatar,
              metricsCoefficient, metricsSomatic, metricsAcademicHeat
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      const usersJsonFilePath = path.join(__dirname, 'users.json');
      if (!fs.existsSync(usersJsonFilePath)) {
        console.log('Seeding hardcoded admin user into JSON database...');
        const initialUsers = [
          { id: 'u-admin', username: 'admin', password: 'admin', role: 'admin' }
        ];
        fs.writeFileSync(usersJsonFilePath, JSON.stringify(initialUsers, null, 2), 'utf-8');
      }
    }
  },

  async getArticles() {
    if (dbType === 'sqlite') {
      const rows = await allQuery(`
        SELECT id, title, category, subCategory, date, readingTime, abstract,
               authorName, authorTitle, authorInstitution, authorAvatar
        FROM articles
      `);
      return rows.map(row => ({
        id: row.id,
        title: row.title,
        category: row.category,
        subCategory: row.subCategory,
        date: row.date,
        readingTime: row.readingTime,
        abstract: row.abstract,
        author: {
          name: row.authorName,
          title: row.authorTitle,
          institution: row.authorInstitution,
          avatar: row.authorAvatar
        }
      }));
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      return data.map(art => ({
        id: art.id,
        title: art.title,
        category: art.category,
        subCategory: art.subCategory,
        date: art.date,
        readingTime: art.readingTime,
        abstract: art.abstract,
        author: art.author
      }));
    }
  },

  async getArticleById(id) {
    if (dbType === 'sqlite') {
      const art = await getQuery("SELECT * FROM articles WHERE id = ?", [id]);
      if (!art) return null;

      const paragraphs = await allQuery("SELECT paragraph_text FROM paragraphs WHERE article_id = ? ORDER BY idx", [id]);
      const citations = await allQuery("SELECT citation_text FROM citations WHERE article_id = ? ORDER BY idx", [id]);
      const reviews = await allQuery("SELECT * FROM reviews WHERE article_id = ? ORDER BY date DESC", [id]);

      return {
        id: art.id,
        title: art.title,
        category: art.category,
        subCategory: art.subCategory,
        date: art.date,
        readingTime: art.readingTime,
        abstract: art.abstract,
        author: {
          name: art.authorName,
          title: art.authorTitle,
          institution: art.authorInstitution,
          avatar: art.authorAvatar
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
        }))
      };
    } else {
      const data = JSON.parse(fs.readFileSync(jsonFilePath, 'utf-8'));
      return data.find(art => art.id === id) || null;
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
      const usersJsonFilePath = path.join(__dirname, 'users.json');
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
      const usersJsonFilePath = path.join(__dirname, 'users.json');
      let users = [];
      if (fs.existsSync(usersJsonFilePath)) {
        users = JSON.parse(fs.readFileSync(usersJsonFilePath, 'utf-8'));
      }
      const newUser = { id, username, password, role };
      users.push(newUser);
      fs.writeFileSync(usersJsonFilePath, JSON.stringify(users, null, 2), 'utf-8');
      return { id, username, role };
    }
  }
};
