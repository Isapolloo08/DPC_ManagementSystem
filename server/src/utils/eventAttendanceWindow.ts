export const attendanceDate=(value:string|Date|number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));

export function eventAttendanceWindow(event:{start_time:string|Date;end_time:string|Date},now=Date.now()) {
  const first_date=attendanceDate(event.start_time),last_date=attendanceDate(event.end_time),today=attendanceDate(now);
  const open=today>=first_date&&today<=last_date;
  return {open,first_date,last_date,today,message:open?'':today<first_date?`Attendance opens on ${first_date} (Philippine time).`:`Attendance marking was available through ${last_date} (Philippine time).`};
}
