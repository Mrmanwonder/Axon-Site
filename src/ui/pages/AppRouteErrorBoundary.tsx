import { Link } from "react-router-dom";
export default function AppRouteErrorBoundary() {
  return <main><h1>This page could not open</h1><p>Something went wrong while loading this view. Please try again.</p><button onClick={() => location.reload()}>Reload page</button><Link to="/">Go home</Link></main>;
}
