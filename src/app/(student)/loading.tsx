export default function Loading() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-44 rounded-xl bg-stone-200/60" />
      ))}
    </div>
  );
}
