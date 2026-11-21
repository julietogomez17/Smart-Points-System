from reward_recommender import recommend_rewards


def print_result(user_id):
    print("\n" + "=" * 60)
    print(f"TESTING USER ID: {user_id}")
    print("=" * 60)

    try:
        result = recommend_rewards(
            user_id=user_id,
            limit=5
        )

        print(
            f"Current Balance: "
            f"{result['current_balance']}"
        )

        print(
            f"Category Preferences: "
            f"{result['category_preferences']}"
        )

        recommendations = result["recommendations"]

        if not recommendations:
            print("\nNo recommendations found.")
            return

        print("\nTOP RECOMMENDATIONS")
        print("-" * 60)

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
                f"   Status: "
                f"{reward['availability_status']}"
            )

            print(
                f"   Score: "
                f"{reward['score']}"
            )

            print(
                "   Reasons:"
            )

            for reason in reward["reasons"]:
                print(
                    f"   - {reason}"
                )

    except Exception as error:
        print(
            f"\nERROR for user {user_id}: "
            f"{error}"
        )


# ==========================================
# TEST USERS
# ==========================================

test_users = [
    9,      # User with lots of redemption history
    3,      # User with some history
    9999    # User that probably does not exist
]


for user_id in test_users:
    print_result(user_id)