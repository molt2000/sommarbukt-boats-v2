"use client";
import { useState, useCallback } from "react";
import { Camera, X, Trash2, ZoomIn } from "lucide-react";
import { readAndCompressImage } from "@/lib/image";
import { Damage } from "@/lib/types";
import Button from "@/components/ui/button";
import StoredImg from "@/components/stored-img";
import { uploadDataUrl } from "@/lib/upload";
import { markDamageRepaired } from "@/lib/storage";

export type { Damage };

const VIEWS: { key: Damage["view"]; label: string; src: string }[] = [
  { key: "front", label: "Bow", src: "/boats/bug.png" },
  { key: "rear", label: "Stern", src: "/boats/heck.png" },
  { key: "stb", label: "Starboard", src: "/boats/steuerbord.png" },
  { key: "bb", label: "Port", src: "/boats/backbord.png" },
  { key: "top", label: "Top", src: "/boats/top.png" },
];

interface SheetState {
  mode: "new" | "view";
  view: Damage["view"];
  px: number;
  py: number;
  damage?: Damage;
  photos: string[];
  desc: string;
  damageId: string;
}

interface Props {
  existingDamages: Damage[];
  boatId: string;
  damages: Damage[];
  onChange: (damages: Damage[]) => void;
  onRepaired?: (id: string) => void;
}

function ViewPanel({
  view,
  existingForView,
  newForView,
  onTap,
  onDotTap,
}: {
  view: (typeof VIEWS)[number];
  existingForView: Damage[];
  newForView: Damage[];
  onTap: (view: Damage["view"], e: React.MouseEvent<HTMLDivElement>) => void;
  onDotTap: (e: React.MouseEvent, d: Damage) => void;
}) {
  return (
    <div className="flex flex-col">
      <div
        className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 cursor-crosshair select-none"
        onClick={(e) => onTap(view.key, e)}
      >
        <img
          src={view.src}
          alt={view.label}
          className="w-full object-contain pointer-events-none"
          draggable={false}
        />
        {existingForView.map((d) => (
          <button
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 border-2 border-brand/60 shadow flex items-center justify-center text-brand/70 font-bold text-sm leading-none"
            style={{ left: `${d.px}%`, top: `${d.py}%` }}
            onClick={(e) => onDotTap(e, d)}
          >
            !
          </button>
        ))}
        {newForView.map((d) => (
          <button
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-red-500 border-2 border-white shadow-md flex items-center justify-center text-white font-bold text-sm leading-none"
            style={{ left: `${d.px}%`, top: `${d.py}%` }}
            onClick={(e) => onDotTap(e, d)}
          >
            !
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DamageReport({ existingDamages, boatId, damages, onChange, onRepaired }: Props) {
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const handleImageTap = useCallback(
    (view: Damage["view"], e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      setSheet({ mode: "new", view, px, py, photos: [], desc: "", damageId: crypto.randomUUID() });
    },
    []
  );

  const handleDotTap = useCallback((e: React.MouseEvent, damage: Damage) => {
    e.stopPropagation();
    setSheet({ mode: "view", view: damage.view, px: damage.px, py: damage.py, damage, photos: damage.photoPaths, desc: damage.desc, damageId: damage.id });
  }, []);

  const saveDamage = () => {
    if (!sheet) return;
    const d: Damage = {
      id: sheet.damageId,
      view: sheet.view,
      px: sheet.px,
      py: sheet.py,
      photoPaths: sheet.photos,
      desc: sheet.desc,
      date: Date.now(),
      repairedAt: null,
    };
    onChange([...damages, d]);
    setSheet(null);
  };

  const deleteDamage = (id: string) => {
    onChange(damages.filter((d) => d.id !== id));
    setSheet(null);
  };

  const isExisting = (d: Damage) => existingDamages.some((e) => e.id === d.id);

  const viewProps = (key: Damage["view"]) => ({
    existingForView: existingDamages.filter((d) => d.view === key),
    newForView: damages.filter((d) => d.view === key),
    onTap: handleImageTap,
    onDotTap: handleDotTap,
  });

  return (
    <div className="pb-4 space-y-2">
      {/* Row 1: Bow + Stern */}
      <div className="grid grid-cols-2 gap-2">
        <ViewPanel view={VIEWS[0]} {...viewProps("front")} />
        <ViewPanel view={VIEWS[1]} {...viewProps("rear")} />
      </div>

      {/* Row 2: Starboard */}
      <ViewPanel view={VIEWS[2]} {...viewProps("stb")} />

      {/* Row 3: Port */}
      <ViewPanel view={VIEWS[3]} {...viewProps("bb")} />

      {/* Row 4: Top */}
      <ViewPanel view={VIEWS[4]} {...viewProps("top")} />

      {/* Bottom Sheet */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSheet(null)} />
          <div className="relative bg-white rounded-t-2xl px-5 pt-5 pb-8 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">
                {sheet.mode === "new" ? "Document Damage" : "Damage Details"}
              </h3>
              <button
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition"
                onClick={() => setSheet(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sheet.mode === "new" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Photo</label>
                  {sheet.photos.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {sheet.photos.map((p, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden">
                          <StoredImg path={p} className="w-full h-32 object-cover" />
                          <button
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                            onClick={() =>
                              setSheet((prev) =>
                                prev ? { ...prev, photos: prev.photos.filter((_, j) => j !== i) } : null
                              )
                            }
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition cursor-pointer">
                    <Camera className="w-4 h-4" />
                    Take photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await readAndCompressImage(file, { maxSize: 1000, quality: 0.72 });
                        const path = await uploadDataUrl(dataUrl, "damage-photos", `${boatId}/${sheet.damageId}/${crypto.randomUUID()}.jpg`);
                        setSheet((prev) => (prev ? { ...prev, photos: [...prev.photos, path] } : null));
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    Description{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition min-h-[80px]"
                    rows={2}
                    value={sheet.desc}
                    onChange={(e) => setSheet((prev) => (prev ? { ...prev, desc: e.target.value } : null))}
                    placeholder="Describe the damage..."
                  />
                </div>

                <Button
                  size="lg"
                  onClick={saveDamage}
                  disabled={sheet.photos.length === 0 && !sheet.desc.trim()}
                >
                  Save damage
                </Button>
              </>
            ) : sheet.damage ? (
              <>
                {sheet.damage.photoPaths.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {sheet.damage.photoPaths.map((p, i) => (
                      <button
                        key={i}
                        className="relative rounded-lg overflow-hidden group"
                        onClick={() => setLightbox(p)}
                      >
                        <StoredImg path={p} className="w-full h-36 object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {sheet.damage.desc ? (
                  <p className="text-sm text-gray-700">{sheet.damage.desc}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No description</p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(sheet.damage.date).toLocaleString("de-DE")}
                </p>
                {isExisting(sheet.damage) ? (
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={async () => {
                      if (!sheet.damage) return;
                      if (!confirm("Mark this damage as repaired? It will stop showing on new rentals.")) return;
                      await markDamageRepaired(sheet.damage.id);
                      setSheet(null);
                      onRepaired?.(sheet.damage.id);
                    }}
                  >
                    Mark as repaired
                  </Button>
                ) : (
                  <Button variant="danger" size="lg" onClick={() => sheet.damage && deleteDamage(sheet.damage.id)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete damage
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
            onClick={() => setLightbox(null)}
          >
            <X className="w-5 h-5 text-white" />
          </button>
          <div onClick={(e) => e.stopPropagation()}>
            <StoredImg path={lightbox} className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
