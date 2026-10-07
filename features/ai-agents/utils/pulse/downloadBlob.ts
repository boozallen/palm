/** Triggers a browser download for a generated file. */
export default function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoked a tick later: some browsers have not started reading the blob when click() returns,
  // and revoking synchronously cancels the download they were about to begin.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
