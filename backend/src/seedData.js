const bcrypt = require('bcryptjs');

// Admin User
const adminUser = {
    userId: 'user_admin',
    name: 'Admin',
    email: 'admin@melodygraph.com',
    password: '$2b$10$w1fY6ADhU3rDTuMGeaCWxux99OhlNfZ3aAosZkrCo/ZfgVjZ.2Ire',
    role: 'admin',
    isActive: true,
    favoriteGenres: ['Pop', 'Rock', 'Electronic'],
    preferredMoods: ['Energetic', 'Happy', 'Uplifting'],
    following: ['user_001', 'user_003', 'user_005'],
    createdAt: new Date()
};

// Users
const users = [
    { userId: 'user_001', name: 'Anna Schmidt', email: 'anna@example.com', password: '$2b$10$HXbuBy5FJXyCfrKTZqh8GeHQszAp1dJX5FmM25S8j5EK9tIVJu3uq', role: 'user', isActive: true, favoriteGenres: ['Rock', 'Pop'], preferredMoods: ['Happy', 'Energetic', 'Uplifting'], following: ['user_002', 'user_003'], createdAt: new Date() },
    { userId: 'user_002', name: 'Ben Mueller', email: 'ben@example.com', password: '$2b$10$HXbuBy5FJXyCfrKTZqh8GeHQszAp1dJX5FmM25S8j5EK9tIVJu3uq', role: 'user', isActive: true, favoriteGenres: ['Hip-Hop', 'R&B'], preferredMoods: ['Calm', 'Smooth', 'Chill'], following: ['user_001', 'user_004'], createdAt: new Date() },
    { userId: 'user_003', name: 'Clara Weber', email: 'clara@example.com', password: '$2b$10$HXbuBy5FJXyCfrKTZqh8GeHQszAp1dJX5FmM25S8j5EK9tIVJu3uq', role: 'user', isActive: true, favoriteGenres: ['Pop', 'Dance'], preferredMoods: ['Energetic', 'Happy', 'Uplifting'], following: ['user_001'], createdAt: new Date() },
    { userId: 'user_004', name: 'David Fischer', email: 'david@example.com', password: '$2b$10$HXbuBy5FJXyCfrKTZqh8GeHQszAp1dJX5FmM25S8j5EK9tIVJu3uq', role: 'user', isActive: true, favoriteGenres: ['Rock', 'Alternative'], preferredMoods: ['Intense', 'Dark', 'Melancholic'], following: ['user_002', 'user_005'], createdAt: new Date() },
    { userId: 'user_005', name: 'Emma Wagner', email: 'emma@example.com', password: '$2b$10$HXbuBy5FJXyCfrKTZqh8GeHQszAp1dJX5FmM25S8j5EK9tIVJu3uq', role: 'user', isActive: true, favoriteGenres: ['Electronic', 'Dance'], preferredMoods: ['Energetic', 'Uplifting', 'Happy'], following: ['user_001', 'user_003'], createdAt: new Date() },
];

