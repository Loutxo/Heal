// Construction pure des messages de l'API push Expo — testable sans réseau. L'envoi réel
// (fetch vers exp.host) reste dans chaque Edge Function, qui appelle sendExpoPush().

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data?: Record<string, unknown>;
};

// Un utilisateur peut avoir plusieurs appareils (plusieurs tokens) — un message par token,
// tokens dédupliqués pour éviter d'envoyer deux fois la même notif au même appareil.
export function buildPushMessages(tokens: string[], title: string, body: string, data?: Record<string, unknown>): ExpoPushMessage[] {
  const uniqueTokens = [...new Set(tokens.filter((t) => t.startsWith("ExponentPushToken")))];
  return uniqueTokens.map((to) => ({ to, title, body, sound: "default" as const, ...(data ? { data } : {}) }));
}

// Effet de bord réseau (non testé unitairement, comme les autres appels I/O des Edge Functions) —
// Expo recommande des lots de 100 messages max par requête.
export async function sendExpoPushBatch(messages: ExpoPushMessage[]): Promise<void> {
  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      console.error("EXPO_PUSH_ERROR", res.status, await res.text());
    }
  }
}
