import { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, MessageSquare, LogOut, Plus, Send, CheckCircle, FileText, Image, ThumbsUp, ThumbsDown, GripVertical } from 'lucide-react';

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

  // Collaboration state
  const [journalistsList, setJournalistsList] = useState([]);
  const [isCreatingArticle, setIsCreatingArticle] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedJournalistIds, setSelectedJournalistIds] = useState([]);
  const [formError, setFormError] = useState("");

  // Edit states for Journalists
  const [newParagraph, setNewParagraph] = useState("");
  const [newImagePlaceholder, setNewImagePlaceholder] = useState("");
  const [uploadedImageBase64, setUploadedImageBase64] = useState("");

  // Comment state for Editors
  const [editorialComment, setEditorialComment] = useState("");
  const [activeCommentParagraphIdx, setActiveCommentParagraphIdx] = useState(null);
  const [viewingCommentsIdx, setViewingCommentsIdx] = useState(null);
  
  // Drag and drop paragraph reordering states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // Review Form State (Normal User)
  const [reviewer, setReviewer] = useState("");
  const [comment, setComment] = useState("");

  const categories = ["All", "Thermodynamics", "Philosophy", "Economics", "Psychology"];

  // 1. Fetch articles summaries on mount / auth change
  useEffect(() => {
    if (!currentUser) return;
    fetchArticles();
  }, [currentUser]);

  const fetchArticles = () => {
    if (!currentUser) return;
    const query = new URLSearchParams({
      userId: currentUser.id,
      role: currentUser.role
    }).toString();
    fetch(`/api/articles?${query}`)
      .then(res => res.json())
      .then(data => {
        setArticles(data);
        if (data.length > 0) {
          // If no article is selected or current selected is not in data, select first
          setSelectedId(prev => data.some(a => a.id === prev) ? prev : data[0].id);
        }
      })
      .catch(err => console.error("Error loading articles:", err));
  };

  // 2. Fetch specific article details
  useEffect(() => {
    if (!selectedId || !currentUser) return;
    fetchArticleDetails();
  }, [selectedId, currentUser]);

  const fetchArticleDetails = () => {
    if (!currentUser || !selectedId) return;
    const query = new URLSearchParams({
      userId: currentUser.id,
      role: currentUser.role
    }).toString();
    fetch(`/api/articles/${selectedId}?${query}`)
      .then(res => res.json())
      .then(data => {
        setSelectedArticle(data);
      })
      .catch(err => console.error("Error loading article details:", err));
  };

  // 3. Fetch journalists list if Editor is logged in
  useEffect(() => {
    if (currentUser && currentUser.role === 'editor') {
      fetch('/api/journalists')
        .then(res => res.json())
        .then(data => setJournalistsList(data))
        .catch(err => console.error("Error loading journalists:", err));
    }
  }, [currentUser]);

  // Handle Login/Register
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
        if (!res.ok) throw new Error(data.error || "Autentificare eșuată");
        return data;
      })
      .then(data => {
        const userSession = { id: data.id, username: data.username, role: data.role };
        setCurrentUser(userSession);
        localStorage.setItem('currentUser', JSON.stringify(userSession));
        
        setUsername("");
        setPassword("");
        setRole("user");
      })
      .catch(err => setAuthError(err.message));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    setSelectedArticle(null);
    setArticles([]);
    setIsCreatingArticle(false);
  };

  // Filter articles based on roles:
  // - Readers (User normal) see all published articles.
  // - Editors see ONLY articles they created (involved).
  // - Journalists see ONLY articles they are assigned to (involved).
  // - Admins see all articles (so they can manage/delete).
  const filteredArticles = useMemo(() => {
    if (!currentUser) return [];

    return articles.filter(article => {
      let isVisibleForRole = false;

      if (currentUser.role === 'admin') {
        isVisibleForRole = true;
      } else if (currentUser.role === 'editor') {
        isVisibleForRole = article.editorId === currentUser.id;
      } else if (currentUser.role === 'journalist') {
        const isAssigned = article.author.name.toLowerCase().includes(currentUser.username.toLowerCase());
        isVisibleForRole = isAssigned;
      } else {
        isVisibleForRole = article.status === 'published';
      }

      if (!isVisibleForRole) return false;

      const matchesCategory = selectedCategory === "All" || article.category === selectedCategory;
      const matchesSearch = 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.abstract.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.author.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });
  }, [articles, searchQuery, selectedCategory, currentUser]);

  // Create article logic (Editor only)
  const handleCreateArticle = (e) => {
    e.preventDefault();
    setFormError("");

    // Front-end validations
    if (!newTitle.trim() || newTitle.trim().length < 5) {
      setFormError("Titlul trebuie să aibă cel puțin 5 caractere");
      return;
    }

    if (selectedJournalistIds.length < 1 || selectedJournalistIds.length > 2) {
      setFormError("Trebuie să selectezi exact 1 sau 2 jurnaliști (validare cantitativă)");
      return;
    }

    fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        editorUsername: currentUser.username,
        journalistIds: selectedJournalistIds
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        return data;
      })
      .then(data => {
        setIsCreatingArticle(false);
        setNewTitle("");
        setSelectedJournalistIds([]);
        setArticles(prev => [data, ...prev]);
        setSelectedId(data.id);
      })
      .catch(err => setFormError(err.message));
  };

  const handleJournalistCheckbox = (id) => {
    setSelectedJournalistIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Journalist updates
  const handleAddParagraph = (e) => {
    e.preventDefault();
    if (!newParagraph.trim()) return;

    fetch(`/api/articles/${selectedId}/paragraphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: newParagraph, username: currentUser.username })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchArticleDetails();
        setNewParagraph("");
      })
      .catch(err => alert(err.message));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) {
      setUploadedImageBase64("");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedImageBase64(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleAddImagePlaceholder = (e) => {
    e.preventDefault();
    if (!newImagePlaceholder.trim() && !uploadedImageBase64) {
      alert("Trebuie să introduci o descriere sau să selectezi o imagine.");
      return;
    }

    const form = e.target;

    fetch(`/api/articles/${selectedId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        placeholderText: newImagePlaceholder, 
        imageData: uploadedImageBase64 || null,
        username: currentUser.username 
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchArticleDetails();
        setNewImagePlaceholder("");
        setUploadedImageBase64("");
        form.reset();
      })
      .catch(err => alert(err.message));
  };

  const handleFinalize = () => {
    if (!window.confirm("Ești sigur că vrei să finalizezi redactarea? Nu o vei mai putea edita.")) return;

    fetch(`/api/articles/${selectedId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchArticleDetails();
        fetchArticles();
      })
      .catch(err => alert(err.message));
  };

  // Editor updates
  const handleAddParagraphComment = (paragraphIdx, text) => {
    if (!text.trim()) return;

    fetch(`/api/articles/${selectedId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        commentText: text, 
        username: currentUser.username,
        paragraphIdx: paragraphIdx
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchArticleDetails();
        setEditorialComment("");
        setActiveCommentParagraphIdx(null);
      })
      .catch(err => alert(err.message));
   };

  const handleDropReorder = (fromIdx, toIdx) => {
    if (fromIdx === toIdx || !selectedArticle) return;

    // 1. Calculate new paragraphs array
    const newParagraphs = Array.from(selectedArticle.paragraphs);
    const [removed] = newParagraphs.splice(fromIdx, 1);
    newParagraphs.splice(toIdx, 0, removed);

    // 2. Calculate indices mapping (oldIdx -> newIdx)
    const indices = Array.from({ length: selectedArticle.paragraphs.length }, (_, i) => i);
    const [removedIndex] = indices.splice(fromIdx, 1);
    indices.splice(toIdx, 0, removedIndex);

    const indexMapping = {};
    indices.forEach((oldIdx, newIdx) => {
      indexMapping[oldIdx] = newIdx;
    });

    // 3. Close comments popover & comments inputs (because indices shift)
    setActiveCommentParagraphIdx(null);
    setViewingCommentsIdx(null);

    // 4. PUT request to server
    fetch(`/api/articles/${selectedId}/paragraphs/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: currentUser.username,
        paragraphs: newParagraphs,
        indexMapping
      })
    })
      .then(async res => {
        let data;
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          data = await res.json();
        }
        if (!res.ok) {
          throw new Error((data && data.error) || `Eroare server (${res.status})`);
        }
        return data;
      })
      .then(data => {
        if (data) {
          setSelectedArticle(data);
          fetchArticles();
        }
      })
      .catch(err => {
        console.error("Error reordering paragraphs:", err);
        alert(err.message || "Reordonarea paragrafelor a eșuat.");
      });
  };

  const handlePublish = () => {
    fetch(`/api/articles/${selectedId}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        fetchArticleDetails();
        fetchArticles();
      })
      .catch(err => alert(err.message));
  };

  const handleReact = (reactionType) => {
    if (!currentUser || !selectedId) return;

    fetch(`/api/articles/${selectedId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: currentUser.id, 
        reaction: reactionType 
      })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        setSelectedArticle(prev => prev ? {
          ...prev,
          likes: data.likes,
          dislikes: data.dislikes,
          userReaction: data.userReaction
        } : null);
      })
      .catch(err => alert(err.message));
  };

  // Normal User reviews
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
      .catch(err => console.error(err));
  };

  const handleDeleteArticle = () => {
    if (!window.confirm(`Ești sigur că vrei să ștergi articolul "${selectedArticle.title}" definitiv? Această acțiune este ireversibilă.`)) {
      return;
    }

    fetch(`/api/articles/${selectedId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser.username })
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        setArticles(prev => {
          const updated = prev.filter(a => a.id !== selectedId);
          if (updated.length > 0) {
            setSelectedId(updated[0].id);
          } else {
            setSelectedId(null);
            setSelectedArticle(null);
          }
          return updated;
        });
      })
      .catch(err => alert(err.message));
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
            <strong>Conturi implicite:</strong><br />
            Admin: <code style={{ color: 'var(--color-accent)' }}>admin</code> / <code style={{ color: 'var(--color-accent)' }}>admin</code><br />
            Editor: <code style={{ color: 'var(--color-accent)' }}>editor</code> / <code style={{ color: 'var(--color-accent)' }}>editor</code><br />
            Jurnalist: <code style={{ color: 'var(--color-accent)' }}>journalist1</code> / <code style={{ color: 'var(--color-accent)' }}>journalist</code>
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

          {/* User Badge */}
          <div className="user-profile-badge">
            <span>Utilizator: <strong>{currentUser.username}</strong></span>
            <span className={`role-badge role-${currentUser.role}`}>
              {currentUser.role.toUpperCase()}
            </span>
            {currentUser.role === 'admin' && (
              <button 
                onClick={() => setShowStats(!showStats)} 
                className="stats-toggle-btn"
                style={{
                  backgroundColor: showStats ? 'var(--color-teal)' : 'var(--bg-tertiary)',
                  color: showStats ? '#0b0f19' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  transition: 'all 0.2s ease',
                  marginRight: '0.5rem'
                }}
              >
                <FileText style={{ width: '14px', height: '14px' }} />
                {showStats ? "Articole" : "Statistici"}
              </button>
            )}
            <button onClick={handleLogout} className="logout-btn">
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

      {/* Main Content */}
      <main className="main-content">
        {showStats && currentUser.role === 'admin' ? (
          <AdminStatsDashboard currentUser={currentUser} />
        ) : (
          <>
            {/* Left column: Master List */}
            <section className="master-list-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 className="master-list-title">Articole publicate ({filteredArticles.length})</h2>
            {/* Show Add Button only for Editors */}
            {currentUser.role === 'editor' && (
              <button 
                onClick={() => { setIsCreatingArticle(!isCreatingArticle); setFormError(""); }} 
                className="add-article-btn"
                title="Inițiază Articol Nou"
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Articol
              </button>
            )}
          </div>

          {/* Modal / Inline form for creating article */}
          {isCreatingArticle && currentUser.role === 'editor' && (
            <form onSubmit={handleCreateArticle} className="create-article-inline-form">
              <h3>Inițiază Articol Nou</h3>
              {formError && <div className="form-error-msg">{formError}</div>}
              
              <div className="form-group">
                <label>Titlu Articol:</label>
                <input 
                  type="text"
                  required
                  placeholder="Minim 5 caractere..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Asignează Jurnaliști (Selectează exact 1 sau 2):</label>
                <div className="journalist-checkbox-list">
                  {journalistsList.map(j => (
                    <label key={j.id} className="checkbox-label">
                      <input 
                        type="checkbox"
                        checked={selectedJournalistIds.includes(j.id)}
                        onChange={() => handleJournalistCheckbox(j.id)}
                      />
                      {j.username}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="submit-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Salvează</button>
                <button type="button" onClick={() => setIsCreatingArticle(false)} className="tab-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Anulează</button>
              </div>
            </form>
          )}

          {filteredArticles.length === 0 ? (
            <div className="empty-state">
              <BookOpen className="empty-state-logo" />
              <p>Niciun articol găsit</p>
            </div>
          ) : (
            filteredArticles.map(article => {
              // Status class name mapping
              let statusLabel = article.status.toUpperCase();
              let statusClass = `status-badge status-${article.status}`;

              return (
                <div 
                  key={article.id}
                  onClick={() => { setSelectedId(article.id); setIsCreatingArticle(false); }}
                  className={`article-card ${selectedId === article.id ? 'active' : ''}`}
                >
                  <div className="card-meta">
                    <span className="card-category">{article.category}</span>
                    {currentUser.role === 'editor' && (
                      <span className={statusClass}>{statusLabel}</span>
                    )}
                    <span>{article.readingTime}</span>
                  </div>
                  <h3 className="card-title">{article.title}</h3>
                  <p className="card-abstract">{article.abstract}</p>
                  <div className="card-footer">
                    <span>De: {article.author.name}</span>
                    <span>{article.date}</span>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {/* Right column: Detail View */}
        <section className="detail-panel">
          {selectedArticle ? (
            <div key={selectedArticle.id} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Collaboration status banners */}
              {selectedArticle.status !== 'published' && (
                <div className="collaboration-banner">
                  Stare curentă: <span className={`status-badge status-${selectedArticle.status}`}>{selectedArticle.status.toUpperCase()}</span>
                  {selectedArticle.status === 'pending' && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>Jurnaliștii lucrează la conținut. Editorul poate adăuga sugestii de feedback.</p>}
                  {selectedArticle.status === 'finalized' && <p style={{ fontSize: '0.8rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>Redactarea s-a terminat. Articolul așteaptă decizia de publicare a editorului.</p>}
                </div>
              )}

              <div className="detail-header">
                <div className="detail-breadcrumbs">
                  Domeniu: {selectedArticle.category} &raquo; {selectedArticle.subCategory}
                </div>
                <h2 className="detail-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {selectedArticle.title}
                  {currentUser.role === 'admin' && (
                    <button 
                      onClick={handleDeleteArticle} 
                      className="delete-article-btn"
                      title="Șterge Articolul definitiv"
                    >
                      Șterge Articol
                    </button>
                  )}
                </h2>
                <div className="detail-meta-text">
                  Publicat de: <strong>{selectedArticle.author.name}</strong> pe data de {selectedArticle.date} &bull; {selectedArticle.readingTime}
                </div>
              </div>

              {/* CSS Image Placeholder */}
              <div className="image-placeholder">
                <div className="placeholder-icon">[ Imagine Placeholder ]</div>
                <div className="placeholder-text">Reprezentare conceptuală: {selectedArticle.title}</div>
              </div>

              {/* Show Paragraphs */}
              <div className="article-body">
                {selectedArticle.paragraphs && selectedArticle.paragraphs.length > 0 ? (
                  selectedArticle.paragraphs.map((p, idx) => {
                    const pComments = (selectedArticle.editorialComments || []).filter(c => c.paragraphIdx === idx);
                    const isCommented = pComments.length > 0;
                    const canComment = currentUser.role === 'editor' && selectedArticle.status !== 'published';
                    const canDrag = currentUser.role === 'editor' && selectedArticle.editorId === currentUser.id && selectedArticle.status !== 'published';

                    return (
                      <div 
                        key={idx} 
                        className={`article-paragraph-wrapper ${isCommented ? 'has-comments' : ''}`}
                        draggable={canDrag}
                        onDragStart={(e) => {
                          if (!canDrag) return;
                          e.dataTransfer.setData("text/plain", idx.toString());
                          setDraggedIndex(idx);
                        }}
                        onDragOver={(e) => {
                          if (!canDrag) return;
                          e.preventDefault();
                          setDragOverIndex(idx);
                        }}
                        onDragLeave={() => {
                          if (!canDrag) return;
                          if (dragOverIndex === idx) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          if (!canDrag) return;
                          e.preventDefault();
                          const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                          if (!isNaN(fromIdx) && fromIdx !== idx) {
                            handleDropReorder(fromIdx, idx);
                          }
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggedIndex(null);
                          setDragOverIndex(null);
                        }}
                        style={{
                          position: 'relative',
                          padding: '0.8rem 1rem',
                          margin: '0.5rem -1rem',
                          borderRadius: '6px',
                          backgroundColor: draggedIndex === idx 
                            ? 'rgba(234, 179, 8, 0.1)' 
                            : (dragOverIndex === idx && draggedIndex !== idx 
                               ? 'rgba(234, 179, 8, 0.15)' 
                               : (isCommented ? 'rgba(234, 179, 8, 0.05)' : 'transparent')),
                          borderLeft: isCommented ? '4px solid var(--color-yellow)' : '4px solid transparent',
                          borderTop: (dragOverIndex === idx && draggedIndex !== idx) ? '2px solid var(--color-yellow)' : 'none',
                          borderBottom: (dragOverIndex === idx && draggedIndex !== idx) ? '2px solid var(--color-yellow)' : 'none',
                          opacity: draggedIndex === idx ? 0.5 : 1,
                          transition: 'all 0.2s ease',
                          cursor: canDrag ? (draggedIndex === idx ? 'grabbing' : 'grab') : (canComment ? 'pointer' : 'default'),
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem'
                        }}
                        title={canDrag ? "Trage pentru a reordona sau apasă pentru a adăuga un comentariu" : (canComment ? "Apasă pentru a adăuga un comentariu editorial" : "")}
                        onClick={() => {
                          if (canComment) {
                            setActiveCommentParagraphIdx(activeCommentParagraphIdx === idx ? null : idx);
                            setViewingCommentsIdx(null);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', gap: '1rem' }}>
                          {canDrag && (
                            <div 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                color: 'var(--text-muted)', 
                                paddingRight: '0.4rem',
                                cursor: draggedIndex === idx ? 'grabbing' : 'grab'
                              }}
                              title="Trage pentru a reordona paragraful"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical style={{ width: '16px', height: '16px' }} />
                            </div>
                          )}
                          <p style={{ margin: 0, flex: 1, lineHeight: '1.6' }}>{p}</p>
                          
                          {isCommented && (
                            <button 
                              className="paragraph-comments-indicator"
                              style={{
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                backgroundColor: 'var(--color-yellow)',
                                color: '#1e293b',
                                border: 'none',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                alignSelf: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setViewingCommentsIdx(viewingCommentsIdx === idx ? null : idx);
                                setActiveCommentParagraphIdx(null);
                              }}
                              title="Vezi comentariile"
                            >
                              <MessageSquare style={{ width: '12px', height: '12px' }} />
                              {pComments.length}
                            </button>
                          )}
                        </div>

                        {/* Inline form to add comment (Editor only) */}
                        {activeCommentParagraphIdx === idx && (
                          <div 
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.8rem',
                              backgroundColor: 'var(--bg-sidebar)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px'
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>
                                Adaugă comentariu editorial la acest paragraf:
                              </label>
                              <textarea
                                required
                                rows={2}
                                placeholder="Scrie feedback sau sugestii de corectură..."
                                value={editorialComment}
                                onChange={e => setEditorialComment(e.target.value)}
                                className="form-textarea"
                                style={{ width: '100%', fontSize: '0.85rem', padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                              />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setActiveCommentParagraphIdx(null);
                                  setEditorialComment("");
                                }}
                                className="submit-btn"
                                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                Anulează
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleAddParagraphComment(idx, editorialComment)}
                                className="submit-btn"
                                style={{ backgroundColor: 'var(--color-yellow)', color: '#1e293b', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                              >
                                Trimite Comentariu
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline comments list popover */}
                        {viewingCommentsIdx === idx && (
                          <div 
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.8rem',
                              backgroundColor: 'var(--bg-sidebar)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              fontSize: '0.85rem',
                              boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                            }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.3rem' }}>
                              <strong style={{ color: 'var(--color-yellow)' }}>Sugestii Editoriale ({pComments.length})</strong>
                              <button 
                                onClick={() => setViewingCommentsIdx(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                              >
                                Închide
                              </button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                              {pComments.map(c => (
                                <div key={c.id} style={{ borderLeft: '2px solid var(--color-yellow)', paddingLeft: '0.6rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <strong>{c.editorName}</strong>
                                    <span>{c.date}</span>
                                  </div>
                                  <div style={{ marginTop: '0.2rem', color: 'var(--text-primary)' }}>{c.commentText}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Niciun paragraf scris încă. Jurnaliștii asociați trebuie să adauge text.</p>
                )}
              </div>

              {/* Show bottom images if added by journalists */}
              {selectedArticle.articleImages && selectedArticle.articleImages.length > 0 && (
                <div className="journalist-bottom-images" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <h3>Imagini adăugate de jurnaliști</h3>
                  <div className="bottom-images-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                    {selectedArticle.articleImages.map((img, idx) => {
                      const isObj = typeof img === 'object' && img !== null;
                      const caption = isObj ? img.placeholder : img;
                      const data = isObj ? img.data : null;

                      return (
                        <div key={idx} className="bottom-image-card" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
                          {data ? (
                            <img src={data} alt={caption} style={{ width: '100%', height: '140px', objectFit: 'cover' }} />
                          ) : (
                            <div className="bottom-image-placeholder" style={{ height: '140px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-sidebar)', color: 'var(--text-secondary)', padding: '1rem', textAlign: 'center', gap: '0.5rem' }}>
                              <Image style={{ width: '32px', height: '32px', color: 'var(--color-teal)' }} />
                              <span style={{ fontSize: '0.8rem' }}>[Placeholder Legat]</span>
                            </div>
                          )}
                          {caption && (
                            <div className="bottom-image-caption" style={{ padding: '0.6rem', fontSize: '0.85rem', color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-sidebar)' }}>
                              {caption}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Like/Dislike reactions widget */}
              <div 
                className="reactions-container"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}
              >
                <button 
                  onClick={() => handleReact('like')} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: selectedArticle.userReaction === 'like' ? 'rgba(20, 184, 166, 0.15)' : 'var(--bg-card)',
                    color: selectedArticle.userReaction === 'like' ? 'var(--color-teal)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                  title="Apreciază articolul"
                >
                  <ThumbsUp style={{ width: '14px', height: '14px' }} />
                  <span>Susține ({selectedArticle.likes || 0})</span>
                </button>
                <button 
                  onClick={() => handleReact('dislike')} 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: selectedArticle.userReaction === 'dislike' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-card)',
                    color: selectedArticle.userReaction === 'dislike' ? 'var(--color-red)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                  title="Dezapreciază articolul"
                >
                  <ThumbsDown style={{ width: '14px', height: '14px' }} />
                  <span>Contestă ({selectedArticle.dislikes || 0})</span>
                </button>
              </div>

              {/* Abstract & Metrics (Only if published) */}
              {selectedArticle.status === 'published' ? (
                <>
                  <div className="abstract-box">
                    <strong>Rezumat / Abstract:</strong> {selectedArticle.abstract}
                  </div>
                  <div className="simplified-metrics">
                    <h3>Parametrii Articolului</h3>
                    <ul>
                      <li><strong>Coeficient Transpirație:</strong> {selectedArticle.metrics.coefficient}</li>
                      <li><strong>Intensitate Somatică:</strong> {selectedArticle.metrics.somatic}%</li>
                      <li><strong>Index Căldură Academică:</strong> {selectedArticle.metrics.academicHeat}/10</li>
                    </ul>
                  </div>
                </>
              ) : null}



              {/* Journalist Edit Actions (Only for assigned journalist and status 'pending') */}
              {currentUser.role === 'journalist' && 
               selectedArticle.status === 'pending' && 
               selectedArticle.assignedJournalistIds.includes(currentUser.username || '') || (articles.find(a => a.id === selectedId)?.author.name.includes(currentUser.username)) ? (
                <div className="journalist-actions-box">
                  <h3>Panou de Editare Jurnalist</h3>
                  
                  {/* Add Paragraph Form */}
                  <form onSubmit={handleAddParagraph} className="collaboration-sub-form">
                    <div className="form-group">
                      <label>Scrie un paragraf nou:</label>
                      <textarea
                        required
                        placeholder="Adaugă un paragraf text la articol..."
                        value={newParagraph}
                        onChange={e => setNewParagraph(e.target.value)}
                        className="form-textarea"
                      />
                    </div>
                    <button type="submit" className="submit-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FileText style={{ width: '14px', height: '14px' }} /> Adaugă Paragraf
                    </button>
                  </form>

                  {/* Add Image Form */}
                  <form onSubmit={handleAddImagePlaceholder} className="collaboration-sub-form">
                    <div className="form-group">
                      <label>Încarcă imagine de pe calculator:</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="form-input"
                        style={{ padding: '0.4rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label>Legendă / Descriere imagine:</label>
                      <input
                        type="text"
                        placeholder="Ex: Grafic corelație efort fizic vs intelectual..."
                        value={newImagePlaceholder}
                        onChange={e => setNewImagePlaceholder(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    {uploadedImageBase64 && (
                      <div className="image-upload-preview" style={{ margin: '0.5rem 0', padding: '0.5rem', border: '1px dashed var(--border-color)', borderRadius: '4px', textAlign: 'center' }}>
                        <img src={uploadedImageBase64} alt="Preview" style={{ maxHeight: '100px', maxWidth: '100%', borderRadius: '4px' }} />
                      </div>
                    )}
                    <button type="submit" className="submit-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Image style={{ width: '14px', height: '14px' }} /> Adaugă Imagine
                    </button>
                  </form>

                  {/* Finalize Button */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleFinalize} className="finalize-btn">
                      <CheckCircle style={{ width: '16px', height: '16px' }} />
                      Finalizează redactarea articolului
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Editor Review & Publish Actions (Only for editor, and status 'finalized') */}
              {currentUser.role === 'editor' && selectedArticle.status === 'finalized' && (
                <div className="editor-actions-box">
                  <h3>Panou Decizie Publicare (Editor)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Jurnaliștii au marcat acest articol ca fiind complet. Revizuiește-l și, dacă totul este în regulă, apasă butonul pentru a-l face public.
                  </p>
                  <button onClick={handlePublish} className="publish-btn">
                    <CheckCircle style={{ width: '18px', height: '18px' }} />
                    Publică Articolul Acum
                  </button>
                </div>
              )}

              {/* Citations List (Only if published) */}
              {selectedArticle.status === 'published' && selectedArticle.citations && selectedArticle.citations.length > 0 && (
                <div className="citations-list-box">
                  <h3>Referințe Bibliografice</h3>
                  <ol>
                    {selectedArticle.citations.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Peer Reviews Board (Only if published) */}
              {selectedArticle.status === 'published' && (
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
              )}

            </div>
          ) : (
            <div className="empty-state">
              <BookOpen className="empty-state-logo" />
              <p>Selectează un articol din stânga pentru a-l citi...</p>
            </div>
          )}
        </section>
          </>
        )}
      </main>
    </div>
  );
}

function AdminStatsDashboard({ currentUser }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/stats?username=${currentUser.username}`)
      .then(res => {
        if (!res.ok) {
          return res.json().then(err => { throw new Error(err.error || "Failed to fetch stats"); });
        }
        return res.json();
      })
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [currentUser]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', width: '100%' }}>
        <div className="placeholder-icon animate-pulse" style={{ color: 'var(--color-teal)' }}>[ Se încarcă datele... ]</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Se preiau statisticile agregate din baza de date...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', width: '100%', color: 'rgba(239, 68, 68, 0.8)' }}>
        <p>Eroare: {error}</p>
      </div>
    );
  }

  const {
    totalArticles,
    statusBreakdown,
    categoryBreakdown,
    totalComments,
    totalReviews,
    totalLikes,
    totalDislikes,
    journalistRankings,
    averages
  } = stats;

  return (
    <div className="stats-dashboard" style={{ padding: '2rem', width: '100%', overflowY: 'auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Title */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#fff', marginBottom: '0.3rem' }}>Panou de Control Statistici</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Vizualizare în timp real a datelor agregate din jurnalul Epidermis.</p>
      </div>

      {/* Grid of Key Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Total Articles Card */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ backgroundColor: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-teal)', padding: '0.75rem', borderRadius: '50%' }}>
            <BookOpen style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Articole</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '0.2rem' }}>{totalArticles}</div>
          </div>
        </div>

        {/* Total Comments Card */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--color-yellow)', padding: '0.75rem', borderRadius: '50%' }}>
            <MessageSquare style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Comentarii Editoriale</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '0.2rem' }}>{totalComments}</div>
          </div>
        </div>

        {/* Total Reviews Card */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.75rem', borderRadius: '50%' }}>
            <CheckCircle style={{ width: '24px', height: '24px' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Recenzii Peer-Review</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', marginTop: '0.2rem' }}>{totalReviews}</div>
          </div>
        </div>

        {/* Likes / Dislikes Ratio Card */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ backgroundColor: 'rgba(20, 184, 166, 0.05)', color: 'var(--color-teal)', padding: '0.75rem', borderRadius: '50%', display: 'flex', gap: '0.2rem' }}>
            <ThumbsUp style={{ width: '16px', height: '16px' }} />
            <ThumbsDown style={{ width: '16px', height: '16px', color: '#ef4444' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Reacții Cititori</div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-teal)' }}>+{totalLikes}</span>
              <span style={{ fontSize: '1.1rem', color: '#ef4444' }}>-{totalDislikes}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Breakdown Panels Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Status Breakdown Panel */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Distribuție pe Stări</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Progres Drafturi</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {['started', 'pending', 'finalized', 'published'].map(status => {
              const count = statusBreakdown[status] || 0;
              const percentage = totalArticles > 0 ? ((count / totalArticles) * 100).toFixed(0) : 0;
              
              let barColor = 'var(--text-muted)';
              let label = status.toUpperCase();
              if (status === 'started') { barColor = '#64748b'; label = 'Draft (started)'; }
              else if (status === 'pending') { barColor = '#3b82f6'; label = 'În lucru (pending)'; }
              else if (status === 'finalized') { barColor = 'var(--color-yellow)'; label = 'Finalizat (finalized)'; }
              else if (status === 'published') { barColor = 'var(--color-teal)'; label = 'Publicat (published)'; }

              return (
                <div key={status} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: '500' }}>{label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count} ({percentage}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown Panel */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Domenii științifice</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Categorii active</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {["Thermodynamics", "Philosophy", "Economics", "Psychology", "Draft"].map(cat => {
              const count = categoryBreakdown[cat] || 0;
              const percentage = totalArticles > 0 ? ((count / totalArticles) * 100).toFixed(0) : 0;
              
              let barColor = 'var(--color-accent)';
              if (cat === 'Draft') barColor = 'var(--text-muted)';

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: '500' }}>{cat}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{count} ({percentage}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', backgroundColor: barColor, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Rankings and Academic Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
        
        {/* Journalist Ranking Panel */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Clasament Jurnaliști (Activitate)
          </h3>
          {journalistRankings.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
              Niciun jurnalist cu articole alocate în sistem.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Jurnalist</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Articole Alocate</th>
                  </tr>
                </thead>
                <tbody>
                  {journalistRankings.map((ranking, index) => (
                    <tr key={ranking.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.6rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: index === 0 ? 'var(--color-yellow)' : 'var(--bg-primary)', color: index === 0 ? '#0b0f19' : 'var(--text-secondary)', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {index + 1}
                        </span>
                        <strong>{ranking.name}</strong>
                      </td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--color-teal)' }}>
                        {ranking.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Academic Metrics averages */}
        <div style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Medii Performanță Academică (Articole Publicate)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', height: '100%', alignItems: 'center', padding: '0.5rem 0' }}>
            
            {/* Somatic Intensity avg */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-teal)' }}>{averages.somatic}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Intensitate Somatică</div>
            </div>

            {/* Academic Heat avg */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-yellow)' }}>{averages.academicHeat}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Căldură Academică</div>
            </div>

            {/* Coefficient avg */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{averages.coefficient}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Coeficient</div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

export default App;
