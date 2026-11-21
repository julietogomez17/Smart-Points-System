const { checkFraudRisk } = require("./services/aiService");

async function testAI() {

    // Test suspicious CITIPOINTS claim
    const claim = {
        points_claimed: 300,
        claims_last_24h: 15,
        user_claims_7d: 25,
        rejected_claims_30d: 6,
        same_activity_claims: 4,
        duplicate_proof_count: 3,
        proof_reuse_count: 3,
        submission_delay_minutes: 1,
        location_mismatch: 1,
        rapid_submission: 1,
        account_age_days: 5,
        prior_approved_claims: 0
    };

    try {

        const result = await checkFraudRisk(claim);

        console.log("\n--- CITIPOINTS AI RESULT ---");
        console.log(result);

    } catch (error) {

        console.error(
            "AI TEST ERROR:",
            error.message
        );

    }
}

testAI();