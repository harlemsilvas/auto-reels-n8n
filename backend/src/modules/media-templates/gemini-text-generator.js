const {
  recordCredentialUsage,
  selectCredential,
} = require("../ai-credentials/ai-credentials.service");

const GEMINI_MODELS_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_ATTEMPTS = 3;

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
}

function normalizeHashtag(value) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.startsWith("#") ? text : `#${text.replace(/^#+/, "")}`;
}

function extractJsonObject(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : raw;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function buildPrompt(template, input = {}) {
  const publishType = normalizeText(input.publishType ?? input.publish_type) ?? "feed_image";
  const tone = normalizeText(input.tone) ?? "comercial direto, claro e persuasivo";
  const objective =
    normalizeText(input.objective) ??
    "gerar interesse, explicar valor do produto e incentivar contato para compra";
  const cta =
    normalizeText(input.cta) ??
    normalizeText(template.defaultCta) ??
    "Chame no direct e consulte a aplicação correta para sua moto.";
  const title = normalizeText(input.title);
  const baseHashtags = uniqueStrings(
    (template.baseHashtags ?? [])
      .map(normalizeHashtag)
      .filter(Boolean),
  ).slice(0, 15);

  const systemInstruction = [
    "Você é um assistente de marketing para Instagram no Brasil.",
    "Gere texto comercial em português do Brasil para uma postagem de motopeças.",
    "Não invente compatibilidades, certificações, promessas técnicas ou resultados não informados.",
    "Respeite claims proibidos e não faça afirmações absolutas de segurança.",
    "A saída deve ser somente JSON válido, sem markdown, sem comentários e sem texto fora do JSON.",
  ].join("\n");

  const payload = {
    tarefa: "Criar variação de texto para postagem Instagram. Não publicar automaticamente.",
    formato_saida: {
      title: "string curta opcional, até 90 caracteres",
      caption: "string com legenda completa, com quebras de linha",
      hashtags: ["array de hashtags, com #, sem duplicar"],
      cta: "string curta de chamada para ação",
    },
    regras: [
      "Retornar apenas JSON válido.",
      "Manter revisão humana obrigatória.",
      "Não incluir preço se não foi informado.",
      "Não mencionar estoque, urgência ou promoção se não estiver na descrição/notas.",
      "Usar no máximo 15 hashtags.",
    ],
    entrada: {
      tag: template.tag,
      nome_modelo: template.name,
      marca: template.brand,
      produto: template.productName,
      tipo_publicacao: publishType,
      tom: tone,
      objetivo: objective,
      titulo_sugerido: title,
      descricao_base: template.baseDescription,
      publico_alvo: template.targetAudience,
      claims_permitidos: template.allowedClaims ?? [],
      claims_proibidos: template.forbiddenClaims ?? [],
      cta_preferencial: cta,
      hashtags_base: baseHashtags,
      observacoes: template.notes,
    },
  };

  return {
    publishType,
    tone,
    objective,
    cta,
    title,
    prompt: JSON.stringify(payload, null, 2),
    systemInstruction,
  };
}

function classifyGeminiError(status, body) {
  const message =
    body?.error?.message ??
    body?.message ??
    (typeof body === "string" ? body : null) ??
    `Gemini retornou HTTP ${status}.`;
  const code = body?.error?.status ?? body?.error?.code ?? `HTTP_${status}`;

  if (status === 401 || status === 403 || status === 404) {
    return { code: String(code), message, markStatus: "expired" };
  }
  if (status === 429) {
    return { code: String(code), message, markStatus: "limited" };
  }
  return { code: String(code), message, markStatus: null };
}

function buildGenerateContentUrl(model) {
  const modelName = String(model ?? "").trim().replace(/^models\//, "");
  return `${GEMINI_MODELS_BASE_URL}/${encodeURIComponent(modelName)}:generateContent`;
}

function extractGenerateContentText(body) {
  const parts = body?.candidates?.[0]?.content?.parts ?? [];
  return normalizeText(
    parts
      .map((part) => part?.text)
      .filter(Boolean)
      .join("\n"),
  );
}

async function callGeminiGenerateContent(credential, request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(buildGenerateContentUrl(credential.model), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": credential.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: request.systemInstruction }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
        },
      }),
    });

    const responseText = await response.text();
    let body = null;
    try {
      body = responseText ? JSON.parse(responseText) : null;
    } catch {
      body = responseText;
    }

    if (!response.ok) {
      const geminiError = classifyGeminiError(response.status, body);
      const error = new Error(geminiError.message);
      error.code = geminiError.code;
      error.markStatus = geminiError.markStatus;
      error.status = response.status;
      error.responseBody = body;
      throw error;
    }

    const outputText = extractGenerateContentText(body);
    if (!outputText) {
      const error = new Error("Gemini não retornou texto em candidates[0].content.parts.");
      error.code = "EMPTY_OUTPUT";
      error.responseBody = body;
      throw error;
    }

    return { outputText, responseBody: body };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Tempo limite ao chamar Gemini.");
      timeoutError.code = "TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildDraftFromGemini(template, request, geminiResult, credential) {
  const parsed = extractJsonObject(geminiResult.outputText);

  if (!parsed || typeof parsed !== "object") {
    const error = new Error("Gemini retornou texto que não é JSON válido.");
    error.code = "INVALID_JSON_OUTPUT";
    error.outputText = geminiResult.outputText;
    throw error;
  }

  const title = normalizeText(parsed.title) ?? request.title ?? template.name;
  const caption = normalizeText(parsed.caption);
  const hashtags = uniqueStrings(
    (Array.isArray(parsed.hashtags) ? parsed.hashtags : [])
      .map(normalizeHashtag)
      .filter(Boolean),
  ).slice(0, 15);
  const cta = normalizeText(parsed.cta) ?? request.cta;

  if (!caption) {
    const error = new Error("Gemini retornou JSON sem legenda.");
    error.code = "MISSING_CAPTION";
    throw error;
  }

  return {
    publishType: request.publishType,
    tone: request.tone,
    objective: request.objective,
    title,
    caption,
    hashtags,
    cta,
    promptSent: request.prompt,
    aiResponse: JSON.stringify(
      {
        mode: "gemini",
        provider: "gemini",
        credentialId: credential.id,
        model: credential.model,
        generatedAt: new Date().toISOString(),
        outputText: geminiResult.outputText,
        response: geminiResult.responseBody,
        parsed,
        guardrails: {
          requiresHumanApproval: true,
          forbiddenClaims: template.forbiddenClaims ?? [],
        },
      },
      null,
      2,
    ),
    status: "generated",
  };
}