// Artists (Updated with origin and formedYear)
const artists = [
    { artistId: 'art_001', name: 'Michael Jackson', genre: 'Pop', bio: 'King of Pop', origin: 'Gary, Indiana, USA', formedYear: 1964, createdBy: 'user_001', createdAt: new Date() },
    { artistId: 'art_002', name: 'Queen', genre: 'Rock', bio: 'British rock legends', origin: 'London, UK', formedYear: 1970, createdBy: 'user_001', createdAt: new Date() },
    { artistId: 'art_003', name: 'Madonna', genre: 'Pop', bio: 'Queen of Pop', origin: 'Bay City, Michigan, USA', formedYear: 1979, createdBy: 'user_003', createdAt: new Date() },
    { artistId: 'art_004', name: 'Nirvana', genre: 'Grunge', bio: 'Grunge pioneers from Seattle', origin: 'Aberdeen, Washington, USA', formedYear: 1987, createdBy: 'user_004', createdAt: new Date() },
    { artistId: 'art_005', name: 'Whitney Houston', genre: 'R&B', bio: 'Legendary vocalist', origin: 'Newark, New Jersey, USA', formedYear: 1977, createdBy: 'user_002', createdAt: new Date() },
    { artistId: 'art_006', name: 'Guns N\' Roses', genre: 'Rock', bio: 'Hard rock from LA', origin: 'Los Angeles, USA', formedYear: 1985, createdBy: 'user_004', createdAt: new Date() },
    { artistId: 'art_007', name: 'Britney Spears', genre: 'Pop', bio: 'Pop princess', origin: 'McComb, Mississippi, USA', formedYear: 1992, createdBy: 'user_003', createdAt: new Date() },
    { artistId: 'art_008', name: 'Eminem', genre: 'Hip-Hop', bio: 'Rap legend from Detroit', origin: 'St. Joseph, Missouri, USA', formedYear: 1988, createdBy: 'user_002', createdAt: new Date() },
    { artistId: 'art_009', name: 'The Cure', genre: 'Alternative', bio: 'Gothic rock pioneers', origin: 'Crawley, UK', formedYear: 1976, createdBy: 'user_004', createdAt: new Date() },
    { artistId: 'art_010', name: 'Daft Punk', genre: 'Electronic', bio: 'French electronic duo', origin: 'Paris, France', formedYear: 1993, createdBy: 'user_005', createdAt: new Date() },
    { artistId: 'art_011', name: 'The Beatles', genre: 'Rock', bio: 'The Fab Four from Liverpool', origin: 'Liverpool, UK', formedYear: 1960, createdBy: 'user_admin', createdAt: new Date() },
    { artistId: 'art_012', name: 'David Bowie', genre: 'Rock', bio: 'Iconic innovator', origin: 'London, UK', formedYear: 1962, createdBy: 'user_admin', createdAt: new Date() }
];

// Albums (Updated with trackCount and duration_min)
const albums = [
    { albumId: 'alb_001', artistId: 'art_001', title: 'Thriller', releaseYear: 1982, genre: 'Pop', trackCount: 9, duration_min: 42, createdBy: 'user_001', createdAt: new Date() },
    { albumId: 'alb_002', artistId: 'art_002', title: 'A Night at the Opera', releaseYear: 1975, genre: 'Rock', trackCount: 12, duration_min: 43, createdBy: 'user_001', createdAt: new Date() },
    { albumId: 'alb_003', artistId: 'art_003', title: 'Like a Virgin', releaseYear: 1984, genre: 'Pop', trackCount: 9, duration_min: 35, createdBy: 'user_003', createdAt: new Date() },
    { albumId: 'alb_004', artistId: 'art_004', title: 'Nevermind', releaseYear: 1991, genre: 'Grunge', trackCount: 13, duration_min: 42, createdBy: 'user_004', createdAt: new Date() },
    { albumId: 'alb_005', artistId: 'art_005', title: 'The Bodyguard Soundtrack', releaseYear: 1992, genre: 'R&B', trackCount: 13, duration_min: 57, createdBy: 'user_002', createdAt: new Date() },
    { albumId: 'alb_006', artistId: 'art_006', title: 'Appetite for Destruction', releaseYear: 1987, genre: 'Rock', trackCount: 12, duration_min: 53, createdBy: 'user_004', createdAt: new Date() },
    { albumId: 'alb_007', artistId: 'art_007', title: '...Baby One More Time', releaseYear: 1999, genre: 'Pop', trackCount: 11, duration_min: 42, createdBy: 'user_003', createdAt: new Date() },
    { albumId: 'alb_008', artistId: 'art_008', title: 'The Marshall Mathers LP', releaseYear: 2000, genre: 'Hip-Hop', trackCount: 18, duration_min: 72, createdBy: 'user_002', createdAt: new Date() },
    { albumId: 'alb_009', artistId: 'art_011', title: 'Abbey Road', releaseYear: 1969, genre: 'Rock', trackCount: 17, duration_min: 47, createdBy: 'user_admin', createdAt: new Date() },
    { albumId: 'alb_010', artistId: 'art_012', title: 'Heroes', releaseYear: 1977, genre: 'Rock', trackCount: 10, duration_min: 40, createdBy: 'user_admin', createdAt: new Date() }
];

