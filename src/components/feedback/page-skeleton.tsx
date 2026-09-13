export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-label="جارٍ تحميل الصفحة">
      <span className="sr-only">جارٍ تحميل الصفحة</span>
      <div className="skeleton" style={{ width: '32%' }} />
      <div className="skeleton-stat-grid">
        {[1, 2, 3, 4].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
      <div className="skeleton skeleton-panel" />
    </div>
  );
}
