export default function TripLoading() {
  return (
    <div className="flex-1 min-w-0 p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-8 w-56 bg-slate-200 rounded-xl" />
          <div className="h-4 w-80 bg-slate-100 rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* Metric / Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="w-8 h-8 rounded-xl bg-slate-100" />
            </div>
            <div className="h-7 w-28 bg-slate-200 rounded-lg" />
            <div className="h-2.5 w-36 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 w-40 bg-slate-200 rounded-lg" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
            <div className="space-y-3 pt-2">
              <div className="h-16 w-full bg-slate-100 rounded-xl" />
              <div className="h-16 w-full bg-slate-100 rounded-xl" />
              <div className="h-16 w-full bg-slate-100 rounded-xl" />
            </div>
          </div>
        </div>

        {/* Right / Sidebar Widget Skeleton */}
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="h-5 w-32 bg-slate-200 rounded-lg" />
            <div className="h-40 w-full bg-slate-100 rounded-xl" />
            <div className="h-4 w-full bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
