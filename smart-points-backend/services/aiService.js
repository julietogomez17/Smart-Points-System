
const axios = require("axios");

// ==========================================
// CITIPOINTS AI API
// ==========================================

const AI_BASE_URL =
  process.env.CITIPOINTS_AI_URL ||
  "http://127.0.0.1:5001";

// ==========================================
// FRAUD DETECTION
// ==========================================

async function checkFraudRisk(claimData, useGpsModel = false) {
  try {
    const endpoint = useGpsModel
      ? "/predict-v2"
      : "/predict";

    const response = await axios.post(
      `${AI_BASE_URL}${endpoint}`,
      claimData,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "CITIPOINTS FRAUD AI ERROR:",
      error.response?.data || error.message
    );

    throw new Error(
      "Unable to connect to CITIPOINTS fraud detection service."
    );
  }
}

// ==========================================
// REWARD RECOMMENDATION
// ==========================================

async function getRewardRecommendations(userId) {
  try {
    const response = await axios.get(
      `${AI_BASE_URL}/recommendations/${userId}`,
      {
        timeout: 15000
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "CITIPOINTS RECOMMENDATION AI ERROR:",
      error.response?.data || error.message
    );

    throw new Error(
      "Unable to connect to CITIPOINTS reward recommendation service."
    );
  }
}

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  checkFraudRisk,
  getRewardRecommendations
};
