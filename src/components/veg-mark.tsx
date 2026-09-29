/** The familiar Indian food label: green square for veg, brown for non-veg. */
export default function VegMark({ veg }: { veg: boolean }) {
  return (
    <span
      title={veg ? "Veg" : "Non-veg"}
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${veg ? "border-green-600" : "border-amber-800"}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${veg ? "bg-green-600" : "bg-amber-800"}`} />
    </span>
  );
}
