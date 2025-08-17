// Common formatters for displaying values in the UI

export function formatDateWithDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short', // e.g., Mon
    year: 'numeric',
    month: 'short', // e.g., Aug
    day: 'numeric',
  });
}

// Return YYYY-MM-DD string for a given Date in a specific IANA timezone (default Asia/Dhaka)
export function dateToInputValueInTZ(date = new Date(), tz = 'Asia/Dhaka') {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA with these options yields YYYY-MM-DD
    return fmt.format(date);
  } catch {
    // Fallback to local timezone if Intl/timeZone unsupported
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

// Convenience: today's date in Asia/Dhaka as YYYY-MM-DD
export function todayISOInTZ(tz = 'Asia/Dhaka') {
  return dateToInputValueInTZ(new Date(), tz);
}
