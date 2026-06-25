"use client";
import { useState, useRef, DragEvent } from "react";
import { Upload, Download, ArrowLeftRight, ChevronLeft, Link2, Unlink2 } from "lucide-react";
import Link from "next/link";

export default function ImageResizerPage() {
  const [src, setSrc] = useState<string | null>(null);
  const [origW, setOrigW] = useState(0);
  const [origH, setOrigH] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [locked, setLocked] = useState(true);
  const [fileName, setFileName] = useState("");
  const [resized, setResized] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        setSrc(url);
        setOrigW(img.width);
        setOrigH(img.height);
        setWidth(img.width);
        setHeight(img.height);
        setResized(null);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const changeWidth = (v: number) => {
    setWidth(v);
    if (locked && origW) setHeight(Math.round((v / origW) * origH));
    setResized(null);
  };

  const changeHeight = (v: number) => {
    setHeight(v);
    if (locked && origH) setWidth(Math.round((v / origH) * origW));
    setResized(null);
  };

  const resize = () => {
    if (!src) return;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      setResized(canvas.toDataURL("image/png"));
    };
    img.src = src;
  };

  const download = () => {
    if (!resized) return;
    const a = document.createElement("a");
    a.href = resized;
    a.download = `resized_${fileName}`;
    a.click();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/tools" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" /> All Tools
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
          <ArrowLeftRight className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Image Resizer</h1>
      </div>
      <p className="text-slate-500 mb-8">Resize images to exact dimensions. Runs locally in your browser.</p>

      {!src ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer transition-colors ${
            dragging ? "border-violet-400 bg-violet-50" : "border-slate-300 hover:border-violet-300 hover:bg-slate-50"
          }`}
        >
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="font-semibold text-slate-700 mb-1">Drop an image or click to browse</p>
          <p className="text-sm text-slate-400">JPG, PNG, WebP, GIF</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-600 mb-1">Original: <span className="text-slate-900 font-semibold">{fileName}</span></p>
            <p className="text-sm text-slate-500">{origW} × {origH} px</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">New Dimensions</h2>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Width (px)</label>
                <input
                  type="number"
                  value={width}
                  min={1}
                  onChange={(e) => changeWidth(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <button
                onClick={() => setLocked(!locked)}
                className="mt-4 p-2 rounded-lg border border-slate-200 hover:border-violet-300 text-slate-500 hover:text-violet-600 transition-colors"
                title={locked ? "Unlock aspect ratio" : "Lock aspect ratio"}
              >
                {locked ? <Link2 className="w-4 h-4" /> : <Unlink2 className="w-4 h-4" />}
              </button>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Height (px)</label>
                <input
                  type="number"
                  value={height}
                  min={1}
                  onChange={(e) => changeHeight(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
            </div>
            {locked && <p className="text-xs text-violet-600 mt-2 flex items-center gap-1"><Link2 className="w-3 h-3" /> Aspect ratio locked</p>}

            <div className="flex flex-wrap gap-2 mt-4">
              {[[800, 600], [1280, 720], [1920, 1080], [512, 512]].map(([w, h]) => (
                <button
                  key={`${w}x${h}`}
                  onClick={() => { setWidth(w); setHeight(h); setLocked(false); setResized(null); }}
                  className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg hover:border-violet-300 hover:text-violet-600 transition-colors"
                >
                  {w}×{h}
                </button>
              ))}
            </div>

            <button
              onClick={resize}
              className="mt-5 w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Resize Image
            </button>
          </div>

          {resized && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h2 className="font-semibold text-slate-900 mb-4">Preview — {width} × {height} px</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resized} alt="Resized preview" className="w-full max-h-72 object-contain rounded-xl border border-slate-100 mb-4" />
              <button
                onClick={download}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" /> Download PNG
              </button>
            </div>
          )}

          <button onClick={() => { setSrc(null); setResized(null); }} className="text-sm text-slate-400 hover:text-red-500 transition-colors">
            ← Use a different image
          </button>
        </div>
      )}
    </div>
  );
}
