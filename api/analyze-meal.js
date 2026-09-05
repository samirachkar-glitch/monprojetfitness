const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'items'],
  properties: {
    summary: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'qty', 'kcal', 'p', 'c', 'f', 'confidence'],
        properties: {
          name: { type: 'string' },
          qty: { type: 'number' },
          kcal: { type: 'number' },
          p: { type: 'number' },
          c: { type: 'number' },
          f: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
        }
      }
    }
  }
};

function reply(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function friendlyOpenAIError(status, data) {
  const code = data?.error?.code || data?.error?.type || '';
  const raw = String(data?.error?.message || '').trim();

  if (status === 401) {
    return 'Clé OpenAI refusée (401). Vérifie OPENAI_API_KEY dans Vercel puis redéploie.';
  }
  if (status === 403) {
    return 'Accès OpenAI refusé (403). Vérifie les autorisations du projet API associé à la clé.';
  }
  if (status === 429) {
    if (/quota|billing|credit|insufficient/i.test(raw + ' ' + code)) {
      return 'Quota/crédit OpenAI insuffisant (429). Vérifie Billing et le projet associé à la clé.';
    }
    return 'Limite OpenAI atteinte temporairement (429). Réessaie dans quelques instants.';
  }
  if (status === 400) {
    // Le message 400 est utile pour diagnostiquer un paramètre ou schéma invalide.
    return `Requête OpenAI invalide (400)${raw ? ' : ' + raw.slice(0, 500) : '.'}`;
  }
  if (status >= 500) {
    return `Service OpenAI temporairement indisponible (${status}). Réessaie dans quelques instants.`;
  }
  return `OpenAI a refusé la demande (${status})${code ? ` — ${code}` : ''}.`;
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }
  return '';
}

export async function POST(request) {
  const API_KEY = process.env.OPENAI_API_KEY;
  const MODEL = process.env.OPENAI_MODEL || 'gpt-5-mini';

  if (!API_KEY) {
    return reply({ error: 'Connexion IA non configurée : OPENAI_API_KEY est absente dans Vercel.', diagnostic: 'missing_api_key' }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return reply({ error: 'Requête invalide envoyée par l’application.', diagnostic: 'invalid_json' }, 400);
  }

  const meal = String(input?.meal || '').trim();
  if (!meal) return reply({ error: 'Décris le repas à analyser.' }, 400);
  if (meal.length > 3000) return reply({ error: 'Description trop longue (maximum 3000 caractères).' }, 400);

  const prompt = `Analyse ce repas pour un journal nutritionnel en français. Sépare les principaux aliments. Quand une quantité est donnée avec une unité domestique (par exemple 1 pomme, 1/2 avocat, 1 cuillère), estime son poids ou volume de façon raisonnable. Pour chaque aliment, donne les valeurs TOTALES correspondant à la quantité consommée : calories (kcal), protéines p (g), glucides c (g), lipides f (g). qty doit être la quantité estimée en g ou ml. confidence vaut high, medium ou low. Les valeurs sont des estimations nutritionnelles, pas des mesures médicales.\n\nRepas : ${meal}`;

  let r;
  let data;
  try {
    r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        max_output_tokens: 1600,
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'meal_nutrition',
            strict: true,
            schema
          }
        }
      })
    });

    const rawText = await r.text();
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { error: { message: rawText.slice(0, 500) || 'Réponse non JSON.' } };
    }
  } catch (err) {
    console.error('OpenAI network error', err);
    return reply({
      error: 'Impossible de joindre OpenAI depuis Vercel.',
      diagnostic: 'network_error'
    }, 502);
  }

  if (!r.ok) {
    console.error('OpenAI error', r.status, data?.error?.code || data?.error?.type || 'unknown');
    return reply({
      error: friendlyOpenAIError(r.status, data),
      diagnostic: data?.error?.code || data?.error?.type || `openai_http_${r.status}`,
      openaiStatus: r.status,
      model: MODEL
    }, r.status >= 500 ? 502 : r.status);
  }

  const text = extractOutputText(data);
  if (!text) {
    console.error('OpenAI empty output', data?.status, data?.incomplete_details || '');
    return reply({
      error: 'OpenAI a répondu, mais sans résultat nutritionnel exploitable.',
      diagnostic: data?.status === 'incomplete' ? 'incomplete_response' : 'empty_output',
      model: MODEL
    }, 502);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error('OpenAI invalid JSON output');
    return reply({
      error: 'La réponse OpenAI n’a pas pu être lue comme bilan nutritionnel.',
      diagnostic: 'invalid_model_json',
      model: MODEL
    }, 502);
  }

  if (!Array.isArray(parsed?.items) || !parsed.items.length) {
    return reply({ error: 'Aucun aliment reconnu dans la réponse IA.', diagnostic: 'no_items', model: MODEL }, 422);
  }

  // Normalisation défensive : évite qu’une valeur inattendue casse le journal local.
  parsed.items = parsed.items.slice(0, 30).map(x => ({
    name: String(x?.name || 'Aliment'),
    qty: Math.max(0, Number(x?.qty) || 0),
    kcal: Math.max(0, Number(x?.kcal) || 0),
    p: Math.max(0, Number(x?.p) || 0),
    c: Math.max(0, Number(x?.c) || 0),
    f: Math.max(0, Number(x?.f) || 0),
    confidence: ['high', 'medium', 'low'].includes(x?.confidence) ? x.confidence : 'medium'
  }));

  return reply({ ...parsed, model: MODEL });
}

export function GET() {
  return reply({
    ok: true,
    service: 'analyse nutritionnelle IA',
    configured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-5-mini'
  });
}
