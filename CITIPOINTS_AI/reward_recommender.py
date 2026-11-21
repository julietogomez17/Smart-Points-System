import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
import mysql.connector

from collections import Counter

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# =========================================================
# DATABASE CONFIGURATION
# =========================================================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "127.0.0.1"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "smart_points_engine")
}


def get_connection():
    return mysql.connector.connect(**DB_CONFIG)


# =========================================================
# HELPER FUNCTIONS
# =========================================================

def clean_text(value):

    if value is None:
        return ""

    return str(value).strip().lower()


def normalize_category(category):

    category = clean_text(category)

    aliases = {
        "foods": "food",
        "school": "education",
        "educational": "education",
        "groceries": "food"
    }

    return aliases.get(category, category)


def safe_int(value):

    try:
        return int(value or 0)

    except (ValueError, TypeError):
        return 0


# =========================================================
# USER CURRENT SMART POINT BALANCE
# =========================================================

def get_user_balance(user_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT balance_after

        FROM point_transactions

        WHERE user_id = %s

        ORDER BY transaction_id DESC

        LIMIT 1
        """,
        (user_id,)
    )

    row = cursor.fetchone()

    cursor.close()
    conn.close()

    if row:
        return safe_int(
            row["balance_after"]
        )

    return 0


# =========================================================
# USER REDEMPTION HISTORY
# =========================================================

def get_redemption_history(user_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            r.reward_id,
            r.reward_name,
            r.category,
            r.partner_id,
            r.points_cost

        FROM reward_redemptions rr

        INNER JOIN rewards r
            ON rr.reward_id = r.reward_id

        WHERE rr.user_id = %s
          AND rr.status = 'approved'
        """,
        (user_id,)
    )

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows


# =========================================================
# USER ACTIVITY / PARTICIPATION HISTORY
# =========================================================