async function generateGeminiTextDraft(template, input = {}) {
  const request = buildPrompt(template, input);
  const attemptedCredentialIds = [];
  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const credential = await selectCredential({
      workspaceId: template.workspaceId,
      provider: "gemini",
      task: "media_templates_text",
      excludeIds: attemptedCredentialIds,
    });

    if (!credential) break;
    attemptedCredentialIds.push(credential.id);

    try {
      await recordCredentialUsage(credential.id, {
        eventType: "selected",
        success: false,
        details: { attempt: attempt + 1, task: "media_templates_text" },
      });

      const geminiResult = await callGeminiGenerateContent(credential, request);
      const draft = buildDraftFromGemini(template, request, geminiResult, credential);

      await recordCredentialUsage(credential.id, {
        eventType: "request_success",
        success: true,
        details: { attempt: attempt + 1, model: credential.model },
      });

      return draft;
    } catch (error) {
      lastError = error;
      await recordCredentialUsage(credential.id, {
        eventType:
          error.markStatus === "limited"
            ? "rate_limited"
            : error.markStatus === "expired"
              ? "expired"
              : "request_error",
        success: false,
        errorCode: error.code ?? error.status ?? "GEMINI_ERROR",
        errorMessage: error.message,
        markStatus: error.markStatus ?? null,
        details: {
          attempt: attempt + 1,
          model: credential.model,
          responseBody: error.responseBody ?? null,
          outputText: error.outputText ?? null,
        },
      });

      if (!error.markStatus) {
        break;
      }
    }
  }

  const finalError = new Error(
    lastError?.message ?? "Nenhuma credencial Gemini ativa disponível para gerar texto.",
  );
  finalError.status = lastError?.status === 429 ? 429 : 503;
  finalError.code = lastError?.code ?? "NO_GEMINI_CREDENTIAL";
  throw finalError;
}

module.exports = {
  generateGeminiTextDraft,
};
