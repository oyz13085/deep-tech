import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const { fieldId, status, disease, severity } = await req.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are an expert agronomist specializing in oil palm plantations in Malaysia.
Field compartment ${fieldId} has status: ${status}. Disease detected: ${disease}. Severity: ${severity}%.
Provide exactly ONE concise actionable recommendation sentence for the plantation manager.
Be specific to the disease and severity. Do not add any preamble or explanation.`;

  const stream = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
