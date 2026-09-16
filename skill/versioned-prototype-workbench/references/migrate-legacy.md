# Migrate A Legacy Prototype

Migrate incrementally. The legacy file remains the comparison source until each page is accepted.

1. Inventory user-visible routes, menus, page sections, shared styles, shared state, storage keys, and cross-page events.
2. Define page ownership. One menu normally becomes one `pageId`; split further only when a workflow has independent review and release boundaries.
3. Write named shared state contracts before moving code. Record producers, consumers, fields, persistence, and compatibility behavior.
4. Add one destination page and baseline specification.
5. Move only that page's HTML, styles, behavior, and fixtures. Reuse shared shell code; do not copy the entire legacy file.
6. Verify behavior against the legacy source and approved requirements, then publish, align, and build.
7. Continue page by page. Remove the legacy source only after all routes are mapped and accepted.

Do not manufacture version history. Imported legacy material becomes a baseline whose source identifies the legacy artifact and migration date. Start immutable change history from that baseline.
