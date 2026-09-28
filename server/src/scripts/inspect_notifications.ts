import { db } from "../db/schema";

async function inspect() {
  try {
    const users = await db.all("SELECT id, name, email, role_id FROM users");
    console.log("USERS:", users);

    const notifications = await db.all("SELECT * FROM notifications");
    console.log("NOTIFICATIONS (COUNT=" + notifications.length + "):", notifications);

    const rules = await db.all("SELECT * FROM notification_rules");
    console.log("RULES (COUNT=" + rules.length + "):", rules);

    const log = await db.all("SELECT * FROM notification_log");
    console.log("LOG (COUNT=" + log.length + "):", log);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

inspect();
