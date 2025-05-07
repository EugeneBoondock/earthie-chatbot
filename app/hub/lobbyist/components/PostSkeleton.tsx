import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';

export default function PostSkeleton() {
  return (
    <Card className="animate-pulse bg-gradient-to-br from-earthie-dark/60 to-earthie-dark-light/40 border border-sky-400/10 mb-4">
      <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-sky-900/40" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-sky-900/40 rounded" />
          <div className="h-2 w-1/4 bg-sky-900/30 rounded" />
        </div>
      </CardHeader>
      <CardContent className="px-4 py-2">
        <div className="h-4 w-2/3 bg-sky-900/30 rounded mb-2" />
        <div className="h-3 w-full bg-sky-900/20 rounded mb-1" />
        <div className="h-3 w-5/6 bg-sky-900/20 rounded" />
      </CardContent>
      <CardFooter className="px-4 py-3 flex gap-2">
        <div className="h-7 w-16 bg-sky-900/20 rounded" />
        <div className="h-7 w-16 bg-sky-900/20 rounded" />
      </CardFooter>
    </Card>
  );
}
