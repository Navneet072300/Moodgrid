// Uploads now go directly to private storage AFTER browser-side encryption.
export async function POST() {
  return Response.json({ error: "This upload endpoint is retired. Unlock your journal and upload from the updated app." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
