export function SvgBarcode({ value }: { value: string }) {
  const cleanVal = (value || "ALOHA").toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const bars: number[] = [];
  let seed = 0;
  for (let i = 0; i < cleanVal.length; i++) {
    seed = (seed + cleanVal.charCodeAt(i) * (i + 1)) % 1000;
  }
  for (let i = 0; i < 48; i++) {
    bars.push((seed + i * 17) % 3 === 0 ? 3 : (seed + i * 7) % 2 === 0 ? 2 : 1);
  }

  return (
    <div className="flex flex-col items-center">
      <svg className="h-10 w-44" viewBox="0 0 180 40" preserveAspectRatio="none">
        {bars.map((w, idx) => {
          const x = idx * 3.6;
          const isBlack = idx % 2 === 0 || idx % 5 === 0;
          return isBlack ? (
            <rect key={idx} x={x} y="0" width={w} height="36" fill="#000" />
          ) : null;
        })}
      </svg>
      <span className="text-[10px] tracking-widest font-mono text-black font-bold -mt-0.5">
        {cleanVal}
      </span>
    </div>
  );
}
