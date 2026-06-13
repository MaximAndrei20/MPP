import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, MessageSquare, Plus } from 'lucide-react';

function App() {
  const [articles, setArticles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Form State for new Review
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");

  const categories = ["All", "Thermodynamics", "Philosophy", "Economics", "Psychology"];

  // 1. Fetch all articles summary on component mount
  useEffect(() => {
    fetch('/api/articles')
      .then(res => res.json())
      .then(data => {
        setArticles(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch(err => console.error("Error loading articles from backend:", err));
  }, []);

  // 2. Fetch specific article details when selectedId changes
  useEffect(() => {
    if (!selectedId) return;

    fetch(`/api/articles/${selectedId}`)
      .then(res => res.json())
      .then(data => {
        setSelectedArticle(data);
      })
      .catch(err => console.error("Error loading article details:", err));
  }, [selectedId]);

  // Real-time local filtering of the list
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesCategory = selectedCategory === "All" || article.category === selectedCategory;
      const matchesSearch = 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.author.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [articles, searchQuery, selectedCategory]);

  // Handle Review Submission
  const handleAddReview = (e) => {
    e.preventDefault();
    if (!reviewer.trim() || !comment.trim()) return;

    fetch(`/api/articles/${selectedId}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewer, comment })
    })
      .then(res => res.json())
      .then(savedReview => {
        // Update selected article's reviews locally in-state
        setSelectedArticle(prev => ({
          ...prev,
          peerReviews: [savedReview, ...prev.peerReviews]
        }));
        // Reset inputs
        setReviewer("");
        setComment("");
      })
      .catch(err => console.error("Error submitting review to backend:", err));
  };

  return (
    <div className="app-container">
      {/* Simplistic Header */}
      <header className="journal-header">
        <div className="header-top">
          <div className="journal-logo">
            <h1 className="logo-main">Epidermis</h1>
            <p className="logo-sub">Teoria Transpirației — Jurnal Online</p>
          </div>
          <div className="journal-metadata">
            <div className="metadata-item">Mod Conexiune: <span>Server Activ (SQLite/JSON)</span></div>
          </div>
        </div>

        <div className="controls-row">
          <div className="search-wrapper">
            <Search className="search-icon" />
            <input 
              type="text" 
              placeholder="Caută în titlu sau autor..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="category-tabs">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Split View */}
      <main className="main-content">
        
        {/* Left column: Master List */}
        <section className="master-list-panel">
          <h2 className="master-list-title">Articole publicate ({filteredArticles.length})</h2>
          {filteredArticles.length === 0 ? (
            <div className="empty-state">
              <BookOpen className="empty-state-logo" />
              <p>Niciun articol găsit</p>
            </div>
          ) : (
            filteredArticles.map(article => (
              <div 
                key={article.id}
                onClick={() => setSelectedId(article.id)}
                className={`article-card ${selectedId === article.id ? 'active' : ''}`}
              >
                <div className="card-meta">
                  <span className="card-category">{article.category}</span>
                  <span>{article.readingTime}</span>
                </div>
                <h3 className="card-title">{article.title}</h3>
                <p className="card-abstract">{article.abstract}</p>
                <div className="card-footer">
                  <span>De: {article.author.name}</span>
                  <span>{article.date}</span>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Right column: Detail View */}
        <section className="detail-panel">
          {selectedArticle ? (
            <div key={selectedArticle.id} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              <div className="detail-header">
                <div className="detail-breadcrumbs">
                  Domeniu: {selectedArticle.category} &raquo; {selectedArticle.subCategory}
                </div>
                <h2 className="detail-title">{selectedArticle.title}</h2>
                <div className="detail-meta-text">
                  Publicat de: <strong>{selectedArticle.author.name}</strong> ({selectedArticle.author.institution}) pe data de {selectedArticle.date} &bull; {selectedArticle.readingTime}
                </div>
              </div>

              {/* Simplistic CSS Image Placeholder */}
              <div className="image-placeholder">
                <div className="placeholder-icon">[ Imagine Placeholder ]</div>
                <div className="placeholder-text">Reprezentare conceptuală: {selectedArticle.title}</div>
              </div>

              {/* Abstract */}
              <div className="abstract-box">
                <strong>Rezumat / Abstract:</strong> {selectedArticle.abstract}
              </div>

              {/* Body Paragraphs */}
              <div className="article-body">
                {selectedArticle.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {/* Simplistic Sweat Metrics */}
              <div className="simplified-metrics">
                <h3>Parametrii Articolului</h3>
                <ul>
                  <li><strong>Coeficient Transpirație:</strong> {selectedArticle.metrics.coefficient}</li>
                  <li><strong>Intensitate Somatică:</strong> {selectedArticle.metrics.somatic}%</li>
                  <li><strong>Index Căldură Academică:</strong> {selectedArticle.metrics.academicHeat}/10</li>
                </ul>
              </div>

              {/* Citations List */}
              {selectedArticle.citations && selectedArticle.citations.length > 0 && (
                <div className="citations-list-box">
                  <h3>Referințe Bibliografice</h3>
                  <ol>
                    {selectedArticle.citations.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Peer Reviews Board */}
              <div className="reviews-section">
                <h3>Recenzii Peer Review ({selectedArticle.peerReviews.length})</h3>
                
                <div className="reviews-list">
                  {selectedArticle.peerReviews.map(review => (
                    <div key={review.id} className="review-card">
                      <div className="review-header">
                        <strong>{review.reviewer}</strong>
                        <span>({review.institution})</span>
                        <span className="review-sentiment">{review.sentiment}</span>
                      </div>
                      <p className="review-comment">"{review.comment}"</p>
                    </div>
                  ))}
                </div>

                {/* Simplified Submit Review Form */}
                <form onSubmit={handleAddReview} className="add-review-form">
                  <h4>Adaugă evaluare academică</h4>
                  <div className="form-group">
                    <label>Nume Recenzor:</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Ex: Popescu Ion"
                      value={reviewer} 
                      onChange={e => setReviewer(e.target.value)} 
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Comentariu Evaluare:</label>
                    <textarea 
                      required 
                      placeholder="Comentariul tău academic referitor la Teoria Transpirației..."
                      value={comment} 
                      onChange={e => setComment(e.target.value)} 
                      className="form-textarea"
                    />
                  </div>
                  <button type="submit" className="submit-btn">Trimite Recenzia</button>
                </form>
              </div>

            </div>
          ) : (
            <div className="empty-state">
              <BookOpen className="empty-state-logo" />
              <p>Se încarcă detaliile articolului...</p>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

export default App;
