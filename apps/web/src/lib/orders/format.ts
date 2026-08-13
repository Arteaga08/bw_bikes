const dateTimeFormatter = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** An ISO timestamp from the API → a locale-formatted date+time string. */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}
