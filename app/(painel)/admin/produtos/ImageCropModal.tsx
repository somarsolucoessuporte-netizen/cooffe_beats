"use client";

import { useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const OUTPUT_SIZE = 600;

function cropParaBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar recorte."))),
      "image/jpeg",
      0.85
    );
  });
}

export default function ImageCropModal({
  src,
  onCancel,
  onConfirm,
}: {
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [processando, setProcessando] = useState(false);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const inicial = centerCrop(
      makeAspectCrop({ unit: "%", width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(inicial);
    setCompletedCrop(convertToPixelCrop(inicial, width, height));
  };

  const confirmar = async () => {
    if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) return;
    setProcessando(true);
    try {
      const blob = await cropParaBlob(imgRef.current, completedCrop);
      onConfirm(blob);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-zinc-200">
          <h3 className="text-base font-bold text-zinc-900">Ajustar recorte</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Arraste para posicionar e redimensione a seleção quadrada.
          </p>
        </div>

        <div className="p-5 flex justify-center bg-zinc-50">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImageLoad}
              className="max-h-[60vh] max-w-full object-contain"
            />
          </ReactCrop>
        </div>

        <div className="p-5 border-t border-zinc-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={processando}
            className="px-5 py-2.5 text-zinc-500 hover:text-zinc-700 transition-colors text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={processando || !completedCrop?.width}
            className="font-bold px-6 py-2.5 rounded-xl text-sm disabled:opacity-50 shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "#3B2415", color: "#F6F0E5" }}
          >
            {processando ? "Processando..." : "Confirmar recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
