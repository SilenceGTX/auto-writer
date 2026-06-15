/** Placeholder page for sections not yet implemented. */
interface Props {
  title: string;
}

function PlaceholderPage({ title }: Props) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p className="placeholder-hint">此功能正在开发中…</p>
    </div>
  );
}

export default PlaceholderPage;
