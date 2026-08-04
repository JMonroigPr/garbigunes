const HEALTH_ENDPOINT = "/api/health";
const FLOWS_ENDPOINT = "/api/flows";

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

export async function getFlows(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      params.set(key, value.join(","));
      if (key === "wastes" && !value.length) params.set("wastes_mode", "none");
    }
    if (typeof value === "string" && value) params.set(key, value);
  });
  const response = await fetch(`${FLOWS_ENDPOINT}?${params}`, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || "No se pudieron cargar los flujos.");
  }
  return response.json();
}
