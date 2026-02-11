const BASE = 'http://localhost:5000/api';

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };

  // Add JWT token if available
  const token = localStorage.getItem('token');
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Authentication ────────────────────────────────────────────────────────────
export const authApi = {
  login: (credentials) => api('POST', '/auth/login', credentials),
  register: (userData) => api('POST', '/auth/register', userData),
  me: () => api('GET', '/auth/me'),
};

// ── MongoDB CRUD ──────────────────────────────────────────────────────────────
export const mongoApi = {
  // Users
  getUsers: () => api('GET', '/users'),
  getUser: (id) => api('GET', `/users/${id}`),
  createUser: (d) => api('POST', '/users', d),
  updateUser: (id, d) => api('PUT', `/users/${id}`, d),
  deleteUser: (id) => api('DELETE', `/users/${id}`),
  followUser: (id) => api('POST', `/users/${id}/follow`),
  unfollowUser: (id) => api('DELETE', `/users/${id}/follow`),

  // Artists
  getArtists: (genre) => api('GET', '/artists' + (genre ? `?genre=${genre}` : '')),
  getArtist: (id) => api('GET', `/artists/${id}`),
  createArtist: (d) => api('POST', '/artists', d),
  updateArtist: (id, d) => api('PUT', `/artists/${id}`, d),
  deleteArtist: (id) => api('DELETE', `/artists/${id}`),

  // Albums
  getAlbums: (artistId) => api('GET', '/albums' + (artistId ? `?artistId=${artistId}` : '')),
  getAlbum: (id) => api('GET', `/albums/${id}`),
  createAlbum: (d) => api('POST', '/albums', d),
  updateAlbum: (id, d) => api('PUT', `/albums/${id}`, d),
  deleteAlbum: (id) => api('DELETE', `/albums/${id}`),

  // Tracks
  getTracks: (filters) => {
    const qs = new URLSearchParams(filters || {}).toString();
    return api('GET', '/tracks' + (qs ? `?${qs}` : ''));
  },
  getTrack: (id) => api('GET', `/tracks/${id}`),
  createTrack: (d) => api('POST', '/tracks', d),
  updateTrack: (id, d) => api('PUT', `/tracks/${id}`, d),
  deleteTrack: (id) => api('DELETE', `/tracks/${id}`),

  // Playlists
  getPlaylists: (scope = 'mine') => api('GET', '/playlists' + (scope ? `?scope=${scope}` : '')),
  getFollowingPlaylists: () => api('GET', '/playlists/following/all'),
  getDiscoverPlaylists: () => api('GET', '/playlists/discover/all'),
  getPlaylist: (id) => api('GET', `/playlists/${id}`),
  createPlaylist: (d) => api('POST', '/playlists', d),
  updatePlaylist: (id, d) => api('PUT', `/playlists/${id}`, d),
  deletePlaylist: (id) => api('DELETE', `/playlists/${id}`),
  getAggregatedPlaylist: (id) => api('GET', `/playlists/aggregated/${id}`),
  getGenreStats: () => api('GET', '/playlists/stats/genres'),
};

// ── Neo4j ─────────────────────────────────────────────────────────────────────
export const neo4jApi = {
  getUsers: () => api('GET', '/neo4j/users'),
  createUser: (d) => api('POST', '/neo4j/users', d),
  deleteUser: (id) => api('DELETE', `/neo4j/users/${id}`),

  getArtists: () => api('GET', '/neo4j/artists'),
  createArtist: (d) => api('POST', '/neo4j/artists', d),
  deleteArtist: (id) => api('DELETE', `/neo4j/artists/${id}`),

  getTracks: () => api('GET', '/neo4j/tracks'),
  createTrack: (d) => api('POST', '/neo4j/tracks', d),
  deleteTrack: (id) => api('DELETE', `/neo4j/tracks/${id}`),

  addLike: (d) => api('POST', '/neo4j/likes', d),
  removeLike: (uid, tid) => api('DELETE', `/neo4j/likes/${uid}/${tid}`),
  addSimilar: (d) => api('POST', '/neo4j/similar', d),

  queryArtistTracks: (id) => api('GET', `/neo4j/query/artist-tracks/${id}`),
  querySimilar: (id) => api('GET', `/neo4j/query/similar/${id}`),
  queryUserLikes: (id) => api('GET', `/neo4j/query/user-likes/${id}`),
  queryUserLikedAlbums: (id) => api('GET', `/neo4j/query/user-liked-albums/${id}`),
  queryAllLikes: () => api('GET', '/neo4j/query/all-likes'),

  // Albums
  createAlbum: (d) => api('POST', '/neo4j/albums', d),
  deleteAlbum: (id) => api('DELETE', `/neo4j/albums/${id}`),
  addAlbumLike: (d) => api('POST', '/neo4j/likes/album', d), // d = { userId, albumId }
  removeAlbumLike: (uid, aid) => api('DELETE', `/neo4j/likes/album/${uid}/${aid}`),
};

// ── Integration ───────────────────────────────────────────────────────────────
export const integrationApi = {
  getRecommendations: (userId) => api('GET', `/integration/recommendations/${userId}`),
};
