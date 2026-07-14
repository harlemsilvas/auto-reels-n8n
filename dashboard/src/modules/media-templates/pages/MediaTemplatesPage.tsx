import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  mediaTemplatesService,
  type CreateTemplateInput,
  type CreateTextVariantInput,
  type MediaTemplate,
  type MediaTemplateStatus,
  type PublishType,
} from "../services/mediaTemplates.service";

const TEMPLATE_INITIAL_FORM = {
  tag: "",
  name: "",
  brand: "",
  productName: "",
  baseDescription: "",
  targetAudience: "",
  allowedClaims: "",
  forbiddenClaims: "",
  defaultCta: "",
  baseHashtags: "",
  notes: "",
  status: "draft" as MediaTemplateStatus,
};

const VARIANT_INITIAL_FORM = {
  publishType: "feed_image" as PublishType,
  tone: "",
  objective: "",
  title: "",
  caption: "",
  hashtags: "",
  cta: "",
};

const POST_INITIAL_FORM = {
  textVariantId: "",
  title: "",
  scheduledAt: "",
};

const MEDIA_INITIAL_FORM = {
  file: null as File | null,
  role: "hero",
  sortOrder: "0",
  notes: "",
};

function splitLines(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    approved: "Aprovado",
    archived: "Arquivado",
    draft: "Rascunho",
    generated: "Gerado",
    rejected: "Rejeitado",
  };

  return labels[status] ?? status;
}

function publishTypeLabel(type: string) {
  const labels: Record<string, string> = {
    feed_carousel: "Carrossel",
    feed_image: "Feed imagem",
    reel: "Reel",
    story_image: "Story imagem",
    story_video: "Story vídeo",
  };

  return labels[type] ?? type;
}