def get_activity_history(user_id):

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            a.activity_id,
            a.title,
            a.category

        FROM participation_records pr

        INNER JOIN activities a
            ON pr.activity_id = a.activity_id

        WHERE pr.user_id = %s
          AND pr.status = 'approved'
        """,
        (user_id,)
    )

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows


# =========================================================
# AVAILABLE REWARDS
# =========================================================

def get_available_rewards():

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        """
        SELECT
            reward_id,
            reward_name,
            description,
            category,
            points_cost,
            stock,
            availability_status,
            partner_id,
            image_url

        FROM rewards

        WHERE stock > 0
          AND LOWER(availability_status) = 'available'
        """
    )

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return rows


# =========================================================
# BUILD CITIZEN PROFILE
# =========================================================

def build_user_profile(
    user_balance,
    redemption_history,
    activity_history
):

    profile_tokens = []

    redemption_categories = Counter()
    activity_categories = Counter()
    preferred_partners = Counter()


    # -----------------------------------------------------
    # REDEMPTION BEHAVIOR
    # -----------------------------------------------------

    for redemption in redemption_history:

        category = normalize_category(
            redemption["category"]
        )

        if category:

            redemption_categories[
                category
            ] += 1


        partner_id = redemption.get(
            "partner_id"
        )

        if partner_id is not None:

            preferred_partners[
                str(partner_id)
            ] += 1


    # -----------------------------------------------------
    # PARTICIPATION / ACTIVITY HISTORY
    # -----------------------------------------------------

    for activity in activity_history:

        category = normalize_category(
            activity["category"]
        )

        if category:

            activity_categories[
                category
            ] += 1


    # -----------------------------------------------------
    # ADD REDEMPTION CATEGORY PREFERENCES
    # More repetitions = stronger preference
    # -----------------------------------------------------

    for category, count in (
        redemption_categories.items()
    ):

        repeats = min(
            count * 3,
            12
        )

        profile_tokens.extend(
            [f"category_{category}"] * repeats
        )


    # -----------------------------------------------------
    # ADD ACTIVITY CATEGORY PREFERENCES
    # -----------------------------------------------------

    for category, count in (
        activity_categories.items()
    ):

        repeats = min(
            count * 2,
            10
        )

        profile_tokens.extend(
            [f"activity_{category}"] * repeats
        )

        # Also allow activity category to influence
        # related reward category similarity.
        profile_tokens.extend(
            [f"category_{category}"] * count
        )


    # -----------------------------------------------------
    # PREFERRED PARTNERS
    # -----------------------------------------------------

    for partner_id, count in (
        preferred_partners.items()
    ):

        repeats = min(
            count * 2,
            8
        )

        profile_tokens.extend(
            [
                f"partner_{partner_id}"
            ] * repeats
        )


    # -----------------------------------------------------
    # SMART POINT / AFFORDABILITY PROFILE
    # -----------------------------------------------------

    profile_tokens.append(
        "available"
    )

    profile_tokens.append(
        "in_stock"
    )


    if user_balance <= 0:

        profile_tokens.append(
            "points_none"
        )

    elif user_balance <= 50:

        profile_tokens.extend(
            ["points_low"] * 3
        )

    elif user_balance <= 200:

        profile_tokens.extend(
            ["points_medium"] * 3
        )

    elif user_balance <= 500:

        profile_tokens.extend(
            ["points_high"] * 3
        )

    else:

        profile_tokens.extend(
            ["points_very_high"] * 3
        )


    return {
        "profile_text":
            " ".join(profile_tokens),

        "redemption_categories":
            redemption_categories,

        "activity_categories":
            activity_categories,

        "preferred_partners":
            preferred_partners
    }


# =========================================================
# BUILD REWARD CONTENT PROFILE
# =========================================================

def build_reward_document(
    reward,
    user_balance
):

    tokens = []


    reward_name = clean_text(
        reward["reward_name"]
    )

    description = clean_text(
        reward["description"]
    )

    category = normalize_category(
        reward["category"]
    )

    points_cost = safe_int(
        reward["points_cost"]
    )

    partner_id = reward.get(
        "partner_id"
    )


    # -----------------------------------------------------
    # REWARD NAME / DESCRIPTION
    # -----------------------------------------------------

    if reward_name:

        tokens.append(
            reward_name.replace(
                " ",
                "_"
            )
        )


    if description:

        tokens.extend(
            description.split()
        )


    # -----------------------------------------------------
    # REWARD CATEGORY
    # -----------------------------------------------------

    if category:

        tokens.extend(
            [
                f"category_{category}",
                f"category_{category}",
                f"category_{category}"
            ]
        )


    # -----------------------------------------------------
    # PARTNER ATTRIBUTE
    # -----------------------------------------------------

    if partner_id is not None:

        tokens.append(
            f"partner_{partner_id}"
        )


    # -----------------------------------------------------
    # AVAILABILITY ATTRIBUTES
    # -----------------------------------------------------

    tokens.extend(
        [
            "available",
            "in_stock"
        ]
    )


    # -----------------------------------------------------
    # REQUIRED SMART POINT ATTRIBUTE
    # -----------------------------------------------------

    if points_cost <= 50:

        tokens.append(
            "points_low"
        )

    elif points_cost <= 200:

        tokens.append(
            "points_medium"
        )

    elif points_cost <= 500:

        tokens.append(
            "points_high"
        )

    else:

        tokens.append(
            "points_very_high"
        )


    # -----------------------------------------------------
    # AFFORDABILITY ATTRIBUTE
    # -----------------------------------------------------

    if points_cost <= user_balance:

        tokens.extend(
            [
                "affordable",
                "affordable",
                "affordable"
            ]
        )

    else:

        tokens.append(
            "not_affordable"
        )


    return " ".join(tokens)


# =========================================================
# GENERATE EXPLANATION
# =========================================================

def generate_reasons(
    reward,
    user_balance,
    profile
):

    reasons = []

    category = normalize_category(
        reward["category"]
    )

    points_cost = safe_int(
        reward["points_cost"]
    )

    partner_id = reward.get(
        "partner_id"
    )


    redemption_categories = (
        profile[
            "redemption_categories"
        ]
    )

    activity_categories = (
        profile[
            "activity_categories"
        ]
    )

    preferred_partners = (
        profile[
            "preferred_partners"
        ]
    )


    # -----------------------------------------------------
    # PREVIOUS REDEMPTION MATCH
    # -----------------------------------------------------

    if (
        category
        and
        redemption_categories.get(
            category,
            0
        ) > 0
    ):

        reasons.append(
            f"Matches your previous "
            f"{category} reward redemptions"
        )


    # -----------------------------------------------------
    # ACTIVITY HISTORY MATCH
    # -----------------------------------------------------

    if (
        category
        and
        activity_categories.get(
            category,
            0
        ) > 0
    ):

        reasons.append(
            f"Related to your "
            f"{category} activity history"
        )


    # -----------------------------------------------------
    # PARTNER PREFERENCE
    # -----------------------------------------------------

    if (
        partner_id is not None
        and
        preferred_partners.get(
            str(partner_id),
            0
        ) > 0
    ):

        reasons.append(
            "Offered by a partner "
            "you previously redeemed from"
        )


    # -----------------------------------------------------
    # AFFORDABILITY
    # -----------------------------------------------------

    if points_cost <= user_balance:

        reasons.append(
            "Affordable with your "
            "current Smart Points"
        )


    # -----------------------------------------------------
    # AVAILABILITY
    # -----------------------------------------------------

    if safe_int(
        reward["stock"]
    ) > 0:

        reasons.append(
            "Currently available in stock"
        )


    # Keep explanations short
    return reasons[:4]


# =========================================================
# CONTENT-BASED FILTERING
# WITH COSINE SIMILARITY
# =========================================================

def recommend_rewards(
    user_id,
    limit=5
):

    # -----------------------------------------------------
    # LOAD CITIZEN DATA
    # -----------------------------------------------------

    user_balance = get_user_balance(
        user_id
    )

    redemption_history = (
        get_redemption_history(
            user_id
        )
    )

    activity_history = (
        get_activity_history(
            user_id
        )
    )


    # -----------------------------------------------------
    # LOAD AVAILABLE REWARDS
    # -----------------------------------------------------

    rewards = get_available_rewards()


    if not rewards:

        return {
            "user_id":
                user_id,

            "current_balance":
                user_balance,

            "recommendation_method":
                "Content-Based Filtering "
                "with Cosine Similarity",

            "redemption_preferences":
                {},

            "activity_preferences":
                {},

            "recommendations":
                []
        }


    # -----------------------------------------------------
    # BUILD CITIZEN PROFILE
    # -----------------------------------------------------

    profile = build_user_profile(
        user_balance,
        redemption_history,
        activity_history
    )


    user_profile_text = (
        profile["profile_text"]
    )


    # -----------------------------------------------------
    # BUILD REWARD DOCUMENTS
    # -----------------------------------------------------

    reward_documents = []

    candidate_rewards = []


    for reward in rewards:

        points_cost = safe_int(
            reward["points_cost"]
        )


        # -------------------------------------------------
        # IMPORTANT:
        # Don't recommend something citizen cannot redeem.
        # -------------------------------------------------

        if points_cost > user_balance:
            continue


        document = build_reward_document(
            reward,
            user_balance
        )


        reward_documents.append(
            document
        )

        candidate_rewards.append(
            reward
        )


    if not candidate_rewards:

        return {
            "user_id":
                user_id,

            "current_balance":
                user_balance,

            "recommendation_method":
                "Content-Based Filtering "
                "with Cosine Similarity",

            "redemption_preferences":
                dict(
                    profile[
                        "redemption_categories"
                    ]
                ),

            "activity_preferences":
                dict(
                    profile[
                        "activity_categories"
                    ]
                ),

            "recommendations":
                []
        }


    # -----------------------------------------------------
    # TF-IDF CONTENT REPRESENTATION
    # -----------------------------------------------------

    documents = [
        user_profile_text
    ] + reward_documents


    vectorizer = TfidfVectorizer(
        token_pattern=r"(?u)\b[\w_]+\b"
    )


    vectors = vectorizer.fit_transform(
        documents
    )


    # Citizen vector = first document
    user_vector = vectors[0:1]

    # Reward vectors = remaining documents
    reward_vectors = vectors[1:]


    # -----------------------------------------------------
    # COSINE SIMILARITY
    # -----------------------------------------------------

    similarities = cosine_similarity(
        user_vector,
        reward_vectors
    )[0]


    recommendations = []


    # -----------------------------------------------------
    # BUILD RECOMMENDATION RESULTS
    # -----------------------------------------------------

    for index, reward in enumerate(
        candidate_rewards
    ):

        similarity = float(
            similarities[index]
        )


        # Don't label zero-similarity items
        # as personalized recommendations.
        if similarity <= 0:
            continue


        score = round(
            similarity * 100,
            2
        )


        reasons = generate_reasons(
            reward,
            user_balance,
            profile
        )


        recommendations.append({
            "reward_id":
                reward["reward_id"],

            "reward_name":
                reward["reward_name"],

            "description":
                reward["description"],

            "category":
                reward["category"],

            "points_cost":
                safe_int(
                    reward["points_cost"]
                ),

            "stock":
                safe_int(
                    reward["stock"]
                ),

            "availability_status":
                reward[
                    "availability_status"
                ],

            "partner_id":
                reward["partner_id"],

            "image_url":
                reward["image_url"],

            # Actual cosine similarity result
            "similarity":
                round(
                    similarity,
                    4
                ),

            # Easier value for frontend
            "score":
                score,

            "reasons":
                reasons
        })


    # -----------------------------------------------------
    # HIGHEST COSINE SIMILARITY FIRST
    # -----------------------------------------------------

    recommendations.sort(
        key=lambda item:
            item["similarity"],
        reverse=True
    )


    # -----------------------------------------------------
    # RETURN TOP N
    # -----------------------------------------------------

    return {
        "user_id":
            user_id,

        "current_balance":
            user_balance,

        "recommendation_method":
            "Content-Based Filtering "
            "with Cosine Similarity",

        "redemption_preferences":
            dict(
                profile[
                    "redemption_categories"
                ]
            ),

        "activity_preferences":
            dict(
                profile[
                    "activity_categories"
                ]
            ),

        "redemption_history_count":
            len(
                redemption_history
            ),

        "activity_history_count":
            len(
                activity_history
            ),

        "recommendations":
            recommendations[:limit]
    }


# =========================================================
# MANUAL TEST
# =========================================================

if __name__ == "__main__":

    test_user_id = 9


    result = recommend_rewards(
        user_id=test_user_id,
        limit=5
    )


    print("\n")
    print(
        "CITIPOINTS AI REWARD RECOMMENDER"
    )

    print("=" * 60)


    print(
        f"User ID: "
        f"{result['user_id']}"
    )


    print(
        f"Current Balance: "
        f"{result['current_balance']}"
    )


    print(
        f"Method: "
        f"{result['recommendation_method']}"
    )


    print(
        f"Redemption Preferences: "
        f"{result['redemption_preferences']}"
    )


    print(
        f"Activity Preferences: "
        f"{result['activity_preferences']}"
    )


    print("\nTOP RECOMMENDATIONS")
    print("-" * 60)


    recommendations = (
        result["recommendations"]
    )


    if not recommendations:

        print(
            "No suitable recommendations found."
        )


    for index, reward in enumerate(
        recommendations,
        start=1
    ):

        print(
            f"\n{index}. "
            f"{reward['reward_name']}"
        )

        print(
            f"   Category: "
            f"{reward['category']}"
        )

        print(
            f"   Cost: "
            f"{reward['points_cost']} points"
        )

        print(
            f"   Stock: "
            f"{reward['stock']}"
        )

        print(
            f"   Cosine Similarity: "
            f"{reward['similarity']}"
        )

        print(
            f"   Recommendation Score: "
            f"{reward['score']}"
        )

        print(
            "   Reasons:"
        )


        for reason in reward["reasons"]:

            print(
                f"   - {reason}"
            )