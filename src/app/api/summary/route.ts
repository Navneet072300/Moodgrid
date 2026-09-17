// Cloud summaries are retired: journal plaintext must stay in the browser.
export async function POST() {
  return Response.json({ error: "Cloud summaries are disabled. Weekly reflections run on your device." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