// Tracks
const tracks = [
    { trackId: 'trk_001', albumId: 'alb_001', artistId: 'art_001', title: 'Billie Jean', duration_sec: 294, genre: 'Pop', mood: ['Energetic', 'Mysterious', 'Dark'], createdBy: 'user_001', createdAt: new Date() },
    { trackId: 'trk_002', albumId: 'alb_001', artistId: 'art_001', title: 'Beat It', duration_sec: 258, genre: 'Pop', mood: ['Energetic', 'Aggressive', 'Intense'], createdBy: 'user_001', createdAt: new Date() },
    { trackId: 'trk_003', albumId: 'alb_001', artistId: 'art_001', title: 'Thriller', duration_sec: 357, genre: 'Pop', mood: ['Dark', 'Mysterious', 'Intense'], createdBy: 'user_001', createdAt: new Date() },
    { trackId: 'trk_004', albumId: 'alb_002', artistId: 'art_002', title: 'Bohemian Rhapsody', duration_sec: 354, genre: 'Rock', mood: ['Dramatic', 'Intense', 'Epic'], createdBy: 'user_001', createdAt: new Date() },
    { trackId: 'trk_005', albumId: 'alb_002', artistId: 'art_002', title: 'Love of My Life', duration_sec: 213, genre: 'Rock', mood: ['Romantic', 'Melancholic', 'Peaceful'], createdBy: 'user_001', createdAt: new Date() },
    { trackId: 'trk_006', albumId: 'alb_003', artistId: 'art_003', title: 'Like a Virgin', duration_sec: 219, genre: 'Pop', mood: ['Happy', 'Energetic', 'Uplifting'], createdBy: 'user_003', createdAt: new Date() },
    { trackId: 'trk_007', albumId: 'alb_003', artistId: 'art_003', title: 'Material Girl', duration_sec: 240, genre: 'Pop', mood: ['Happy', 'Energetic'], createdBy: 'user_003', createdAt: new Date() },
    { trackId: 'trk_008', albumId: 'alb_004', artistId: 'art_004', title: 'Smells Like Teen Spirit', duration_sec: 301, genre: 'Grunge', mood: ['Aggressive', 'Intense', 'Rebellious'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_009', albumId: 'alb_004', artistId: 'art_004', title: 'Come as You Are', duration_sec: 219, genre: 'Grunge', mood: ['Dark', 'Melancholic', 'Calm'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_010', albumId: 'alb_004', artistId: 'art_004', title: 'Lithium', duration_sec: 257, genre: 'Grunge', mood: ['Intense', 'Melancholic'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_011', albumId: 'alb_005', artistId: 'art_005', title: 'I Will Always Love You', duration_sec: 273, genre: 'R&B', mood: ['Romantic', 'Melancholic', 'Powerful'], createdBy: 'user_002', createdAt: new Date() },
    { trackId: 'trk_012', albumId: 'alb_005', artistId: 'art_005', title: 'I Have Nothing', duration_sec: 280, genre: 'R&B', mood: ['Romantic', 'Powerful', 'Emotional'], createdBy: 'user_002', createdAt: new Date() },
    { trackId: 'trk_013', albumId: 'alb_006', artistId: 'art_006', title: 'Sweet Child O\' Mine', duration_sec: 356, genre: 'Rock', mood: ['Energetic', 'Romantic', 'Intense'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_014', albumId: 'alb_006', artistId: 'art_006', title: 'Welcome to the Jungle', duration_sec: 273, genre: 'Rock', mood: ['Aggressive', 'Intense', 'Energetic'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_015', albumId: 'alb_007', artistId: 'art_007', title: '...Baby One More Time', duration_sec: 210, genre: 'Pop', mood: ['Energetic', 'Happy', 'Catchy'], createdBy: 'user_003', createdAt: new Date() },
    { trackId: 'trk_016', albumId: 'alb_007', artistId: 'art_007', title: '(You Drive Me) Crazy', duration_sec: 195, genre: 'Pop', mood: ['Energetic', 'Happy'], createdBy: 'user_003', createdAt: new Date() },
    { trackId: 'trk_017', albumId: 'alb_008', artistId: 'art_008', title: 'The Real Slim Shady', duration_sec: 284, genre: 'Hip-Hop', mood: ['Aggressive', 'Intense', 'Rebellious'], createdBy: 'user_002', createdAt: new Date() },
    { trackId: 'trk_018', albumId: 'alb_008', artistId: 'art_008', title: 'Stan', duration_sec: 404, genre: 'Hip-Hop', mood: ['Dark', 'Melancholic', 'Intense'], createdBy: 'user_002', createdAt: new Date() },
    { trackId: 'trk_019', albumId: null, artistId: 'art_009', title: 'Just Like Heaven', duration_sec: 212, genre: 'Alternative', mood: ['Dreamy', 'Uplifting', 'Romantic'], createdBy: 'user_004', createdAt: new Date() },
    { trackId: 'trk_020', albumId: null, artistId: 'art_010', title: 'One More Time', duration_sec: 320, genre: 'Electronic', mood: ['Energetic', 'Happy', 'Uplifting'], createdBy: 'user_005', createdAt: new Date() },
    { trackId: 'trk_021', albumId: 'alb_009', artistId: 'art_011', title: 'Come Together', duration_sec: 259, genre: 'Rock', mood: ['Chill', 'Cool', 'Classic'], createdBy: 'user_admin', createdAt: new Date() },
    { trackId: 'trk_022', albumId: 'alb_009', artistId: 'art_011', title: 'Here Comes The Sun', duration_sec: 185, genre: 'Rock', mood: ['Happy', 'Uplifting', 'Sunny'], createdBy: 'user_admin', createdAt: new Date() },
    { trackId: 'trk_023', albumId: 'alb_010', artistId: 'art_012', title: 'Heroes', duration_sec: 371, genre: 'Rock', mood: ['Epic', 'Uplifting', 'Powerful'], createdBy: 'user_admin', createdAt: new Date() },
];

const playlists = [
    { playlistId: 'pl_001', userId: 'user_001', name: '80s Classics', description: 'Die besten Songs der 80er', trackIds: ['trk_001', 'trk_002', 'trk_004', 'trk_006'], isPublic: true, createdBy: 'user_001', createdAt: new Date() },
    { playlistId: 'pl_002', userId: 'user_002', name: 'R&B Ballads', description: 'Gefühlvolle R&B Songs', trackIds: ['trk_011', 'trk_012'], isPublic: true, createdBy: 'user_002', createdAt: new Date() },
    { playlistId: 'pl_003', userId: 'user_003', name: 'Pop Power', description: 'Energiegeladene Pop-Hits', trackIds: ['trk_006', 'trk_007', 'trk_015', 'trk_016'], isPublic: true, createdBy: 'user_003', createdAt: new Date() },
    { playlistId: 'pl_004', userId: 'user_004', name: 'Grunge & Alternative', description: '90er Alternative Rock', trackIds: ['trk_008', 'trk_009', 'trk_010', 'trk_019'], isPublic: false, createdBy: 'user_004', createdAt: new Date() },
    { playlistId: 'pl_005', userId: 'user_005', name: 'Dance Floor', description: 'Zum Tanzen und Feiern', trackIds: ['trk_020', 'trk_015', 'trk_004'], isPublic: true, createdBy: 'user_005', createdAt: new Date() },
    { playlistId: 'pl_006', userId: 'user_001', name: 'Rock Legends', description: 'Legendäre Rock Songs', trackIds: ['trk_004', 'trk_013', 'trk_014'], isPublic: false, createdBy: 'user_001', createdAt: new Date() },
    { playlistId: 'pl_007', userId: 'user_admin', name: 'Admin Favorites', description: 'My top picks', trackIds: ['trk_021', 'trk_023', 'trk_004'], isPublic: true, createdBy: 'user_admin', createdAt: new Date() },
];

const moods = [
    { moodId: 'mood_001', name: 'Happy', description: 'Fröhliche, aufmunternde Musik', keywords: ['joy', 'cheerful', 'bright'], createdAt: new Date() },
    { moodId: 'mood_002', name: 'Sad', description: 'Melancholische, nachdenkliche Musik', keywords: ['melancholy', 'sorrow', 'blue'], createdAt: new Date() },
    { moodId: 'mood_003', name: 'Energetic', description: 'Energiegeladene, motivierende Musik', keywords: ['upbeat', 'dynamic', 'powerful'], createdAt: new Date() },
    { moodId: 'mood_004', name: 'Calm', description: 'Beruhigende, entspannende Musik', keywords: ['relaxing', 'peaceful', 'gentle'], createdAt: new Date() },
    { moodId: 'mood_005', name: 'Romantic', description: 'Romantische, gefühlvolle Musik', keywords: ['love', 'passion', 'intimate'], createdAt: new Date() },
    { moodId: 'mood_006', name: 'Aggressive', description: 'Kraftvolle, intensive Musik', keywords: ['intense', 'powerful', 'fierce'], createdAt: new Date() },
    { moodId: 'mood_007', name: 'Melancholic', description: 'Schwermütige, nachdenkliche Stimmung', keywords: ['pensive', 'wistful', 'nostalgic'], createdAt: new Date() },
    { moodId: 'mood_008', name: 'Uplifting', description: 'Erhebende, inspirierende Musik', keywords: ['inspiring', 'hopeful', 'empowering'], createdAt: new Date() },
    { moodId: 'mood_009', name: 'Dark', description: 'Düstere, mysteriöse Atmosphäre', keywords: ['mysterious', 'ominous', 'shadowy'], createdAt: new Date() },
    { moodId: 'mood_10', name: 'Peaceful', description: 'Friedliche, harmonische Klänge', keywords: ['serene', 'tranquil', 'harmonious'], createdAt: new Date() },
    { moodId: 'mood_11', name: 'Intense', description: 'Intensive, packende Musik', keywords: ['gripping', 'forceful', 'compelling'], createdAt: new Date() },
    { moodId: 'mood_12', name: 'Dreamy', description: 'Verträumte, ätherische Klänge', keywords: ['ethereal', 'floating', 'surreal'], createdAt: new Date() },
    { moodId: 'mood_13', name: 'Mysterious', description: 'Geheimnisvolle, rätselhafte Stimmung', keywords: ['enigmatic', 'cryptic', 'puzzling'], createdAt: new Date() },
    { moodId: 'mood_14', name: 'Rebellious', description: 'Aufsässige, rebellische Energie', keywords: ['defiant', 'revolutionary', 'bold'], createdAt: new Date() },
    { moodId: 'mood_15', name: 'Powerful', description: 'Kraftvolle, mächtige Klänge', keywords: ['strong', 'mighty', 'commanding'], createdAt: new Date() },
    { moodId: 'mood_16', name: 'Catchy', description: 'Eingängige, mitreißende Melodien', keywords: ['memorable', 'hooky', 'infectious'], createdAt: new Date() },
    { moodId: 'mood_17', name: 'Chill', description: 'Entspannt und cool', keywords: ['cool', 'relaxed', 'smooth'], createdAt: new Date() },
    { moodId: 'mood_18', name: 'Sunny', description: 'Sonnige Stimmung', keywords: ['sun', 'warm', 'bright'], createdAt: new Date() },
    { moodId: 'mood_19', name: 'Epic', description: 'Episch und groß', keywords: ['grand', 'monumental', 'heroic'], createdAt: new Date() },
    { moodId: 'mood_20', name: 'Classic', description: 'Klassische Vibes', keywords: ['traditional', 'standard'], createdAt: new Date() },
    { moodId: 'mood_21', name: 'Dramatic', description: 'Dramatisch', keywords: ['drama', 'theatrical'], createdAt: new Date() },
    { moodId: 'mood_22', name: 'Groovy', description: 'Rhythmisch, tanzbar, funkig', keywords: ['funk', 'rhythm', 'dance'], createdAt: new Date() },
    { moodId: 'mood_23', name: 'Atmospheric', description: 'Stimmungsvoll, raumfüllend', keywords: ['ambient', 'space', 'moody'], createdAt: new Date() },
    { moodId: 'mood_24', name: 'Technical', description: 'Technisch anspruchsvoll, komplex', keywords: ['complex', 'skill', 'virtuoso'], createdAt: new Date() }
];

module.exports = { adminUser, users, artists, albums, tracks, playlists, moods };
