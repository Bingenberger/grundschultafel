import React, { useState, useEffect } from 'react';
import { Search, X, Youtube, AlertCircle } from 'lucide-react';

interface YoutubeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
}

export default function YoutubeModal({ isOpen, onClose, onSelectVideo }: YoutubeModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract video ID from pasted URL
  const extractVideoId = (urlOrQuery: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = urlOrQuery.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Check if it's a direct URL
    const videoId = extractVideoId(query);
    if (videoId) {
      onSelectVideo(videoId);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      
      setResults(data.items || []);
    } catch (err: any) {
      console.error(err);
      setError('Fehler bei der Suche nach Videos.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div data-youtube-modal="true" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: '24px', display: 'flex', flexDirection: 'column',
        width: '90vw', maxWidth: '800px', height: '80vh', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)',
        margin: 'auto'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Youtube size={32} color="#ff0000" />
            <h2 style={{ margin: 0, color: 'var(--foreground)' }}>YouTube Video einfügen</h2>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'var(--background)', border: 'none', cursor: 'pointer', 
              color: 'var(--foreground)', padding: '8px', borderRadius: '50%'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: 'var(--background)' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="YouTube-Link einfügen oder Suchbegriff eingeben..." 
                style={{ 
                  width: '100%', padding: '15px 15px 15px 50px', 
                  borderRadius: '12px', border: '1px solid var(--border)', 
                  fontSize: '1.1rem', background: 'var(--surface)', color: 'var(--foreground)'
                }}
              />
              <Search size={24} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--border)' }} />
            </div>
            <button 
              type="submit"
              disabled={loading}
              style={{ 
                padding: '0 30px', borderRadius: '12px', border: 'none', 
                background: 'var(--primary)', color: 'white', fontSize: '1.1rem', 
                fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Sucht...' : 'Suchen'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: 'var(--background)' }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', padding: '20px', background: '#fee2e2', borderRadius: '12px' }}>
              <AlertCircle size={24} /> <span>{error}</span>
            </div>
          )}
          
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' 
          }}>
            {results.map((video, index) => (
              <div 
                key={video.id?.videoId || `result-${index}`}
                onClick={() => {
                  if (video.id?.videoId) {
                    onSelectVideo(video.id.videoId);
                  }
                }}
                style={{ 
                  background: 'var(--surface)', borderRadius: '16px', overflow: 'hidden', 
                  cursor: 'pointer', border: '1px solid var(--border)', transition: 'transform 0.2s',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <img 
                  src={video.snippet.thumbnails.medium.url} 
                  alt={video.snippet.title} 
                  style={{ width: '100%', height: '140px', objectFit: 'cover' }}
                />
                <div style={{ padding: '15px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: 'var(--foreground)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.snippet.title}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {video.snippet.channelTitle}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {results.length === 0 && !loading && !error && query && (
             <div style={{ textAlign: 'center', padding: '40px', color: 'var(--border)' }}>
               Keine Ergebnisse für "{query}" gefunden.
             </div>
          )}
        </div>

      </div>
    </div>
  );
}
