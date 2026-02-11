const express = require('express');
const router = express.Router();
const { getDriver } = require('../config/neo4j');
const { getDb } = require('../config/mongo');

// ── MOOD-BASED RECOMMENDATIONS ────────────────────────────────────────────────
// Neo4j finds tracks that share moods with tracks the user likes
// → Tracks are recommended based on shared emotional qualities (moods)
// → Ranked by number of shared moods
// → Fallback: If user has no likes, use their preferred moods from registration
// MongoDB provides full track details
//
router.get('/recommendations/:userId', async (req, res) => {
  const userId = req.params.userId;
  const session = getDriver().session();

  try {
    // Step 1: Find tracks user likes
    const likedResult = await session.run(
      `MATCH (u:User {userId: $userId})-[:LIKES]->(liked:Track)
       RETURN liked.trackId AS trackId`,
      { userId }
    );
    const likedTrackIds = likedResult.records.map(r => r.get('trackId'));

    // Step 2: If user has no likes, use preferred moods as fallback
    if (likedTrackIds.length === 0) {
      // Get user's preferred moods from MongoDB
      const user = await getDb().collection('users').findOne({ userId });

      if (!user || !user.preferredMoods || user.preferredMoods.length === 0) {
        return res.json({
          userId,
          message: 'Keine Likes gefunden. Like einige Tracks im Graph-Bereich, um Empfehlungen zu erhalten!',
          recommendations: []
        });
      }

      // Find moods in MongoDB and get their moodIds
      const preferredMoodNames = user.preferredMoods;
      const moodDocs = await getDb().collection('moods').find({
        name: { $in: preferredMoodNames }
      }).toArray();
      const preferredMoodIds = moodDocs.map(m => m.moodId);

      if (preferredMoodIds.length === 0) {
        return res.json({
          userId,
          message: 'Bevorzugte Moods noch nicht konfiguriert',
          recommendations: []
        });
      }

      // Find tracks with preferred moods
      const recommendResult = await session.run(
        `MATCH (mood:Mood)<-[:HAS_MOOD]-(recommended:Track)
         WHERE mood.moodId IN $moodIds
         RETURN recommended.trackId AS trackId, 
                COUNT(DISTINCT mood) AS sharedMoods
         ORDER BY sharedMoods DESC
         LIMIT 10`,
        { moodIds: preferredMoodIds }
      );

      if (recommendResult.records.length === 0) {
        return res.json({
          userId,
          message: 'Keine Tracks mit deinen bevorzugten Moods gefunden',
          recommendations: []
        });
      }

      // Get track IDs and shared mood counts
      const recommendations = recommendResult.records.map(r => ({
        trackId: r.get('trackId'),
        sharedMoods: r.get('sharedMoods').toInt()
      }));

      // Fetch full track data from MongoDB
      const trackIds = recommendations.map(r => r.trackId);
      const tracks = await getDb().collection('tracks').find({
        trackId: { $in: trackIds }
      }).toArray();

      // Merge Neo4j scores with MongoDB data
      const enrichedRecommendations = recommendations.map(rec => {
        const track = tracks.find(t => t.trackId === rec.trackId);
        return {
          ...track,
          sharedMoods: rec.sharedMoods,
          reason: `Passt zu deinen bevorzugten Moods (${preferredMoodNames.join(', ')})`
        };
      });

      return res.json({
        userId,
        algorithm: 'Basierend auf deinen bevorzugten Moods',
        preferredMoods: preferredMoodNames,
        recommendations: enrichedRecommendations
      });
    }

    // Step 3: Find tracks with shared moods (mood-based recommendations from likes)
    // Algorithm: If user likes Track A (Happy, Energetic)
    //            → Recommend Track B that also has Happy OR Energetic
    //            → Rank by number of shared moods
    const recommendResult = await session.run(
      `MATCH (u:User {userId: $userId})-[:LIKES]->(liked:Track)-[:HAS_MOOD]->(mood:Mood)
       MATCH (mood)<-[:HAS_MOOD]-(recommended:Track)
       WHERE NOT recommended.trackId IN $likedIds
       RETURN recommended.trackId AS trackId, 
              COUNT(DISTINCT mood) AS sharedMoods
       ORDER BY sharedMoods DESC
       LIMIT 10`,
      { userId, likedIds: likedTrackIds }
    );

    if (recommendResult.records.length === 0) {
      return res.json({
        userId,
        message: 'Keine Empfehlungen gefunden. Füge mehr Moods zu deinen Tracks hinzu!',
        recommendations: []
      });
    }

    // Step 4: Get track IDs and shared mood counts
    const recommendations = recommendResult.records.map(r => ({
      trackId: r.get('trackId'),
      sharedMoods: r.get('sharedMoods').toInt()
    }));

    // Step 5: Fetch full track data from MongoDB
    const trackIds = recommendations.map(r => r.trackId);
    const tracks = await getDb().collection('tracks').find({
      trackId: { $in: trackIds }
    }).toArray();

    // Step 6: Merge Neo4j scores with MongoDB data
    const enrichedRecommendations = recommendations.map(rec => {
      const track = tracks.find(t => t.trackId === rec.trackId);
      return {
        ...track,
        sharedMoods: rec.sharedMoods,
        reason: `Teilt ${rec.sharedMoods} Mood${rec.sharedMoods > 1 ? 's' : ''} mit deinen Lieblingssongs`
      };
    });

    res.json({
      userId,
      algorithm: 'Mood-basierte Empfehlungen',
      likedCount: likedTrackIds.length,
      recommendations: enrichedRecommendations
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
});

module.exports = router;
