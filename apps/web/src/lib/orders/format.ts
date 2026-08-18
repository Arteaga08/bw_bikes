const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

const dateShortFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
});

const timeShortFormatter = new Intl.DateTimeFormat("es-MX", {
  timeStyle: "short",
});

/** An ISO timestamp from the API → a locale-formatted date+time string. */
function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/**
 * The date half of `formatDateTime`, for the table cells that stack the date
 * over its time instead of running both together on one line — splitting the
 * one formatter's output on a separator would depend on the locale's own
 * punctuation, which `Intl` makes no promise about.
 */
function formatDateShort(iso: string): string {
  return dateShortFormatter.format(new Date(iso));
}

/** The time half — counterpart to `formatDateShort`. */
function formatTimeShort(iso: string): string {
  return timeShortFormatter.format(new Date(iso));
}

export { formatDateShort, formatDateTime, formatTimeShort };
