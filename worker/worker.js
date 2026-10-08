// BookDNA proxy. Holds the Anthropic API key so visitors don't need their own.
//
// The browser sends book data, never a prompt. Prompts are built here, so this
// endpoint can only classify books or recommend books. It can't be used as a
// general-purpose free Claude endpoint.
//
// Endpoints:
//   POST /classify   { books: [{title, author}, ...] }        -> { map: {"0": "Genre", ...} }
//   POST /recommend  { genre, books: [...], readTitles: [...] } -> { recs: [{title, author, why}, ...] }

const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001';
const RECOMMEND_MODEL = 'claude-sonnet-4-6';

const GENRES = [
  'Literary Fiction', 'Mystery & Thriller', 'Sci-Fi & Speculative', 'Fantasy & Magic',
  'Biography & Memoir', 'History', 'Business & Finance', 'Self-Help & Growth',
  'Psychology', 'Philosophy', 'Science & Nature', 'Romance', 'Graphic & Comics',
  'Young Adult', 'Politics & Society', 'Travel & Adventure', 'Art & Culture',
  'Spirituality', 'Technology', 'Humor & Satire', 'Horror', 'Poetry & Essays',
  'Health & Wellness', 'Food & Cooking', 'General Fiction',
];

// Input caps keep a single request from getting expensive.
const MAX_CLASSIFY_BOOKS = 1500;
const MAX_REC_BOOKS = 12;
const MAX_READ_TITLES = 2000;
const MAX_FIELD = 200;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigins(env);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403);

    if (env.LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'Too many requests. Wait a minute and try again.' }, 429);
    }

    let body;
    try { body = await request.json(); } catch (_) { return json({ error: 'Bad JSON' }, 400); }

    const path = new URL(request.url).pathname;
    try {
      if (path === '/classify') return json(await classify(body, env));
      if (path === '/recommend') return json(await recommend(body, env));
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      return json({ error: err.message || 'Upstream error' }, err.status || 502);
    }
  },
};

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || 'https://dblasing.github.io')
    .split(',').map(s => s.trim()).filter(Boolean);
}

function clip(s) { return String(s || '').replace(/[\r\n|]+/g, ' ').slice(0, MAX_FIELD); }

function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }

async function classify(body, env) {
  const books = Array.isArray(body.books) ? body.books.slice(0, MAX_CLASSIFY_BOOKS) : [];
  if (!books.length) throw badRequest('No books');

  const lines = books.map((b, i) => `${i}|${clip(b.title)}|${clip(b.author)}`).join('\n');
  const prompt =
    `You are a book genre classifier. Classify each book into EXACTLY one genre from this list:\n` +
    `${GENRES.join(', ')}\n\n` +
    `Books (format: index|title|author):\n${lines}\n\n` +
    `Respond ONLY with a JSON object mapping each index (as string) to the genre label. ` +
    `No markdown, no explanation. Example: {"0":"Mystery & Thriller","1":"Biography & Memoir"}`;

  // ~12 output tokens per book, sized for the worst case, not the average.
  const maxTokens = Math.min(16000, Math.max(1024, books.length * 14));
  const raw = await callClaude(env, CLASSIFY_MODEL, maxTokens, prompt);
  const clean = raw.replace(/```json|```/g, '').trim();
  const s = clean.indexOf('{'), e = clean.lastIndexOf('}');
  if (s < 0 || e < 0) throw new Error('Classifier returned no JSON');
  return { map: JSON.parse(clean.slice(s, e + 1)) };
}

async function recommend(body, env) {
  const genre = String(body.genre || '');
  if (!GENRES.includes(genre)) throw badRequest('Unknown genre');
  const books = Array.isArray(body.books) ? body.books.slice(0, MAX_REC_BOOKS) : [];
  if (!books.length) throw badRequest('No books');
  const readTitles = Array.isArray(body.readTitles) ? body.readTitles.slice(0, MAX_READ_TITLES) : [];

  const titles = books.map(b => `"${clip(b.title)}" by ${clip(b.author)}`).join(', ');
  const allRead = readTitles.map(t => `"${clip(t)}"`).join(', ');

  const prompt =
    `You are an expert book recommender. ` +
    `A reader's ${genre} reading history: ${titles}. ` +
    `Books they have ALREADY READ — do NOT suggest any of these: ${allRead}. ` +
    `Recommend exactly 5 books NOT in the above list that deeply match their taste. ` +
    `CRITICAL: Only recommend books you are 100% certain exist and have been published. ` +
    `Do NOT invent titles, authors, or series. Do NOT combine real author names with fake titles. ` +
    `Stick to well-known, widely reviewed published works only. ` +
    `Respond ONLY with a raw JSON array — no markdown, no code fences, no preamble. ` +
    `Each element: {"title":"...","author":"...","why":"one sentence why they will love it"}`;

  const raw = await callClaude(env, RECOMMEND_MODEL, 2048, prompt);
  let recs = [];
  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const s = clean.indexOf('['), e = clean.lastIndexOf(']');
    if (s > -1 && e > s) recs = JSON.parse(clean.slice(s, e + 1));
  } catch (_) { recs = []; }
  return { recs };
}

async function callClaude(env, model, maxTokens, prompt) {
  if (!env.ANTHROPIC_API_KEY) throw new Error('Server is missing its API key');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    const e = new Error(err?.error?.message || `Anthropic HTTP ${resp.status}`);
    e.status = 502;
    throw e;
  }
  const data = await resp.json();
  return (data.content || []).map(c => c.text || '').join('');
}
