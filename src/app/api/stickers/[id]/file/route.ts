export async function GET() {
  return Response.json({ error: "Stickers are decrypted only in an unlocked journal." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
