export const DEMO_FLOWS = {
  demo: true,
  filters: {
    wastes: [{ name: "Escombros", kg: 2440000 }, { name: "Maderas", kg: 1160000 }, { name: "Rechazo", kg: 835000 }, { name: "Voluminosos", kg: 390000 }, { name: "Plásticos", kg: 220000 }],
    sites: [{ siteKey: "GETXO", garbigune: "GETXO", mobile: false }, { siteKey: "BASAURI", garbigune: "BASAURI", mobile: false }],
    routes: ["GETXO-ERANDIO", "BASAURI-GÜEÑES-ZALLA", "SIN RUTA"],
  },
  kpis: { entryKg: 6200000, outputKg: 5045000, services: 1732, avgKg: 2912 },
  series: [
    ["2025-08", 310000, 128, 401000], ["2025-09", 355000, 142, 435000], ["2025-10", 329000, 136, 410000], ["2025-11", 381000, 145, 462000], ["2025-12", 348000, 133, 423000], ["2026-01", 402000, 151, 489000], ["2026-02", 426000, 154, 520000], ["2026-03", 398000, 149, 492000], ["2026-04", 442000, 160, 545000], ["2026-05", 471000, 168, 573000], ["2026-06", 383000, 142, 450000],
  ].map(([month, outputKg, services, entryKg]) => ({ month, outputKg, services, entryKg, waste: [{ name: "Escombros", kg: outputKg * .48 }, { name: "Maderas", kg: outputKg * .23 }, { name: "Rechazo", kg: outputKg * .16 }, { name: "Voluminosos", kg: outputKg * .08 }, { name: "Plásticos", kg: outputKg * .05 }] })),
  sites: [{ siteKey: "GETXO", garbigune: "GETXO", mobile: false, kg: 905000, services: 289, avgKg: 3131, maxDays: 11 }, { siteKey: "BASAURI", garbigune: "BASAURI", mobile: false, kg: 779000, services: 267, avgKg: 2918, maxDays: 13 }, { siteKey: "SANTURTZI", garbigune: "SANTURTZI", mobile: false, kg: 714000, services: 248, avgKg: 2879, maxDays: 9 }],
  routes: [{ route: "GETXO-ERANDIO", base: "GETXO", kg: 1021000, services: 341, avgKg: 2994, sites: 2 }, { route: "BASAURI-GÜEÑES-ZALLA", base: "BASAURI", kg: 932000, services: 302, avgKg: 3086, sites: 3 }, { route: "SIN RUTA", base: "SIN BASE", kg: 250000, services: 81, avgKg: 3086, sites: 1 }],
  balances: [{ garbigune: "GETXO", familia_aw: "RCD", balance_kg: 241000, coverage_status: "comparable" }, { garbigune: "BASAURI", familia_aw: "MADERA", balance_kg: -120000, coverage_status: "comparable" }],
  insights: [{ level: "info", text: "GETXO concentra la mayor salida del periodo (905,0 t).", action: "Revisar detalle del punto" }, { level: "attention", text: "La mayor diferencia homologada aparece en RCD: 241,0 t.", action: "Contrastar registros y periodos" }, { level: "warning", text: "5,0% de las salidas no tiene ruta normalizada.", action: "Revisar calidad de rutas" }],
};
