"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAuth = parseAuth;
const schema_1 = require("./db/schema");
async function parseAuth(token) {
    try {
        let userId = null;
        if (token.startsWith("uid_")) {
            userId = parseInt(token.replace("uid_", ""));
        }
        else {
            const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
            userId = decoded.id;
        }
        if (!userId)
            return null;
        const userRow = await schema_1.db.get(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);
        if (!userRow)
            return null;
        const ministryRows = await schema_1.db.all(`
      SELECT ministry_id FROM user_ministries WHERE user_id = $1
    `, [userId]);
        return {
            id: userRow.id,
            name: userRow.name,
            email: userRow.email,
            role_id: userRow.role_id,
            role_name: userRow.role_name,
            ministry_ids: ministryRows.map(m => m.ministry_id)
        };
    }
    catch {
        return null;
    }
}