export function MediaTemplatesPage() {
  const { can } = useAuth();
  const canCreate = can("media_templates.create");
  const canCreatePost = can("media_templates.create_post");
  const canUpdate = can("media_templates.update");
  const canApprove = can("media_templates.approve");
  const canGenerateAiText = can("media_templates.generate_ai_text");
  const [templates, setTemplates] = useState<MediaTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedTemplate, setSelectedTemplate] =
    useState<MediaTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState(TEMPLATE_INITIAL_FORM);
  const [variantForm, setVariantForm] = useState(VARIANT_INITIAL_FORM);
  const [postForm, setPostForm] = useState(POST_INITIAL_FORM);
  const [mediaForm, setMediaForm] = useState(MEDIA_INITIAL_FORM);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedVariants = useMemo(
    () => selectedTemplate?.textVariants ?? [],
    [selectedTemplate],
  );
  const approvedVariants = useMemo(
    () => selectedVariants.filter((variant) => variant.status === "approved"),
    [selectedVariants],
  );

  async function loadList() {
    const result = await mediaTemplatesService.list({
      q: q || undefined,
      status: status === "all" ? undefined : status,
      limit: 100,
    });
    setTemplates(result.items);

    if (!selectedId && result.items[0]) {
      setSelectedId(result.items[0].id);
    }
  }

  async function loadSelected(templateId: string) {
    const template = await mediaTemplatesService.get(templateId);
    setSelectedTemplate(template);
  }

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    mediaTemplatesService
      .list({
        q: q || undefined,
        status: status === "all" ? undefined : status,
        limit: 100,
      })
      .then((result) => {
        if (!active) return;
        setTemplates(result.items);
        if (!selectedId && result.items[0]) {
          setSelectedId(result.items[0].id);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar modelos.",
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, selectedId, status]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedTemplate(null);
      return;
    }

    let active = true;
    mediaTemplatesService
      .get(selectedId)
      .then((template) => {
        if (active) setSelectedTemplate(template);
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar detalhes do modelo.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [selectedId]);

  async function refreshSelected() {
    await loadList();
    if (selectedId) {
      await loadSelected(selectedId);
    }
  }

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const input: CreateTemplateInput = {
      tag: templateForm.tag,
      name: templateForm.name,
      brand: templateForm.brand || undefined,
      productName: templateForm.productName || undefined,
      baseDescription: templateForm.baseDescription || undefined,
      targetAudience: templateForm.targetAudience || undefined,
      allowedClaims: splitLines(templateForm.allowedClaims),
      forbiddenClaims: splitLines(templateForm.forbiddenClaims),
      defaultCta: templateForm.defaultCta || undefined,
      baseHashtags: splitLines(templateForm.baseHashtags),
      notes: templateForm.notes || undefined,
      status: templateForm.status,
    };

    try {
      const created = await mediaTemplatesService.create(input);
      setTemplateForm(TEMPLATE_INITIAL_FORM);
      setSelectedId(created.id);
      setMessage("Modelo criado.");
      await refreshSelected();
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Erro ao criar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const input: CreateTextVariantInput = {
      publishType: variantForm.publishType,
      tone: variantForm.tone || undefined,
      objective: variantForm.objective || undefined,
      title: variantForm.title || undefined,
      caption: variantForm.caption,
      hashtags: splitLines(variantForm.hashtags),
      cta: variantForm.cta || undefined,
      status: "generated",
    };

    try {
      await mediaTemplatesService.createTextVariant(selectedId, input);
      setVariantForm(VARIANT_INITIAL_FORM);
      setMessage("Variação de texto criada.");
      await refreshSelected();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Erro ao criar variação.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function generateVariantDraft() {
    if (!selectedId) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await mediaTemplatesService.generateTextVariant(selectedId, {
        publishType: variantForm.publishType,
        tone: variantForm.tone || undefined,
        objective: variantForm.objective || undefined,
        title: variantForm.title || undefined,
        cta: variantForm.cta || undefined,
      });
      setMessage(
        "Sugestão de texto gerada em modo teste. Revise e aprove antes de usar.",
      );
      await refreshSelected();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Erro ao gerar sugestão.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function approveTemplate(templateId: string) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await mediaTemplatesService.approve(templateId);
      setMessage("Modelo aprovado.");
      await refreshSelected();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Erro ao aprovar modelo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function archiveTemplate(templateId: string) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await mediaTemplatesService.archive(templateId);
      setMessage("Modelo arquivado.");
      await refreshSelected();
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Erro ao arquivar modelo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function approveVariant(variantId: string) {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await mediaTemplatesService.approveTextVariant(selectedId, variantId);
      setMessage("Variação aprovada.");
      await refreshSelected();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Erro ao aprovar variação.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function rejectVariant(variantId: string) {
    if (!selectedId) return;
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      await mediaTemplatesService.rejectTextVariant(selectedId, variantId);
      setMessage("Variação rejeitada.");
      await refreshSelected();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Erro ao rejeitar variação.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function createPostFromTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate) return;

    const variant =
      approvedVariants.find((item) => item.id === postForm.textVariantId) ??
      approvedVariants[0];

    if (!variant) {
      setError("Aprove uma variação de texto antes de criar a postagem.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const post = await mediaTemplatesService.createPostFromTag(
        selectedTemplate.tag,
        {
          textVariantId: variant.id,
          publishType: variant.publishType,
          title: postForm.title || undefined,
          scheduledAt: postForm.scheduledAt || undefined,
        },
      );
      setPostForm(POST_INITIAL_FORM);
      setMessage(
        `Postagem criada pela TAG (${post.status}) com ${post.mediaItemsCount} mídia(s).`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Erro ao criar postagem pela TAG.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadTemplateMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTemplate || !mediaForm.file) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const sortOrder = Number.parseInt(mediaForm.sortOrder, 10);

    try {
      await mediaTemplatesService.uploadMedia(selectedTemplate.id, {
        file: mediaForm.file,
        role: mediaForm.role,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        notes: mediaForm.notes || undefined,
      });
      setMediaForm(MEDIA_INITIAL_FORM);
      setMessage("Mídia adicionada ao modelo.");
      await refreshSelected();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Erro ao enviar mídia do modelo.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="panel-stack">
      <article className="panel-card">
        <p className="eyebrow">Biblioteca de campanhas</p>
        <h2>Modelos por TAG</h2>
        <p className="hero-copy">
          Cadastre modelos reutilizáveis, gere sugestões em modo teste, aprove
          textos revisados e prepare o fluxo para criar postagens pela TAG. Nada
          é publicado automaticamente nesta etapa.
        </p>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="upload-success-text">{message}</p> : null}
      </article>

      <article className="panel-card">
        <h2>Buscar modelos</h2>
        <form className="upload-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Busca por TAG, nome, marca ou produto
            <input value={q} onChange={(event) => setQ(event.target.value)} />
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="archived">Arquivado</option>
            </select>
          </label>
        </form>
        {isLoading ? <p>Carregando modelos...</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TAG</th>
                <th>Nome</th>
                <th>Status</th>
                <th>Textos</th>
                <th>Atualizado</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id}>
                  <td>{template.tag}</td>
                  <td>{template.name}</td>
                  <td>{statusLabel(template.status)}</td>
                  <td>{template.textVariantsCount}</td>
                  <td>{formatDate(template.updatedAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setSelectedId(template.id)}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))}
              {!templates.length && !isLoading ? (
                <tr>
                  <td colSpan={6}>Nenhum modelo encontrado.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </article>

      {canCreate ? (
        <article className="panel-card">
          <h2>Novo modelo</h2>
          <form className="upload-form" onSubmit={createTemplate}>
            <label>
              TAG
              <input
                placeholder="potenza-gt-forza-kawasaki"
                value={templateForm.tag}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, tag: event.target.value })
                }
              />
            </label>
            <label>
              Nome
              <input
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, name: event.target.value })
                }
              />
            </label>
            <label>
              Marca
              <input
                value={templateForm.brand}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, brand: event.target.value })
                }
              />
            </label>
            <label>
              Produto
              <input
                value={templateForm.productName}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    productName: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Descrição base
              <textarea
                rows={3}
                value={templateForm.baseDescription}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    baseDescription: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Público-alvo
              <input
                value={templateForm.targetAudience}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    targetAudience: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Claims permitidos, separados por vírgula ou linha
              <textarea
                rows={3}
                value={templateForm.allowedClaims}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    allowedClaims: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Claims proibidos, separados por vírgula ou linha
              <textarea
                rows={3}
                value={templateForm.forbiddenClaims}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    forbiddenClaims: event.target.value,
                  })
                }
              />
            </label>
            <label>
              CTA padrão
              <input
                value={templateForm.defaultCta}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    defaultCta: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Hashtags base
              <textarea
                rows={2}
                value={templateForm.baseHashtags}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    baseHashtags: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Observações
              <textarea
                rows={2}
                value={templateForm.notes}
                onChange={(event) =>
                  setTemplateForm({
                    ...templateForm,
                    notes: event.target.value,
                  })
                }
              />
            </label>
            <button type="submit" disabled={isSaving}>
              Criar modelo
            </button>
          </form>
        </article>
      ) : null}

      <article className="panel-card">
        <h2>Modelo selecionado</h2>
        {selectedTemplate ? (
          <>
            <dl className="stat-list">
              <div>
                <dt>TAG</dt>
                <dd>{selectedTemplate.tag}</dd>
              </div>
              <div>
                <dt>Nome</dt>
                <dd>{selectedTemplate.name}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{statusLabel(selectedTemplate.status)}</dd>
              </div>
              <div>
                <dt>Textos</dt>
                <dd>{selectedTemplate.textVariantsCount}</dd>
              </div>
            </dl>
            <p>{selectedTemplate.baseDescription ?? "Sem descrição base."}</p>
            <div className="hero-chip-list">
              {selectedTemplate.baseHashtags.map((hashtag) => (
                <span key={hashtag} className="chip">
                  {hashtag}
                </span>
              ))}
            </div>
            <h3>Mídias do modelo</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ordem</th>
                    <th>Tipo</th>
                    <th>Papel</th>
                    <th>Arquivo</th>
                    <th>Tamanho</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedTemplate.mediaItems ?? []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.sortOrder}</td>
                      <td>{item.mediaKind}</td>
                      <td>{item.role}</td>
                      <td>{item.originalFilename ?? item.storedFilename}</td>
                      <td>
                        {item.fileSize
                          ? `${Math.round(item.fileSize / 1024)} KB`
                          : "-"}
                      </td>
                    </tr>
                  ))}
                  {!selectedTemplate.mediaItems?.length ? (
                    <tr>
                      <td colSpan={5}>
                        Nenhuma mídia cadastrada neste modelo.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {canApprove && selectedTemplate.status !== "active" ? (
              <button
                type="button"
                className="link-button"
                onClick={() => approveTemplate(selectedTemplate.id)}
                disabled={isSaving}
              >
                Aprovar modelo
              </button>
            ) : null}
            {canUpdate && selectedTemplate.status !== "archived" ? (
              <button
                type="button"
                className="link-button"
                onClick={() => archiveTemplate(selectedTemplate.id)}
                disabled={isSaving}
              >
                Arquivar modelo
              </button>
            ) : null}
          </>
        ) : (
          <p>Selecione ou crie um modelo.</p>
        )}
      </article>

      {selectedTemplate && canUpdate ? (
        <article className="panel-card">
          <h2>Adicionar mídia ao modelo</h2>
          <p>
            Use JPG, JPEG, PNG ou MP4. Essas mídias serão copiadas para a
            postagem criada pela TAG.
          </p>
          <form className="upload-form" onSubmit={uploadTemplateMedia}>
            <label>
              Arquivo
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.mp4,image/jpeg,image/png,video/mp4"
                onChange={(event) =>
                  setMediaForm({
                    ...mediaForm,
                    file: event.target.files?.[0] ?? null,
                  })
                }
              />
            </label>
            <label>
              Papel
              <select
                value={mediaForm.role}
                onChange={(event) =>
                  setMediaForm({ ...mediaForm, role: event.target.value })
                }
              >
                <option value="hero">Principal</option>
                <option value="carousel_item">Item de carrossel</option>
                <option value="story">Story</option>
                <option value="reel">Reel</option>
                <option value="cover">Capa</option>
                <option value="reference">Referência</option>
              </select>
            </label>
            <label>
              Ordem
              <input
                type="number"
                min={0}
                value={mediaForm.sortOrder}
                onChange={(event) =>
                  setMediaForm({
                    ...mediaForm,
                    sortOrder: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Observações
              <input
                value={mediaForm.notes}
                onChange={(event) =>
                  setMediaForm({ ...mediaForm, notes: event.target.value })
                }
              />
            </label>
            <button type="submit" disabled={isSaving || !mediaForm.file}>
              Adicionar mídia
            </button>
          </form>
        </article>
      ) : null}

      {selectedTemplate && canUpdate ? (
        <article className="panel-card">
          <h2>Nova variação de texto</h2>
          <form className="upload-form" onSubmit={createVariant}>
            <label>
              Tipo de publicação
              <select
                value={variantForm.publishType}
                onChange={(event) =>
                  setVariantForm({
                    ...variantForm,
                    publishType: event.target.value as PublishType,
                  })
                }
              >
                <option value="feed_image">Feed imagem</option>
                <option value="feed_carousel">Carrossel</option>
                <option value="reel">Reel</option>
                <option value="story_image">Story imagem</option>
                <option value="story_video">Story vídeo</option>
              </select>
            </label>
            <label>
              Tom
              <input
                value={variantForm.tone}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, tone: event.target.value })
                }
              />
            </label>
            <label>
              Objetivo
              <input
                value={variantForm.objective}
                onChange={(event) =>
                  setVariantForm({
                    ...variantForm,
                    objective: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Título
              <input
                value={variantForm.title}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, title: event.target.value })
                }
              />
            </label>
            <label>
              Legenda
              <textarea
                rows={5}
                value={variantForm.caption}
                onChange={(event) =>
                  setVariantForm({
                    ...variantForm,
                    caption: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Hashtags
              <textarea
                rows={2}
                value={variantForm.hashtags}
                onChange={(event) =>
                  setVariantForm({
                    ...variantForm,
                    hashtags: event.target.value,
                  })
                }
              />
            </label>
            <label>
              CTA
              <input
                value={variantForm.cta}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, cta: event.target.value })
                }
              />
            </label>
            <button type="submit" disabled={isSaving || !variantForm.caption}>
              Criar variação
            </button>
            {canGenerateAiText ? (
              <button
                type="button"
                className="link-button"
                onClick={generateVariantDraft}
                disabled={isSaving}
              >
                Gerar sugestão em modo teste
              </button>
            ) : null}
          </form>
        </article>
      ) : null}

      {selectedTemplate && canCreatePost ? (
        <article className="panel-card">
          <h2>Criar postagem pela TAG</h2>
          <p>
            Usa uma variação aprovada e as mídias cadastradas no modelo. A
            postagem será criada no fluxo atual; sem data futura, entra como
            pendente.
          </p>
          <form className="upload-form" onSubmit={createPostFromTag}>
            <label>
              Variação aprovada
              <select
                value={postForm.textVariantId}
                onChange={(event) =>
                  setPostForm({
                    ...postForm,
                    textVariantId: event.target.value,
                  })
                }
              >
                <option value="">Usar primeira aprovada</option>
                {approvedVariants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {publishTypeLabel(variant.publishType)} —{" "}
                    {variant.title ?? variant.caption.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Título da postagem
              <input
                value={postForm.title}
                onChange={(event) =>
                  setPostForm({ ...postForm, title: event.target.value })
                }
                placeholder={selectedTemplate.name}
              />
            </label>
            <label>
              Agendar para
              <input
                type="datetime-local"
                value={postForm.scheduledAt}
                onChange={(event) =>
                  setPostForm({
                    ...postForm,
                    scheduledAt: event.target.value,
                  })
                }
              />
            </label>
            <button
              type="submit"
              disabled={isSaving || approvedVariants.length === 0}
            >
              Criar postagem
            </button>
          </form>
        </article>
      ) : null}

      {selectedTemplate ? (
        <article className="panel-card">
          <h2>Variações de texto</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Título</th>
                  <th>Legenda</th>
                  <th>Aprovado em</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {selectedVariants.map((variant) => (
                  <tr key={variant.id}>
                    <td>{publishTypeLabel(variant.publishType)}</td>
                    <td>{statusLabel(variant.status)}</td>
                    <td>{variant.title ?? "-"}</td>
                    <td>{variant.caption}</td>
                    <td>{formatDate(variant.approvedAt)}</td>
                    <td>
                      {canApprove && variant.status !== "approved" ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => approveVariant(variant.id)}
                          disabled={isSaving}
                        >
                          Aprovar
                        </button>
                      ) : null}
                      {canUpdate && variant.status !== "rejected" ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => rejectVariant(variant.id)}
                          disabled={isSaving}
                        >
                          Rejeitar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!selectedVariants.length ? (
                  <tr>
                    <td colSpan={6}>Nenhuma variação cadastrada.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </section>
  );
}
