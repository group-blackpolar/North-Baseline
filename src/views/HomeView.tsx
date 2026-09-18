export function HomeView() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-display font-bold text-text">Home</h1>
      <p className="text-text-secondary">Bienvenido a tu espacio personal en North.</p>
      <div className="np-card p-6">
        <h2 className="text-lg font-semibold text-text mb-2">Actividad reciente</h2>
        <p className="text-sm text-text-secondary">Aún no hay actividad para mostrar.</p>
      </div>
    </div>
  );
}