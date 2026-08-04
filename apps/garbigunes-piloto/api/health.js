const RELATION = "v_public_flujos_salidas_mensual";

export default async function handler(_request, response) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return response.status(503).json({ message: "Supabase no está configurado en este entorno." });
  }

  try {
    const upstream = await fetch(`${url}/rest/v1/${RELATION}?select=month_key&limit=1`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Accept-Profile": "analytics",
      },
    });
    if (!upstream.ok) {
      return response.status(502).json({ message: "No se pudo consultar la vista pública de Supabase." });
    }
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ relation: RELATION, status: "ready" });
  } catch (_error) {
    return response.status(502).json({ message: "No se pudo conectar con Supabase." });
  }
}
