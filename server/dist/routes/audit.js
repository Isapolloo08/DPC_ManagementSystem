"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const schema_1 = require("../db/schema");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get audit trail (Admin only)
router.get("/", auth_1.authMiddleware, (0, auth_1.requireRoles)("Admin"), async (req, res) => {
    try {
        const logs = await schema_1.db.all(`
      SELECT a.*, u.name as user_name, u.email as user_email, r.name as role_name
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY a.created_at DESC
      LIMIT 100
    `);
        res.json(logs);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
