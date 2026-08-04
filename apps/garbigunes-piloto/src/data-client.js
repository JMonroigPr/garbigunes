const HEALTH_ENDPOINT = "/api/health";

export async function getDataHealth() {
  const response = await fetch(HEALTH_ENDPOINT, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "No se pudo consultar el estado de Supabase.");
  }

  return response.json();
}
