import { useEffect, useState } from "react";
export default function DelayedLoading({ label = "Loading…" }: { label?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setVisible(true), 200); return () => clearTimeout(timer); }, []);
  return visible ? <div role="status" className="subnote">{label}</div> : null;
}
