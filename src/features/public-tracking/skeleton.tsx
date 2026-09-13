export function TrackingSkeleton() {
  return (
    <div className="tracking-skeleton" role="status" aria-label="جارٍ تحميل حالة الشحنة">
      <span className="sr-only">جارٍ تحميل حالة الشحنة</span>
      <div aria-hidden="true">
        <div className="skeleton tracking-skeleton-title" />
        <div className="skeleton tracking-skeleton-number" />
        <div className="tracking-skeleton-summary">
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
        <div className="tracking-skeleton-events">
          {[0, 1, 2].map((row) => (
            <div className="skeleton" key={row} />
          ))}
        </div>
      </div>
    </div>
  );
}
