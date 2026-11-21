
const db = require("../config/db");

exports.getAuditLogs = (req, res) => {
  const page = Math.max(
    1,
    parseInt(req.query.page, 10) || 1
  );

  const limit = 20;
  const offset = (page - 1) * limit;

  const search = String(req.query.search || "").trim();
  const action = String(req.query.action || "").trim();
  const entity = String(req.query.entity || "").trim();

  if (
    !Number.isSafeInteger(page) ||
    page > 1000000 ||
    search.length > 100 ||
    action.length > 100 ||
    entity.length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid audit log filters."
    });
  }

  const conditions = [];
  const params = [];

  if (search) {
    conditions.push(
      `(a.details LIKE ? OR CAST(a.actor_user_id AS CHAR) LIKE ?)`
    );
    params.push(`%${search}%`, `%${search}%`);
  }

  if (action) {
    conditions.push("a.action_type = ?");
    params.push(action);
  }

  if (entity) {
    conditions.push("a.entity_type = ?");
    params.push(entity);
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const countSql = `
    SELECT COUNT(*) AS total
    FROM audit_logs a
    ${where}
  `;

  db.query(countSql, params, (countError, countRows) => {
    if (countError) {
      console.error("AUDIT COUNT ERROR:", countError);
      return res.status(500).json({
        success: false,
        message: "Failed to count audit logs."
      });
    }

    const total = countRows[0].total;

    const sql = `
      SELECT
        a.log_id,
        a.actor_user_id,
        a.action_type,
        a.entity_type,
        a.entity_id,
        a.details,
        a.created_at,
        u.role AS actor_role,
        TRIM(CONCAT_WS(' ',
          NULLIF(u.first_name, ''),
          NULLIF(u.middle_name, ''),
          NULLIF(u.last_name, ''),
          NULLIF(u.suffix, '')
        )) AS actor_name
      FROM audit_logs a
      LEFT JOIN users u
        ON u.user_id = a.actor_user_id
      ${where}
      ORDER BY a.created_at DESC, a.log_id DESC
      LIMIT ? OFFSET ?
    `;

    db.query(
      sql,
      [...params, limit, offset],
      (error, rows) => {
        if (error) {
          console.error("FETCH AUDIT LOGS ERROR:", error);
          return res.status(500).json({
            success: false,
            message: "Failed to fetch audit logs."
          });
        }

        return res.json({
          success: true,
          logs: rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      }
    );
  });
};
