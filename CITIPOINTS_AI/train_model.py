import pandas as pd

# Load CITIPOINTS dataset
df = pd.read_csv(
    "DATASETS/CITIPOINTS_Synthetic_Fraud_Dataset.csv"
)

print("CITIPOINTS DATASET LOADED SUCCESSFULLY!")
print()

print("Dataset size:")
print(df.shape)

print()

print("First 5 records:")
print(df.head())

print("\nFraud Label Distribution:")
print(df["fraud_label"].value_counts())

print("\nFraud Label Percentage:")
print(df["fraud_label"].value_counts(normalize=True) * 100)

from sklearn.model_selection import train_test_split

# Features the Random Forest will use
features = [
    "points_claimed",
    "claims_last_24h",
    "user_claims_7d",
    "rejected_claims_30d",
    "same_activity_claims",
    "duplicate_proof_count",
    "proof_reuse_count",
    "submission_delay_minutes",
    "location_mismatch",
    "rapid_submission",
    "account_age_days",
    "prior_approved_claims"
]

# X = information given to the AI
X = df[features]

# y = answer the AI needs to learn
y = df["fraud_label"]

# Split dataset: 80% training, 20% testing
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n--- TRAIN / TEST SPLIT ---")
print("Total records:", len(df))
print("Training records:", len(X_train))
print("Testing records:", len(X_test))

print("\nTraining label distribution:")
print(y_train.value_counts())

print("\nTesting label distribution:")
print(y_test.value_counts())


from sklearn.ensemble import RandomForestClassifier

print("\n--- TRAINING RANDOM FOREST ---")

model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight="balanced",
    random_state=42
)

# Train the AI
model.fit(X_train, y_train)

print("AI TRAINING COMPLETED SUCCESSFULLY!")

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# ==========================================
# TEST THE TRAINED AI
# ==========================================

print("\n--- TESTING RANDOM FOREST ---")

predictions = model.predict(X_test)

# ==========================================
# CALCULATE PERFORMANCE
# ==========================================

accuracy = accuracy_score(y_test, predictions)
precision = precision_score(y_test, predictions)
recall = recall_score(y_test, predictions)
f1 = f1_score(y_test, predictions)

print("\n--- MODEL PERFORMANCE ---")

print(f"Accuracy:  {accuracy * 100:.2f}%")
print(f"Precision: {precision * 100:.2f}%")
print(f"Recall:    {recall * 100:.2f}%")
print(f"F1 Score:  {f1 * 100:.2f}%")

# ==========================================
# FULL CLASSIFICATION REPORT
# ==========================================

print("\n--- CLASSIFICATION REPORT ---")

print(
    classification_report(
        y_test,
        predictions,
        target_names=["Normal", "Suspicious"]
    )
)

# ==========================================
# CONFUSION MATRIX
# ==========================================

cm = confusion_matrix(y_test, predictions)

print("\n--- CONFUSION MATRIX ---")
print(cm)

# ==========================================
# FEATURE IMPORTANCE
# ==========================================

print("\n--- FEATURE IMPORTANCE ---")

feature_importance = pd.DataFrame({
    "Feature": features,
    "Importance": model.feature_importances_
})

feature_importance = feature_importance.sort_values(
    by="Importance",
    ascending=False
)

print(feature_importance.to_string(index=False))

import joblib
import os

# ==========================================
# SAVE TRAINED MODEL
# ==========================================

print("\n--- SAVING MODEL ---")

os.makedirs("MODEL", exist_ok=True)

joblib.dump(
    model,
    "MODEL/citipoints_fraud_model.pkl"
)

print("MODEL SAVED SUCCESSFULLY!")
print("Location: MODEL/citipoints_fraud_model.pkl")