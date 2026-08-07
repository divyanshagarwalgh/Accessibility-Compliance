"use client";

import { apiPath } from "@/lib/api-path";
import styles from "@/styles/modules.module.css";

export type FileSpec = {
  label: string;
  filename: string;
  /** MIME type for the blob, e.g. "text/html". */
  type: string;
  /** Deferred so a large document is only serialised when the user asks for it. */
  contents: () => string;
};

/**
 * Download buttons for a generated document.
 *
 * Text formats are built in the browser from data already on the page — no round
 * trip, and the file matches exactly what the preview showed. `.docx` is a zip
 * of XML parts, so it is produced by the export route instead and fetched as a
 * plain link, which also means the file survives being shared as a URL.
 */
export function DownloadActions({
  files,
  documentId,
  docxLabel,
}: {
  files: FileSpec[];
  documentId?: string;
  docxLabel?: string;
}) {
  function download(file: FileSpec) {
    const blob = new Blob([file.contents()], { type: `${file.type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next tick: revoking synchronously races the download in
    // Safari, which reads the object URL after the click handler returns.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      {documentId && docxLabel ? (
        <a
          className={styles.btnGhost}
          href={apiPath(`documents/${documentId}/export?format=docx`)}
          download
        >
          {docxLabel}
        </a>
      ) : null}
      {files.map((file) => (
        <button
          key={file.filename}
          type="button"
          className={styles.btnGhost}
          onClick={() => download(file)}
        >
          {file.label}
        </button>
      ))}
    </>
  );
}
