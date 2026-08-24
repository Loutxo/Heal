import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { matchDetectedFoodsToCatalog, type CatalogFood } from "../_shared/food-photo-logic.ts";
import { fetchSubscriptionAccess } from "../_shared/subscription-logic.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

const CATEGORY_LEGUMES = 2;
const CATEGORY_FRUITS = 3;

const MEAL_PROMPT =
  "Identifie tous les aliments visibles dans cette photo de repas (assiette, plat). Réponds avec un tableau de noms d'aliments en français, au singulier, un nom simple et générique par ingrédient reconnaissable (ex: \"poulet\", \"riz\", \"brocoli\"), sans quantités ni description de la préparation. N'invente rien : si un aliment n'est pas identifiable avec confiance, ne le liste pas.";

const FRIDGE_PROMPT =
  "Identifie uniquement les fruits et légumes visibles sur cette photo (frigo, plan de travail, panier). Réponds avec un tableau de noms de fruits ou légumes en français, au singulier (ex: \"carotte\", \"pomme\"). Ignore tout aliment qui n'est pas un fruit ou un légume (viandes, produits laitiers, épicerie, etc.). N'invente rien : si un item n'est pas identifiable avec confiance, ne le liste pas.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST uniquement" } }, 405);

  if (!GEMINI_API_KEY) {
    return json({ error: { code: "MISSING_API_KEY", message: "GEMINI_API_KEY n'est pas configurée côté serveur." } }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: { code: "UNAUTHENTICATED", message: "Authorization manquant" } }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: { code: "UNAUTHENTICATED", message: "Session invalide" } }, 401);
  const userId = userData.user.id;

  if (!(await fetchSubscriptionAccess(supabase, userId))) {
    return json({ error: { code: "SUBSCRIPTION_REQUIRED", message: "Un abonnement actif est requis pour cette action." } }, 402);
  }

  let body: { photo_path?: string; context?: "meal" | "fridge"; mime_type?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore
  }
  const photoPath = body.photo_path;
  const context = body.context === "fridge" ? "fridge" : "meal";
  const mimeType = body.mime_type ?? "image/jpeg";

  if (!photoPath) return json({ error: { code: "MISSING_PHOTO_PATH", message: "photo_path requis" } }, 400);
  if (!photoPath.startsWith(`${userId}/`)) {
    return json({ error: { code: "FORBIDDEN", message: "Ce chemin de photo ne vous appartient pas." } }, 403);
  }

  const { data: photoBlob, error: downloadError } = await supabase.storage.from("meal-photos").download(photoPath);
  if (downloadError || !photoBlob) {
    return json({ error: { code: "PHOTO_NOT_FOUND", message: downloadError?.message ?? "Photo introuvable." } }, 404);
  }

  const base64Data = arrayBufferToBase64(await photoBlob.arrayBuffer());

  const responseSchema = {
    type: "object",
    properties: {
      detected_foods: { type: "array", items: { type: "string" } },
    },
    required: ["detected_foods"],
  };

  const geminiResponse = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: context === "fridge" ? FRIDGE_PROMPT : MEAL_PROMPT }, { inline_data: { mime_type: mimeType, data: base64Data } }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.2 },
      }),
    }
  );

  if (!geminiResponse.ok) {
    const errText = await geminiResponse.text();
    console.error("GEMINI_ERROR", geminiResponse.status, errText.slice(0, 1000));
    return json({ error: { code: "GEMINI_ERROR", message: `Erreur Gemini API (${geminiResponse.status}): ${errText.slice(0, 400)}` } }, 502);
  }

  const geminiJson = await geminiResponse.json();
  const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    console.error("GEMINI_EMPTY", JSON.stringify(geminiJson).slice(0, 1000));
    return json({ error: { code: "GEMINI_EMPTY", message: "Réponse vide de Gemini." } }, 502);
  }

  let parsed: { detected_foods: string[] };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return json({ error: { code: "PARSE_ERROR", message: "Réponse Gemini non parsable." } }, 502);
  }

  let catalogQuery = supabase.from("foods").select("id, name, name_variants").eq("is_active", true);
  if (context === "fridge") {
    catalogQuery = catalogQuery.in("category_id", [CATEGORY_LEGUMES, CATEGORY_FRUITS]);
  }
  const { data: catalog, error: catalogError } = await catalogQuery;
  if (catalogError || !catalog) {
    return json({ error: { code: "CATALOG_ERROR", message: catalogError?.message ?? "Erreur de lecture du catalogue." } }, 500);
  }

  const { matched, unmatched } = matchDetectedFoodsToCatalog(parsed.detected_foods, catalog as CatalogFood[]);

  return json({ detected_foods: parsed.detected_foods, matched, unmatched, photo_path: photoPath }, 200);
});

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}
