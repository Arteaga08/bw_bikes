export interface SkipLinkProps {
  /** id of the element to jump to. Defaults to the admin panel's own `<main id="panel-content">`; the storefront shell passes `"contenido"` for its own `<main>`. */
  targetId?: string;
}

/** Hidden until it receives keyboard focus (FRONTEND_GUIDELINES.md §5) — `.skip-link` lives in globals.css. */
export function SkipLink({ targetId = "panel-content" }: SkipLinkProps) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      Saltar al contenido
    </a>
  );
}
