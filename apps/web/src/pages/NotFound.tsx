import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="card">
      <h2>Page not found</h2>
      <Link to="/">Back to dashboard</Link>
    </div>
  );
}
