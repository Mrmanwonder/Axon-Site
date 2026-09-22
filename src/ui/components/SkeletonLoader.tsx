import PageSkeleton, { type PageSkeletonVariant } from "./PageSkeleton";

export default function SkeletonLoader({
  label = "Loading Axon",
  variant = "home",
}: {
  label?: string;
  variant?: PageSkeletonVariant;
}) {
  return <PageSkeleton variant={variant} label={label} standalone />;
}
