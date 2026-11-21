
const db = require("../config/db");

/**
 * Save an audit record using the existing CitiPoints table.
 *
 * Do not include passwords, OTPs, tokens,
 * ID images, or other sensitive information.
 */
const logAudit = ({
  actorUserId = null,
  actionType,
  entityType,
  entityId = null,
  details = null,
  connection = db
}) => {
  return new Promise((resolve, reject) => {
    if (!actionType || !entityType) {
      return reject(
        new Error("Audit actionType and entityType are required.")
      );
    }

    const sql = `
      INSERT INTO audit_logs
        (
          actor_user_id,
          action_type,
          entity_type,
          entity_id,
          details
        )
      VALUES (?, ?, ?, ?, ?)
    `;

    const values = [
      actorUserId,
      actionType,
      entityType,
      entityId,
      details
    ];

    connection.query(sql, values, (error, result) => {
      if (error) {
        return reject(error);
      }

      resolve(result);
    });
  });
};

module.exports = { logAudit };
