export const visitStatuses = ['New', 'Contacted', 'Visited', 'Cancelled'] as const;
const parties = ['Just me', 'With friends', 'With family'];
const ageGroups = ['Under 3', 'Ages 3–5', 'Ages 6–12'];
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function validateVisit(body: Record<string, unknown>, today = manilaToday()) {
  const errors: Record<string, string> = {};
  const text = (key: string, max: number) => {
    const value = body[key];
    if (value !== undefined && typeof value !== 'string') errors[key] = 'Please enter text.';
    const clean = typeof value === 'string' ? value.trim() : '';
    if (clean.length > max) errors[key] = `Use at most ${max} characters.`;
    return clean;
  };
  const full_name = text('full_name', 120);
  const email = text('email', 254).toLowerCase();
  const phone = text('phone', 30);
  const questions = text('questions', 2000);
  if (!full_name) errors.full_name = 'Please enter your name.';
  if (!email && !phone) errors.contact = 'Enter an email address or phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15)) errors.phone = 'Enter a valid phone number.';
  if (!validDate(body.visit_date) || body.visit_date < today || new Date(body.visit_date + 'T00:00:00Z').getUTCDay() !== 0) errors.visit_date = 'Choose today or an upcoming Sunday.';
  if (!parties.includes(String(body.party))) errors.party = 'Choose who is coming.';
  if (typeof body.bringing_children !== 'boolean') errors.bringing_children = 'Choose whether you are bringing children.';
  if (!Array.isArray(body.child_age_groups) || body.child_age_groups.length > 3 || body.child_age_groups.some(age => typeof age !== 'string' || !ageGroups.includes(age))) errors.child_age_groups = 'Choose valid age groups.';
  if (body.consent !== true) errors.consent = 'Please agree to be contacted about your visit.';
  if (typeof body.submission_token !== 'string' || !uuidPattern.test(body.submission_token)) errors.submission_token = 'Please refresh the form and try again.';
  return { errors, data: {
    full_name, email: email || null, phone: phone || null, questions,
    visit_date: body.visit_date as string, party: body.party as string,
    bringing_children: body.bringing_children as boolean,
    child_age_groups: body.bringing_children && Array.isArray(body.child_age_groups) ? [...new Set(body.child_age_groups as string[])].sort() : [],
  } };
}
