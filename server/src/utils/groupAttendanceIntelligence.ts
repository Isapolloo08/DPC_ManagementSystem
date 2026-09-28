export interface AttendanceStatusRecord {
  member_id: number;
  session_date: string | Date;
  status: string;
}

export function countConsecutiveAbsences(records: AttendanceStatusRecord[]): number {
  let count = 0;
  for (const record of records) {
    if (record.status !== "absent") break;
    count += 1;
  }
  return count;
}
