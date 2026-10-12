/** Calendar dates have no timezone. Never parse them as a local instant. */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function paperDateLabel(paper, { short = false } = {}) {
  const exam = isCalendarDate(paper?.exam_date);
  const value = exam ? paper.exam_date : paper?.date_taken;
  if (!isCalendarDate(value)) return 'Added date not recorded';
  const label = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', ...(short ? {} : { year: 'numeric' }), timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
  return `${exam ? 'Exam' : 'Added'} ${label}`;
}
