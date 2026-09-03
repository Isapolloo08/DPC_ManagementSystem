import { db } from "./db/schema";

export interface UserSession {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  ministry_ids: number[];
}

export async function parseAuth(token: string): Promise<UserSession | null> {
  try {
    let userId: number | null = null;
    if (token.startsWith("uid_")) {
      userId = parseInt(token.replace("uid_", ""));
    } else {
      const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
      userId = decoded.id;
    }

    if (!userId) return null;

    const userRow = await db.get(`
      SELECT u.id, u.name, u.email, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);

    if (!userRow) return null;

    const ministryRows = await db.all<{ ministry_id: number }>(`
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
  } catch {
    return null;
  }
}
