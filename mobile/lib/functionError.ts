// supabase-js ne parse pas automatiquement le corps JSON d'une réponse d'Edge Function non-2xx
// dans `data` — sur une erreur, `data` reste null et `error` est un FunctionsHttpError dont le
// seul message générique est "Edge Function returned a non-2xx status code". Le vrai message
// ({ error: { code, message } }) qu'on écrit côté serveur reste accessible uniquement via
// `error.context` (le Response brut). Ce bug silencieux touchait tous les écrans appelant
// functions.invoke() dans l'app — ce helper centralise la bonne façon de lire l'erreur réelle.
export async function parseFunctionError(fnError: unknown): Promise<{ code?: string; message: string } | null> {
  if (!fnError) return null;
  const err = fnError as { context?: Response; message?: string };
  if (err.context && typeof err.context.json === 'function') {
    try {
      const body = await err.context.clone().json();
      if (body?.error?.message) return { code: body.error.code, message: body.error.message };
    } catch {
      // corps non-JSON ou déjà consommé — on retombe sur le message générique du SDK
    }
  }
  return { message: err.message ?? 'Une erreur est survenue.' };
}
