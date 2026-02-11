import React, { useState, useEffect } from 'react';
import { mongoApi, integrationApi, neo4jApi } from '../api';
import { useAuth } from '../AuthContext';

export default function Recommend() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState(null);
  const [popularTracks, setPopularTracks] = useState([]);
  const [activeTab, setActiveTab] = useState('recommendations'); // 'recommendations' | 'popular'
  const [loading, setLoading] = useState(false);
  const [artists, setArtists] = useState([]);

  useEffect(() => {
    if (user) {
      loadArtists();
      loadRecommendations();
    }
  }, [user]);

  const loadArtists = async () => {
    try {
      const a = await mongoApi.getArtists();
      setArtists(a);
    } catch (e) {
      console.error(e);
    }
  };

  const loadRecommendations = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const result = await integrationApi.getRecommendations(user.userId);
      setRecommendations(result);
    } catch (e) {
      console.error('Error loading recommendations:', e);
      setRecommendations({ recommendations: [], message: 'Fehler beim Laden der Empfehlungen' });
    } finally {
      setLoading(false);
    }
  };

  const loadPopularTracks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get all liked tracks with counts
      const allLikes = await neo4jApi.queryAllLikes();

      // Get current user's likes to filter them out
      const myLikes = await neo4jApi.queryUserLikes(user.userId);

      // Filter out tracks the user already likes
      const othersLikes = allLikes.filter(like => !myLikes.includes(like.trackId));

      // Get track details from MongoDB
      const allTracks = await mongoApi.getTracks();
      const tracksWithLikes = othersLikes.map(like => {
        const track = allTracks.find(t => t.trackId === like.trackId);
        return { ...track, likeCount: like.likeCount };
      }).filter(t => t.trackId); // Filter out any tracks not found

      setPopularTracks(tracksWithLikes);
    } catch (e) {
      console.error('Error loading popular tracks:', e);
    } finally {
      setLoading(false);
    }
  };

  // Load appropriate data when switching tabs
  useEffect(() => {
    if (activeTab === 'popular' && popularTracks.length === 0) {
      loadPopularTracks();
    }
  }, [activeTab]);

  const artistName = (id) => (artists.find(a => a.artistId === id) || {}).name || id;
  const fmtDur = (s) => s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '–';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>✨ Empfehlungen</h1>
          <span className="subtitle">Entdecke neue Musik basierend auf deinen Likes und was andere hören</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('recommendations')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'recommendations' ? 'var(--accent-lo)' : 'transparent',
            color: activeTab === 'recommendations' ? 'var(--accent)' : 'var(--text-md)',
            border: 'none',
            borderBottom: activeTab === 'recommendations' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          🎯 Für dich
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'popular' ? 'var(--accent-lo)' : 'transparent',
            color: activeTab === 'popular' ? 'var(--accent)' : 'var(--text-md)',
            border: 'none',
            borderBottom: activeTab === 'popular' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          👥 Von anderen gelikt
        </button>
      </div>

      {/* TAB: FÜR DICH (Personalized Recommendations) */}
      {activeTab === 'recommendations' && (
        <div>
          {/* Erklärung */}
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,rgba(124,58,237,0.07),rgba(236,72,153,0.07))', borderColor: 'var(--accent-md)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 28 }}>🎯</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Personalisierte Empfehlungen</div>
                <div className="text-sm text-md">
                  Basierend auf den Moods deiner gelikten Tracks. Tracks mit ähnlichen Stimmungen werden dir empfohlen.
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-lo)' }}>
              Lädt Empfehlungen...
            </div>
          ) : recommendations ? (
            <div>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span className="info-badge">📦 {recommendations.recommendations?.length || 0} Empfehlung(en)</span>
                {recommendations.algorithm && <span className="tag tag-pink">{recommendations.algorithm}</span>}
              </div>

              {!recommendations.recommendations || recommendations.recommendations.length === 0
                ? <div className="card">
                  <span className="text-lo">{recommendations.message || 'Keine Empfehlungen verfügbar. Like Tracks im Graph-Abschnitt!'}</span>
                </div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                  {recommendations.recommendations.map((t, i) => (
                    <div key={i} className="rec-card">
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.title}</div>
                      <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
                        <span className="tag">{t.genre}</span>
                        {Array.isArray(t.mood) && t.mood.map((m, idx) => (
                          <span key={idx} className="tag tag-pink">{m}</span>
                        ))}
                      </div>
                      <div className="text-sm text-lo">
                        <div>🎤 {artistName(t.artistId)}</div>
                        <div>⏱ {fmtDur(t.duration_sec)}</div>
                        {t.sharedMoods && <div style={{ marginTop: 4, color: 'var(--accent)', fontSize: 12 }}>✨ {t.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          ) : null}
        </div>
      )}

      {/* TAB: VON ANDEREN GELIKT (Popular Tracks) */}
      {activeTab === 'popular' && (
        <div>
          {/* Erklärung */}
          <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(16,185,129,0.07))', borderColor: 'var(--accent-md)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 28 }}>👥</span>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 3 }}>Von anderen gelikt</div>
                <div className="text-sm text-md">
                  Entdecke Tracks, die andere Nutzer mögen. Sortiert nach Beliebtheit (Anzahl der Likes).
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--text-lo)' }}>
              Lädt beliebte Tracks...
            </div>
          ) : popularTracks.length === 0 ? (
            <div className="card">
              <span className="text-lo">Noch keine Tracks von anderen Nutzern gelikt</span>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span className="info-badge">🔥 {popularTracks.length} beliebte Tracks</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {popularTracks.map((t, i) => (
                  <div key={i} className="rec-card">
                    <div className="flex items-center justify-between mb-2">
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{t.title}</div>
                      <span style={{ background: 'var(--accent-lo)', color: 'var(--accent)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
                        ❤️ {t.likeCount}
                      </span>
                    </div>
                    <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
                      <span className="tag">{t.genre}</span>
                      {Array.isArray(t.mood) && t.mood.map((m, idx) => (
                        <span key={idx} className="tag tag-pink">{m}</span>
                      ))}
                    </div>
                    <div className="text-sm text-lo">
                      <div>🎤 {artistName(t.artistId)}</div>
                      <div>⏱ {fmtDur(t.duration_sec)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
