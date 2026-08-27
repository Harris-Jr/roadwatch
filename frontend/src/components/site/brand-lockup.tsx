import logoAsset from "@/assets/logo-pothole.png.asset.json";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, { img: string; title: string; caption: string; gap: string }> = {
  sm: { img: "h-9 w-9", title: "text-[15px]", caption: "text-[9px]", gap: "gap-2.5" },
  md: { img: "h-11 w-11", title: "text-lg", caption: "text-[10px]", gap: "gap-3" },
  lg: { img: "h-16 w-16", title: "text-2xl", caption: "text-xs", gap: "gap-3" },
};

export function BrandLockup({
  size = "sm",
  caption = "Road intelligence",
  className = "",
}: {
  size?: Size;
  caption?: string;
  className?: string;
}) {
  const s = sizes[size];
  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <img
        src={logoAsset.url}
        alt="RoadWatch Zambia"
        className={`${s.img} shrink-0 object-contain`}
      />
      <div className="leading-tight">
        <div className={`font-display font-extrabold tracking-tight ${s.title}`}>
          <span className="text-ink">RoadWatch</span>{" "}
          <span className="text-primary">Zambia</span>
        </div>
        <div className={`font-bold uppercase tracking-[0.14em] text-muted-foreground ${s.caption}`}>
          {caption}
        </div>
      </div>
    </div>
  );
}
