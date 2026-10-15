import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { assetUrl } from "../lib/templates";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function PdfPage({
  bytes,
  page = 0,
  showFields = false,
  onError,
}: {
  bytes: Uint8Array;
  page?: number;
  showFields?: boolean;
  onError?: (error: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<pdfjs.PDFPageProxy["render"]> | undefined;
    const loading = pdfjs.getDocument({
      data: bytes.slice(),
      standardFontDataUrl: assetUrl("pdfjs-fonts/"),
      wasmUrl: assetUrl("pdfjs-wasm/"),
    });
    (async () => {
      try {
        const doc = await loading.promise;
        if (cancelled) return;
        const p = await doc.getPage(page + 1);
        if (cancelled || !ref.current) return;
        const viewport = p.getViewport({ scale: 1.6 });
        const canvas = ref.current;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        task = p.render({
          canvas,
          viewport,
          annotationMode: showFields
            ? pdfjs.AnnotationMode.ENABLE
            : pdfjs.AnnotationMode.DISABLE,
        });
        await task.promise;
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "PDF preview failed";
          setError(message);
          onError?.(message);
        }
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      void loading.destroy();
    };
  }, [bytes, page, showFields]);
  return error ? (
    <p className="error">{error}</p>
  ) : (
    <canvas
      className="pdf-canvas"
      ref={ref}
      aria-label={`PDF page ${page + 1}`}
    />
  );
}
export function PdfPreview({
  bytes,
  pages,
}: {
  bytes: Uint8Array;
  pages: number;
}) {
  const [page, setPage] = useState(0);
  return (
    <div className="pdf-preview">
      <div className="preview-toolbar">
        <span>PDF preview</span>
        <div>
          <button
            className="small-button"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="page-count">
            {page + 1} / {pages}
          </span>
          <button
            className="small-button"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <PdfPage bytes={bytes} showFields page={Math.min(page, pages - 1)} />
    </div>
  );
}
