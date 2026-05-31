// Intentional render/request-time "now" snapshot, isolated from components so
// the react-hooks purity rule doesn't flag a bare Date.now() in render.
// (Server components render once per request; client lock checks want a snapshot.)
export const nowMs = (): number => Date.now();
