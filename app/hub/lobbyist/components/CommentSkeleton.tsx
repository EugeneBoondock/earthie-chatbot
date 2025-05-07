export default function CommentSkeleton() {
  return (
    <div className="flex items-start gap-2 animate-pulse mb-2">
      <div className="h-6 w-6 rounded-full bg-sky-900/40" />
      <div className="flex-1">
        <div className="h-3 w-1/3 bg-sky-900/30 rounded mb-1" />
        <div className="h-2 w-2/3 bg-sky-900/20 rounded" />
      </div>
    </div>
  );
}
