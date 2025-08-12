const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function getCurrentMonthName() {
  const d = new Date();
  return months[d.getMonth()];
}

export function isoFirstDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
}

export function isoLastDayOfMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString();
}

export function toUTCTimeStamp(isoString: string): string {
  const date = new Date(isoString);

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');

  return `${yyyy}${mm}${dd}${hh}${min}`;
}
