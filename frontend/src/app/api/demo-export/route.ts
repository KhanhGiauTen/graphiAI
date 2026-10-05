import snapshots from "@/data/public-demo.json"

export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const dataset = snapshots.find((item) => item.id === params.get("dataset"))
  const variant = dataset?.variants.find((item) => item.schema.id === params.get("schema"))

  if (!dataset || !variant) {
    return Response.json({ error: "Unknown public fixture or schema" }, { status: 404 })
  }

  return new Response(JSON.stringify(variant, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="graphify-${dataset.id}-${variant.schema.id}.json"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
