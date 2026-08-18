/**
 * Allowlist-based rich-text sanitizer for admin-authored HTML.
 *
 * Used for content that is stored by an admin and rendered via
 * `dangerouslySetInnerHTML` (e.g. E-Form terms & conditions). The policy is
 * deliberately strict so it stays easy to audit:
 *
 *  - Only structural/formatting tags survive; everything else is unwrapped
 *    (its text is kept) or dropped entirely.
 *  - EVERY attribute is removed. No `href`, no `src`, no `style`, no `on*`.
 *    That makes attribute-based injection vectors unreachable by construction
 *    rather than by blocklist.
 *
 * Parsing is delegated to the browser's DOMParser in `text/html` mode, which
 * does not execute scripts and does not fetch resources.
 */

/** Tags kept in the output. Everything here is inert once attributes are stripped. */
const ALLOWED_TAGS = new Set([
    'P', 'BR', 'HR', 'SPAN', 'DIV',
    'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SMALL', 'SUP', 'SUB',
    'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'PRE', 'CODE',
    'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'CAPTION',
]);

/** Tags removed together with their contents — their text is never renderable prose. */
const DROPPED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META',
    'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'TEMPLATE', 'SVG', 'MATH',
]);

const sanitizeElement = (element: Element): void => {
    // Clean children first, so unwrapping a node always exposes an already-clean subtree.
    for (const child of Array.from(element.children)) {
        sanitizeElement(child);

        if (DROPPED_TAGS.has(child.tagName)) {
            child.remove();
            continue;
        }

        if (!ALLOWED_TAGS.has(child.tagName)) {
            child.replaceWith(...Array.from(child.childNodes));
            continue;
        }

        for (const attribute of Array.from(child.attributes)) {
            child.removeAttribute(attribute.name);
        }
    }
};

/**
 * Returns `html` reduced to the allowlisted, attribute-free subset above.
 * Returns an empty string when there is nothing to render.
 */
export const sanitizeRichText = (html: string | null | undefined): string => {
    if (!html || typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
        return '';
    }

    const document = new window.DOMParser().parseFromString(html, 'text/html');
    sanitizeElement(document.body);
    return document.body.innerHTML;
};
