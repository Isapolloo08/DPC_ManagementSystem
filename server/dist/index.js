"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const schema_1 = require("./db/schema");
const auth_1 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const ministries_1 = __importDefault(require("./routes/ministries"));
const members_1 = __importDefault(require("./routes/members"));
const households_1 = __importDefault(require("./routes/households"));
const attendance_1 = __importDefault(require("./routes/attendance"));
const events_1 = __importDefault(require("./routes/events"));
const communications_1 = __importDefault(require("./routes/communications"));
const groups_1 = __importDefault(require("./routes/groups"));
const studyTopics_1 = __importDefault(require("./routes/studyTopics"));
const finance_1 = __importDefault(require("./routes/finance"));
const settings_1 = __importDefault(require("./routes/settings"));
const reports_1 = __importDefault(require("./routes/reports"));
const audit_1 = __importDefault(require("./routes/audit"));
const duty_1 = __importDefault(require("./routes/duty"));
const dishwashing_1 = __importDefault(require("./routes/dishwashing"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express_1.default.json());
// Health Check
app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "Church Management System API (Node.js + PostgreSQL)",
        time: new Date().toISOString()
    });
});
// API Routes
app.use("/api/auth", auth_1.default);
app.use("/api", users_1.default); // provides /api/roles and /api/users
app.use("/api/ministries", ministries_1.default);
app.use("/api/members", members_1.default);
app.use("/api/households", households_1.default);
app.use("/api/attendance", attendance_1.default);
app.use("/api/events", events_1.default);
app.use("/api/communications", communications_1.default);
app.use("/api/groups", groups_1.default);
app.use("/api/study-topics", studyTopics_1.default);
app.use("/api/finance", finance_1.default);
app.use("/api/settings", settings_1.default);
app.use("/api/reports", reports_1.default);
app.use("/api/audit", audit_1.default);
app.use("/api/duty", duty_1.default);
app.use("/api/dishwashing", dishwashing_1.default);
// Global Error Handler
app.use((err, _req, res, _next) => {
    console.error("Unhandled API Error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
});
// Start Server
async function start() {
    await (0, schema_1.initSchema)();
    app.listen(PORT, () => {
        console.log(`✨ ChMS Backend API (Node.js + Express + PostgreSQL) running on http://localhost:${PORT}`);
    });
}
start().catch(err => {
    console.error("Failed to start ChMS Server:", err);
});
