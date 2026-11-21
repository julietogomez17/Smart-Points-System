const {
  getRewardRecommendations: getAIRecommendations
} = require('../services/aiService');

const getRewardRecommendations = async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log(
      'REQUESTING AI RECOMMENDATIONS FOR USER:',
      userId
    );

    const aiResponse = await getAIRecommendations(userId);

    console.log(
      'AI RECOMMENDATION RESPONSE:',
      JSON.stringify(aiResponse, null, 2)
    );

    if (
      !aiResponse ||
      aiResponse.success !== true ||
      !aiResponse.data
    ) {
      return res.status(500).json({
        success: false,
        message: 'Invalid response from recommendation AI'
      });
    }

    const data = aiResponse.data;

    return res.status(200).json({
      success: true,

      user_id: data.user_id,

      current_points:
        data.current_balance,

      recommendation_method:
        data.recommendation_method ||
        'Content-Based Filtering with Cosine Similarity',

      redemption_preferences:
        data.redemption_preferences || {},

      activity_preferences:
        data.activity_preferences || {},

      redemption_history_count:
        data.redemption_history_count || 0,

      activity_history_count:
        data.activity_history_count || 0,

      category_preferences:
        data.redemption_preferences || {},

      recommendations:
        data.recommendations || []
    });

  } catch (error) {
    console.error(
      'RECOMMENDATION CONTROLLER ERROR:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message:
        'Failed to generate AI reward recommendations',
      error: error.message
    });
  }
};

module.exports = {
  getRewardRecommendations
};