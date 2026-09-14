export function DriverLoading({ message = 'جارٍ تحميل العمل…' }: { message?: string }) {
  return (
    <section className="driver-loading" role="status" aria-label={message}>
      <p>{message}</p>
      <div className="driver-loading-card" aria-hidden="true">
        <span className="driver-loading-line driver-loading-line-short" />
        <span className="driver-loading-line" />
        <span className="driver-loading-line driver-loading-line-medium" />
      </div>
      <div className="driver-loading-card" aria-hidden="true">
        <span className="driver-loading-line driver-loading-line-short" />
        <span className="driver-loading-line" />
        <span className="driver-loading-line driver-loading-line-medium" />
      </div>
    </section>
  );
}
