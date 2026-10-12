import {test} from 'node:test';
import assert from 'node:assert/strict';
import {eventAttendanceWindow} from './eventAttendanceWindow';

test('event attendance opens only on scheduled Philippine calendar dates',()=>{
  const event={start_time:'2026-10-11T09:00:00+08:00',end_time:'2026-10-11T12:00:00+08:00'};
  assert.equal(eventAttendanceWindow(event,Date.parse('2026-10-10T15:59:59Z')).open,false);
  assert.equal(eventAttendanceWindow(event,Date.parse('2026-10-10T16:00:00Z')).open,true);
  assert.equal(eventAttendanceWindow(event,Date.parse('2026-10-11T15:59:59Z')).open,true);
  assert.equal(eventAttendanceWindow(event,Date.parse('2026-10-11T16:00:00Z')).open,false);
  assert.equal(eventAttendanceWindow({...event,end_time:'2026-10-12T18:00:00+08:00'},Date.parse('2026-10-12T06:00:00Z')).open,true);
});
