import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, MessageSquare, LogOut, ShieldAlert } from 'lucide-react';

function App() {
  const [articles, setArticles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [authError, setAuthError] = useState("");

  // Review Form State
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");

  const categories = ["All", "Thermodynamics", "Philosophy", "Economics", "Psychology"];

  // 1. Fetch all articles on mount (if user is logged in)
  useEffect(() => {
    if (!currentUser) return;

    fetch('/api/articles')
      .then(res => res.json())
      .then(data => {
        setArticles(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch(err => console.error("Error loading articles:", err));
  }, [currentUser]);

  // 2. Fetch specific article details on selection
  useEffect(() => {
    if (!selectedId || !currentUser) return;

    fetch(`/api/articles/${selectedId}`)
      .then(res => res.json())
      .then(data => {
        setSelectedArticle(data);
      })
      .catch(err => console.error("Error loading article details:", err));
  }, [selectedId, currentUser]);

  // Handle Login/Register form submission
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    setAuthError("");

    if (!username.trim() || !password.trim()) {
      setAuthError("Numele și parola sunt obligatorii");
      return;
    }

    const endpoint = isLoginMode ? '/api/login' : '/api/register';
    const body = isLoginMode 
      ? { username, password } 
      : { username, password, role };

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Autentificare eșuată");
        }
        return data;
      })
      .then(data => {
        // For register, we automatically log in the user using the response
        const userSession = { username: data.username, role: data.role };
        setCurrentUser(userSession);
        localStorage.setItem('currentUser', JSON.stringify(userSession));
        
        // Reset form
        setUsername("");
        setPassword("");
        setRole("user");
      })
      .catch(err => {
        setAuthError(err.message);
      });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setSelectedArticle(null);
    setArticles([]);
  };

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
        setSelectedArticle(prev => ({
          ...prev,
          peerReviews: [savedReview, ...prev.peerReviews]
        }));
        setReviewer("");
        setComment("");
      })
      .catch(err => console.error("Error submitting review:", err));
  };

  // RENDER LOGIN / REGISTER SCREEN
  if (!currentUser) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="logo-main">Epidermis</h1>
            <p className="logo-sub">Teoria Transpirației — Autentificare</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            <h2>{isLoginMode ? "Conectare Cont" : "Înregistrare Cont Nou"}</h2>
            
            {authError && <div className="auth-error-msg">{authError}</div>}

            <div className="form-group">
              <label htmlFor="auth-username">Nume Utilizator</label>
              <input 
                id="auth-username"
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Introdu numele..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="auth-password">Parolă</label>
              <input 
                id="auth-password"
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Introdu parola..."
                className="form-input"
              />
            </div>

            {!isLoginMode && (
              <div className="form-group">
                <label htmlFor="auth-role">Rol Utilizator</label>
                <select 
                  id="auth-role"
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className="form-select"
                >
                  <option value="user">User Normal (Verde)</option>
                  <option value="journalist">Journalist (Albastru)</option>
                  <option value="editor">Editor (Galben)</option>
                </select>
              </div>
            )}

            <button type="submit" className="submit-btn" style={{ width: '100%', marginTop: '0.5rem' }}>
              {isLoginMode ? "Conectare" : "Înregistrare"}
            </button>
          </form>

          <div className="auth-toggle">
            {isLoginMode ? (
              <p>Nu ai cont? <button onClick={() => { setIsLoginMode(false); setAuthError(""); }}>Înregistrează-te</button></p>
            ) : (
              <p>Ai deja cont? <button onClick={() => { setIsLoginMode(true); setAuthError(""); }}>Conectează-te</button></p>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <strong>Cont Admin Hardcodat:</strong><br />
            Username: <code style={{ color: 'var(--color-accent)' }}>admin</code> | Parolă: <code style={{ color: 'var(--color-accent)' }}>admin</code>
          </div>
        </div>
      </div>
    );
  }

  // RENDER MAIN APPLICATION SCREEN
  return (
    <div className="app-container">
      {/* Header */}
      <header className="journal-header">
        <div className="header-top">
          <div className="journal-logo">
            <h1 className="logo-main">Epidermis</h1>
            <p className="logo-sub">Teoria Transpirației — Jurnal Online</p>
          </div>

          {/* User & Role Badge Indicator */}
          <div className="user-profile-badge">
            <span>Utilizator: <strong>{currentUser.username}</strong></span>
            <span className={`role-badge role-${currentUser.role}`}>
              {currentUser.role.toUpperCase()}
            </span>
            <button onClick={handleLogout} className="logout-btn" title="Deconectare">
              <LogOut style={{ width: '14px', height: '14px' }} />
              Ieși
            </button>
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

              {/* CSS Image Placeholder */}
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

              {/* Metrics */}
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

                {/* Submit Review Form */}
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
