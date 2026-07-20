import { useEffect } from "react";

/**
 * Applies a theme to a region of the page.
 *
 * Themes are scoped by wrapper class rather than applied globally, so a v1
 * archive page and v2 app chrome can render on the same screen. The rules live
 * in styles/theme-rules.css under `:where(.theme-v1, .theme-v2)`; the values
 * come from styles/theme-v1.css / theme-v2.css.
 *
 * Scopes are siblings, never nested — nesting would make the equal-specificity
 * :where() rules resolve by stylesheet order instead of by proximity.
 *
 * `pageLevel` additionally puts `theme-page-<theme>` on <body>, which carries
 * the parts of the theme that cannot live inside a React wrapper: the page
 * background and the fixed atmosphere layers (body::before / body::after).
 * Exactly one route renders at a time, so exactly one page-level scope is
 * mounted at a time.
 */
export default function ThemeScope({ theme = "v2", pageLevel = false, children }) {
  useEffect(() => {
    if (!pageLevel) return undefined;
    const className = `theme-page-${theme}`;
    document.body.classList.add(className);
    return () => document.body.classList.remove(className);
  }, [theme, pageLevel]);

  return (
    <div className={`theme-${theme}`} data-theme-scope={pageLevel ? "page" : "region"}>
      {children}
    </div>
  );
}
