import Link from "next/link";
export function Brand({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="MoodGrid home">
    <span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
    <span>Mood<span className="font-normal">Grid</span><span className="text-mint">.</span></span>
  </Link>;
}
