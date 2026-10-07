// Chromium could not be started at all, which is a server setup problem rather than a bad run.
// Its own module so a caller can recognize it without loading the renderer.
export default class PdfRendererUnavailableError extends Error {}
