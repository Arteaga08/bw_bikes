/** Hidden until it receives keyboard focus (FRONTEND_GUIDELINES.md §5) — `.skip-link` lives in globals.css. */
export function SkipLink() {
  return (
    <a href="#panel-content" className="skip-link">
      Saltar al contenido
    </a>
  );
}
