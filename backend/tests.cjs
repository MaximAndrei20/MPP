// Set test environment before requiring anything
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert');

// Clean old test files
const sqliteTestPath = path.join(__dirname, 'database_test.sqlite');
const jsonTestPath = path.join(__dirname, 'database_test.json');
const usersJsonTestPath = path.join(__dirname, 'users_test.json');

try { fs.unlinkSync(sqliteTestPath); } catch (e) {}
try { fs.unlinkSync(jsonTestPath); } catch (e) {}
try { fs.unlinkSync(usersJsonTestPath); } catch (e) {}

const db = require('./db.cjs');

test('Database & Collaboration Test Suite', async (t) => {

  await t.test('1. Init Database and verify seeded users', async () => {
    // Initialize empty DB
    await db.init([]);
    
    // Check if admin is seeded
    const admin = await db.getUserByUsername('admin');
    assert.ok(admin, 'Admin should exist');
    assert.strictEqual(admin.role, 'admin', 'Admin role should be admin');
    
    // Check if editor is seeded
    const editor = await db.getUserByUsername('editor');
    assert.ok(editor, 'Editor should exist');
    assert.strictEqual(editor.role, 'editor', 'Editor role should be editor');

    // Check if journalists are seeded
    const journalists = await db.getJournalists();
    assert.ok(Array.isArray(journalists), 'Journalists list should be an array');
    assert.ok(journalists.length >= 2, 'Should seed at least 2 journalists');
  });

  await t.test('2. User Login credentials validation', async () => {
    // Valid login
    const admin = await db.getUserByUsername('admin');
    assert.strictEqual(admin.password, 'admin', 'Admin password should match');

    // Invalid login (wrong password)
    const editor = await db.getUserByUsername('editor');
    assert.notStrictEqual(editor.password, 'wrong_pass', 'Invalid password should not match');

    // Non-existent user
    const nonUser = await db.getUserByUsername('non_existent');
    assert.strictEqual(nonUser, null, 'Non-existent user should return null');
  });

  await t.test('3. Create and Register user', async () => {
    const username = 'test_journalist';
    const password = 'pass';
    const role = 'journalist';

    const newUser = await db.createUser(username, password, role);
    assert.ok(newUser.id, 'Created user should have an ID');
    assert.strictEqual(newUser.username, username);
    assert.strictEqual(newUser.role, role);

    const fetched = await db.getUserByUsername(username);
    assert.ok(fetched);
    assert.strictEqual(fetched.password, password);
  });

  await t.test('4. Article Creation & Status Flow', async () => {
    const editor = await db.getUserByUsername('editor');
    const journalists = await db.getJournalists();
    const journalist1 = journalists[0];
    const journalist2 = journalists[1];

    const articleId = 'test-art-123';
    const title = 'Test Article on Sweating';

    // 4.1 Create article (starts as draft)
    const art = await db.createArticle(articleId, title, editor.id);
    assert.ok(art);
    
    const details = await db.getArticleById(articleId);
    assert.strictEqual(details.title, title);
    assert.strictEqual(details.status, 'started');
    assert.strictEqual(details.editorId, editor.id);

    // 4.2 Assign journalists (1 journalist)
    await db.assignJournalists(articleId, [journalist1.id]);
    const updatedDetails1 = await db.getArticleById(articleId);
    assert.strictEqual(updatedDetails1.status, 'pending', 'Status should become pending');
    assert.strictEqual(updatedDetails1.assignedJournalistIds.length, 1);
    assert.strictEqual(updatedDetails1.assignedJournalistIds[0], journalist1.id);

    // 4.3 Assign journalists (2 journalists)
    await db.assignJournalists(articleId, [journalist1.id, journalist2.id]);
    const updatedDetails2 = await db.getArticleById(articleId);
    assert.strictEqual(updatedDetails2.assignedJournalistIds.length, 2);

    // 4.4 Add paragraph content
    await db.addArticleParagraph(articleId, 'Test paragraph written by journalist.');
    const detailsWithP = await db.getArticleById(articleId);
    assert.strictEqual(detailsWithP.paragraphs.length, 1);
    assert.strictEqual(detailsWithP.paragraphs[0], 'Test paragraph written by journalist.');

    // 4.5 Add image placeholder
    await db.addArticleImage(articleId, 'CSS image representing perspiration test');
    const detailsWithImg = await db.getArticleById(articleId);
    assert.strictEqual(detailsWithImg.articleImages.length, 1);
    assert.strictEqual(detailsWithImg.articleImages[0].placeholder, 'CSS image representing perspiration test');

    // 4.6 Add editorial comment
    await db.addEditorialComment(articleId, editor.id, 'Good draft, please write more.');
    const detailsWithComment = await db.getArticleById(articleId);
    assert.strictEqual(detailsWithComment.editorialComments.length, 1);
    assert.strictEqual(detailsWithComment.editorialComments[0].commentText, 'Good draft, please write more.');

    // 4.7 Finalize article
    await db.finalizeArticle(articleId);
    const finalized = await db.getArticleById(articleId);
    assert.strictEqual(finalized.status, 'finalized');

    // 4.8 Publish article
    await db.publishArticle(articleId);
    const published = await db.getArticleById(articleId);
    assert.strictEqual(published.status, 'published');

    // 4.9 Delete article
    await db.deleteArticle(articleId);
    const deleted = await db.getArticleById(articleId);
    assert.strictEqual(deleted, null, 'Deleted article should be purged from database');
  });

  await t.test('5. Visibility Info & Journalist Image Uploads', async () => {
    const editor = await db.getUserByUsername('editor');
    const journalists = await db.getJournalists();
    const journalist1 = journalists[0];

    const articleId = 'test-art-visibility-555';
    const title = 'Test Article Visibility and Uploads';

    // Create article
    await db.createArticle(articleId, title, editor.id);
    
    // Assign journalist
    await db.assignJournalists(articleId, [journalist1.id]);

    // Check that getArticles returns assignedJournalistIds
    const allArticles = await db.getArticles();
    const found = allArticles.find(a => a.id === articleId);
    assert.ok(found, 'Created article should be in getArticles list');
    assert.ok(Array.isArray(found.assignedJournalistIds), 'assignedJournalistIds should be an array');
    assert.ok(found.assignedJournalistIds.includes(journalist1.id), 'Should contain assigned journalist ID');
    assert.strictEqual(found.editorId, editor.id, 'Should contain correct editorId');

    // Test adding image with base64 data
    const fakeBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await db.addArticleImage(articleId, 'Grafic Transpiratie', fakeBase64);

    // Get article details and assert image content
    const details = await db.getArticleById(articleId);
    assert.ok(details, 'Article should exist');
    assert.strictEqual(details.articleImages.length, 1, 'Should have one image');
    assert.strictEqual(details.articleImages[0].placeholder, 'Grafic Transpiratie', 'Caption should match');
    assert.strictEqual(details.articleImages[0].data, fakeBase64, 'Base64 image data should match');

    // Clean up
    await db.deleteArticle(articleId);
  });

});
