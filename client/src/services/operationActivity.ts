export interface OperationActivity {
  readonly count: number;
  readonly message: string;
}

interface ActiveOperation {
  message: string;
  priority: number;
}

const operations = new Map<symbol, ActiveOperation>();
const listeners = new Set<() => void>();
let snapshot: OperationActivity = { count: 0, message: "" };

function publish() {
  let current: ActiveOperation | undefined;
  for (const operation of operations.values()) {
    // Keep writes visible when a simultaneous read or refresh starts.
    if (!current || operation.priority >= current.priority) current = operation;
  }
  snapshot = { count: operations.size, message: current?.message || "" };
  listeners.forEach(listener => listener());
}

export const operationActivity = {
  getSnapshot: () => snapshot,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

/** Track the complete operation, including response parsing and retries. */
export async function withOperation<T>(message: string, work: () => Promise<T>, priority = 0): Promise<T> {
  const id = Symbol();
  operations.set(id, { message, priority });
  publish();
  try {
    return await work();
  } finally {
    operations.delete(id);
    publish();
  }
}

const readMessages: Record<string, string> = {
  members: "Loading members…",
  households: "Loading families…",
  attendance: "Loading attendance…",
  "attendance-log": "Loading attendance records…",
  events: "Loading events…",
  groups: "Loading Bible study groups…",
  "study-topics": "Loading study topics…",
  ministries: "Loading ministries…",
  notifications: "Loading notifications…",
  reports: "Loading reports…",
  audit: "Loading audit history…",
  settings: "Loading settings…",
  users: "Loading users…",
  duty: "Loading duty schedules…",
  dishwashing: "Loading dishwashing schedules…",
  services: "Loading services…",
  "planned-visits": "Loading planned visits…",
  "bible-reading": "Loading Bible reading progress…",
  backup: "Loading backup records…",
  "cloud-sync": "Checking cloud connection…",
};

/** Labels describe the action without displaying URLs, record IDs, or credentials. */
export function requestActivity(endpoint: string, method = "GET"): ActiveOperation {
  const path = endpoint.split("?")[0];
  const verb = method.toUpperCase();
  const readOnly = ["GET", "HEAD", "OPTIONS"].includes(verb);
  const priority = readOnly ? 0 : 1;
  let message: string;
  if (path === "/auth/login" || path === "/auth/switch-demo") message = "Signing in…";
  else if (path === "/auth/register") message = "Creating your account…";
  else if (path === "/auth/verify-password") message = "Verifying password…";
  else if (path.endsWith("/reset-password")) message = "Resetting password…";
  else if (path === "/notifications/test-email") message = "Queuing test email…";
  else if (path === "/backup/export") message = "Generating backup…";
  else if (path === "/backup/preview") message = "Checking backup file…";
  else if (path === "/backup/restore") message = "Restoring database…";
  else if (path === "/cloud-sync/push") message = "Uploading records to cloud…";
  else if (path === "/cloud-sync/pull") message = "Downloading cloud records…";
  else if (path === "/cloud-sync/test") message = "Testing cloud connection…";
  else if (path === "/cloud-sync/config") message = "Saving cloud connection…";
  else if (verb === "DELETE" || path === "/backup/delete-by-year") message = "Deleting records…";
  else if (/\/export(?:[/.]|$)/.test(path)) message = "Preparing export…";
  else if (/\/import(?:[/-]|$)/.test(path)) message = "Importing records…";
  else if (/\/(?:generate|generate-cycle|generate-sundays)$/.test(path)) message = "Generating schedules…";
  else if (readOnly) message = readMessages[path.split("/")[1]] || "Loading data…";
  else if (["PUT", "PATCH"].includes(verb)) message = "Updating records…";
  else message = "Saving changes…";
  return { message, priority };
}
