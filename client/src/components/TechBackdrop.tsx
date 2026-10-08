/** Warm atmospheric backdrop — pointer-events none */
export function TechBackdrop() {
  return (
    <div className="tech-backdrop" aria-hidden="true">
      <div className="tech-backdrop__glow tech-backdrop__glow--amber" />
      <div className="tech-backdrop__glow tech-backdrop__glow--coral" />
      <div className="tech-backdrop__glow tech-backdrop__glow--gold" />
      <div className="tech-backdrop__dust" />
    </div>
  );
}
