"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main className="page-shell"><div className="card error-card"><span className="text-5xl">🌧️</span><h1>A small pause.</h1><p>We couldn’t load this page. Please try again in a moment.</p><button className="button-primary" onClick={reset}>Try again</button><Link className="text-link" href="/">Return home</Link></div></main>; }
