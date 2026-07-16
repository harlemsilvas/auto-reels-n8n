import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/context/AuthContext";
import {
  mediaTemplatesService,
  type CreateTemplateInput,
  type CreateTextVariantInput,
  type MediaTemplate,
  type MediaTemplateStatus,
  type PublishType,
  type TextVariant,
  type TextVariantStatus,
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

type VariantFormState = typeof VARIANT_INITIAL_FORM;
type WorkflowAnchor = "search" | "details" | "media" | "text" | "post" | "review";

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

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
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

function formatFileSize(value?: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
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

function variantToForm(variant: TextVariant): VariantFormState {
  return {
    publishType: variant.publishType,
    tone: variant.tone ?? "",
    objective: variant.objective ?? "",
    title: variant.title ?? "",
    caption: variant.caption,
    hashtags: variant.hashtags.join("\n"),
    cta: variant.cta ?? "",
  };
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
  const [editingVariantId, setEditingVariantId] = useState("");
  const [editingVariantForm, setEditingVariantForm] =
    useState<VariantFormState>(VARIANT_INITIAL_FORM);
  const [postForm, setPostForm] = useState(POST_INITIAL_FORM);
  const [mediaForm, setMediaForm] = useState(MEDIA_INITIAL_FORM);
  const [pendingAnchor, setPendingAnchor] = useState<WorkflowAnchor | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchSectionRef = useRef<HTMLElement | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);
  const mediaSectionRef = useRef<HTMLElement | null>(null);
  const textSectionRef = useRef<HTMLElement | null>(null);
  const postSectionRef = useRef<HTMLElement | null>(null);
  const reviewSectionRef = useRef<HTMLFormElement | null>(null);

  const selectedVariants = useMemo(
    () => selectedTemplate?.textVariants ?? [],
    [selectedTemplate],
  );
  const approvedVariants = useMemo(
    () => selectedVariants.filter((variant) => variant.status === "approved"),
    [selectedVariants],
  );
  const selectedPostVariant = useMemo(
    () =>
      approvedVariants.find((item) => item.id === postForm.textVariantId) ??
      approvedVariants[0] ??
      null,
    [approvedVariants, postForm.textVariantId],
  );
  const postPreview = useMemo(() => {
    if (!selectedTemplate || !selectedPostVariant) return null;

    const mediaItems = selectedTemplate.mediaItems ?? [];
    const scheduledAt = postForm.scheduledAt
      ? new Date(postForm.scheduledAt)
      : null;

    return {
      title: postForm.title.trim() || selectedPostVariant.title || selectedTemplate.name,
      status:
        scheduledAt && scheduledAt.getTime() > Date.now()
          ? "scheduled"
          : "pending",
      scheduledAt: scheduledAt ? formatDate(scheduledAt.toISOString()) : null,
      publishType: selectedPostVariant.publishType,
      caption: selectedPostVariant.caption,
      hashtags: selectedPostVariant.hashtags,
      cta: selectedPostVariant.cta,
      mediaItems,
      canCreate:
        selectedTemplate.status === "active" &&
        mediaItems.length > 0 &&
        selectedPostVariant.status === "approved",
    };
  }, [postForm.scheduledAt, postForm.title, selectedPostVariant, selectedTemplate]);
  const editingVariant = useMemo(
    () =>
      selectedVariants.find((variant) => variant.id === editingVariantId) ??
      null,
    [editingVariantId, selectedVariants],
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

  useEffect(() => {
    if (!selectedTemplate || !pendingAnchor) return;

    const anchor = pendingAnchor;
    setPendingAnchor(null);
    window.requestAnimationFrame(() => {
      getAnchorRef(anchor).current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [pendingAnchor, selectedTemplate]);

  async function refreshSelected() {
    await loadList();
    if (selectedId) {
      await loadSelected(selectedId);
    }
  }

  function getAnchorRef(anchor: WorkflowAnchor) {
    return {
      search: searchSectionRef,
      details: detailsSectionRef,
      media: mediaSectionRef,
      text: textSectionRef,
      post: postSectionRef,
      review: reviewSectionRef,
    }[anchor];
  }

  function scrollToAnchor(anchor: WorkflowAnchor) {
    window.requestAnimationFrame(() => {
      getAnchorRef(anchor).current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function openTemplate(templateId: string) {
    setSelectedId(templateId);
    setPendingAnchor("details");
    setMessage("Modelo aberto. Próximo passo: confira status, mídias e textos.");
    setError(null);
  }

  function goToWorkflowAnchor(anchor: WorkflowAnchor) {
    if (anchor !== "search" && !selectedTemplate) {
      setMessage("Abra um modelo primeiro para continuar o fluxo.");
      scrollToAnchor("search");
      return;
    }

    scrollToAnchor(anchor);
  }

  function startEditVariant(variant: TextVariant) {
    setEditingVariantId(variant.id);
    setEditingVariantForm(variantToForm(variant));
    setError(null);
    setMessage(null);
    setPendingAnchor("review");
  }

  function cancelEditVariant() {
    setEditingVariantId("");
    setEditingVariantForm(VARIANT_INITIAL_FORM);
  }

  function suggestTemplateFields() {
    const product =
      templateForm.productName.trim() ||
      templateForm.name.trim() ||
      "produto da campanha";
    const brand = templateForm.brand.trim() || "Potenza";
    const baseSlug = slugify(`${brand}-${product}`) || "modelo-campanha";

    setTemplateForm({
      ...templateForm,
      tag: templateForm.tag || baseSlug,
      name: templateForm.name || `${brand} - ${product}`,
      brand: templateForm.brand || brand,
      productName: templateForm.productName || product,
      baseDescription:
        templateForm.baseDescription ||
        `${product} da ${brand}. Use esta descrição para informar aplicação, diferenciais reais, benefício principal e cuidados de compatibilidade antes da compra.`,
      targetAudience:
        templateForm.targetAudience ||
        "Motociclistas que buscam manutenção preventiva, reposição de qualidade e orientação antes de comprar.",
      allowedClaims:
        templateForm.allowedClaims ||
        "alta performance\nboa resposta de frenagem\nproduto para reposição\nconsulte a aplicação correta",
      forbiddenClaims:
        templateForm.forbiddenClaims ||
        "garantia absoluta de segurança\ncompatibilidade não informada\nmelhor do mercado\npromessa de resultado sem comprovação\npreço ou promoção não cadastrados",
      defaultCta:
        templateForm.defaultCta ||
        "Chame no direct e consulte a aplicação correta para sua moto.",
      baseHashtags:
        templateForm.baseHashtags ||
        "#PotenzaFreio\n#Motopeças\n#ManutençãoDeMotos\n#PastilhaDeFreio\n#MotoBrasil\n#PeçasParaMoto",
      notes:
        templateForm.notes ||
        "Revise compatibilidade, aplicação dianteira/traseira e qualquer informação técnica antes de aprovar o texto.",
    });
    setMessage("Campos sugeridos preenchidos. Revise antes de criar o modelo.");
  }

  function suggestVariantFields() {
    const product =
      selectedTemplate?.productName ||
      selectedTemplate?.name ||
      "produto da campanha";

    setVariantForm({
      ...variantForm,
      tone: variantForm.tone || "comercial claro, direto e confiável",
      objective:
        variantForm.objective ||
        "explicar o benefício principal, orientar compatibilidade e incentivar contato",
      title: variantForm.title || `${product} | consulte a aplicação correta`,
      caption:
        variantForm.caption ||
        `${product}\n\nUma opção para quem busca reposição de qualidade e orientação antes da compra.\n\nConsulte a aplicação correta para sua moto antes de finalizar o pedido.`,
      hashtags:
        variantForm.hashtags ||
        (selectedTemplate?.baseHashtags?.length
          ? selectedTemplate.baseHashtags.join("\n")
          : "#PotenzaFreio\n#Motopeças\n#MotoBrasil"),
      cta:
        variantForm.cta ||
        selectedTemplate?.defaultCta ||
        "Chame no direct e consulte a aplicação correta para sua moto.",
    });
    setMessage("Sugestão manual preenchida. Edite ou use Gemini para gerar outra opção.");
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

  async function generateVariantDraft(generationMode: "local" | "gemini" = "local") {
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
        generationMode,
        useLocalFallback: generationMode === "local",
        allowLocalFallback: false,
      });
      setMessage(
        generationMode === "gemini"
          ? "Sugestão com Gemini gerada. Revise e aprove antes de usar."
          : "Sugestão local de texto gerada. Revise e aprove antes de usar.",
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

  async function saveVariantReview(status: TextVariantStatus = "generated") {
    if (!selectedId || !editingVariantId) return;

    if (!editingVariantForm.caption.trim()) {
      setError("Legenda da variação é obrigatória.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await mediaTemplatesService.updateTextVariant(
        selectedId,
        editingVariantId,
        {
          publishType: editingVariantForm.publishType,
          tone: editingVariantForm.tone || undefined,
          objective: editingVariantForm.objective || undefined,
          title: editingVariantForm.title || undefined,
          caption: editingVariantForm.caption,
          hashtags: splitLines(editingVariantForm.hashtags),
          cta: editingVariantForm.cta || undefined,
          status,
        },
      );
      setMessage(
        status === "approved"
          ? "Variação salva e aprovada."
          : "Revisão salva. Aprove quando estiver pronta para uso.",
      );
      cancelEditVariant();
      await refreshSelected();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Erro ao salvar revisão.",
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

    const variant = selectedPostVariant;

    if (!variant) {
      setError("Aprove uma variação de texto antes de criar a postagem.");
      return;
    }

    if (!postPreview?.canCreate) {
      setError(
        "Revise a prévia: o modelo precisa estar ativo, com mídia cadastrada e variação aprovada.",
      );
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

      <article className="panel-card model-guide-card">
        <div>
          <p className="eyebrow">Guia rápido</p>
          <h2>Como criar uma postagem por modelo</h2>
          <p className="helper-text">
            Pense no modelo como uma ficha reutilizável da campanha. Você preenche
            a base uma vez, adiciona mídias, gera/revisa textos e só então cria a
            postagem pela TAG.
          </p>
        </div>
        <ol className="model-guide-steps">
          <li>
            <strong>Crie ou abra uma TAG.</strong>
            <span>Ex.: `potenza-231gt`. A TAG identifica o modelo e liga posts futuros.</span>
          </li>
          <li>
            <strong>Preencha a ficha base.</strong>
            <span>Produto, público, claims, CTA e hashtags orientam a IA e evitam textos arriscados.</span>
          </li>
          <li>
            <strong>Adicione mídias.</strong>
            <span>Imagem principal para feed, itens ordenados para carrossel ou vídeo para Reel/Story.</span>
          </li>
          <li>
            <strong>Gere e aprove o texto.</strong>
            <span>Use sugestão local para rascunho rápido ou Gemini para texto por IA. Revise antes de aprovar.</span>
          </li>
          <li>
            <strong>Crie a postagem.</strong>
            <span>Somente texto aprovado e modelo ativo entram na criação do post.</span>
          </li>
        </ol>
      </article>

      <nav className="workflow-nav" aria-label="Etapas dos modelos">
        <button
          type="button"
          className="workflow-step-button"
          onClick={() => goToWorkflowAnchor("search")}
        >
          <span>1</span>
          Buscar
        </button>
        <button
          type="button"
          className="workflow-step-button"
          onClick={() => goToWorkflowAnchor("details")}
        >
          <span>2</span>
          Conferir modelo
        </button>
        <button
          type="button"
          className="workflow-step-button"
          onClick={() => goToWorkflowAnchor("media")}
        >
          <span>3</span>
          Mídias
        </button>
        <button
          type="button"
          className="workflow-step-button"
          onClick={() => goToWorkflowAnchor("text")}
        >
          <span>4</span>
          Textos
        </button>
        <button
          type="button"
          className="workflow-step-button"
          onClick={() => goToWorkflowAnchor("post")}
        >
          <span>5</span>
          Criar post
        </button>
      </nav>

      <article
        id="modelos-busca"
        ref={searchSectionRef}
        className="panel-card workflow-card workflow-card--search"
      >
        <div className="workflow-heading">
          <span>Fase 1</span>
          <div>
            <h2>Buscar modelos</h2>
            <p>Comece abrindo uma TAG. Depois a tela leva você para a edição.</p>
          </div>
        </div>
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
                      onClick={() => openTemplate(template.id)}
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
          <p className="helper-text">
            Preencha o mínimo necessário ou use o botão de sugestão para criar
            uma base editável. Nada é salvo até clicar em <strong>Criar modelo</strong>.
          </p>
          <button
            type="button"
            className="link-button"
            onClick={suggestTemplateFields}
          >
            Sugerir preenchimento
          </button>
          <form className="upload-form" onSubmit={createTemplate}>
            <label>
              TAG
              <span className="field-help">
                Identificador curto da campanha. Use letras, números e hífen.
              </span>
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
              <span className="field-help">
                Nome legível que aparece para o operador no dashboard.
              </span>
              <input
                value={templateForm.name}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, name: event.target.value })
                }
              />
            </label>
            <label>
              Marca
              <span className="field-help">Marca ou linha principal do produto.</span>
              <input
                value={templateForm.brand}
                onChange={(event) =>
                  setTemplateForm({ ...templateForm, brand: event.target.value })
                }
              />
            </label>
            <label>
              Produto
              <span className="field-help">
                Produto exato da campanha, de preferência com código/modelo.
              </span>
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
              <span className="field-help">
                Matéria-prima para textos: aplicação, diferencial real e contexto de venda.
              </span>
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
              <span className="field-help">
                Para quem o texto deve falar: cliente, moto, necessidade ou situação.
              </span>
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
              <span className="field-help">
                Frases/diferenciais que a IA pode usar. Ex.: alta performance, reposição, aplicação informada.
              </span>
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
              <span className="field-help">
                O que a IA não deve prometer. Ex.: compatibilidade não informada, garantia absoluta, preço não cadastrado.
              </span>
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
              <span className="field-help">
                Chamada para ação. Ex.: “Chame no direct e consulte a aplicação correta”.
              </span>
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
              <span className="field-help">
                Uma por linha ou separadas por vírgula. Elas entram como base das variações.
              </span>
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
              <span className="field-help">
                Regras internas para revisão humana: compatibilidade, estoque, tom ou cuidados.
              </span>
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

      <article
        id="modelos-detalhes"
        ref={detailsSectionRef}
        className="panel-card workflow-card workflow-card--details"
      >
        <div className="workflow-heading">
          <span>Fase 2</span>
          <div>
            <h2>Modelo selecionado</h2>
            <p>Confira se a TAG está ativa e siga para mídias, textos e post.</p>
          </div>
        </div>
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
            <h3>Uso recente da TAG</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Post</th>
                    <th>Texto usado</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Agendamento</th>
                    <th>Publicado</th>
                    <th>Criado em</th>
                    <th>Criado por</th>
                    <th>Mídias</th>
                    <th>Meta</th>
                    <th>Erro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedTemplate.recentPosts ?? []).map((post) => (
                    <tr key={post.id}>
                      <td>
                        <div className="history-post-cell">
                          <strong>{post.title ?? "Sem título"}</strong>
                          <span className="history-inline-note">
                            {post.id.slice(0, 8)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="history-post-cell">
                          <strong>
                            {post.mediaTemplateTextVariantTitle ?? "-"}
                          </strong>
                          <span className="history-inline-note">
                            {post.mediaTemplateTextVariantId
                              ? post.mediaTemplateTextVariantId.slice(0, 8)
                              : "Sem variação vinculada"}
                          </span>
                        </div>
                      </td>
                      <td>{publishTypeLabel(post.publishType)}</td>
                      <td>{statusLabel(post.status)}</td>
                      <td>{formatDate(post.scheduledAt)}</td>
                      <td>{formatDate(post.publishedAt)}</td>
                      <td>{formatDate(post.createdAt)}</td>
                      <td>{post.createdByDisplayName ?? "-"}</td>
                      <td>{post.mediaItemsCount}</td>
                      <td>
                        <div className="history-post-cell">
                          <strong>
                            {post.metaMediaId
                              ? post.metaMediaId.slice(0, 8)
                              : "-"}
                          </strong>
                          <span className="history-inline-note">
                            {post.metaContainerId
                              ? `container ${post.metaContainerId.slice(0, 8)}`
                              : "Sem ID Meta"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {post.errorMessage ? (
                          <div className="history-post-cell">
                            <strong>{post.retryCount}/2</strong>
                            <span className="history-inline-note">
                              {post.errorMessage}
                            </span>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <div className="workflow-next-actions">
                          <Link className="link-button" to={`/reels/${post.id}`}>
                            Detalhes
                          </Link>
                          <Link className="link-button" to="/agendamentos">
                            Agendamentos
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!selectedTemplate.recentPosts?.length ? (
                    <tr>
                      <td colSpan={12}>
                        Nenhuma postagem criada a partir desta TAG ainda.
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
            <div className="workflow-next-actions">
              <button
                type="button"
                className="link-button"
                onClick={() => goToWorkflowAnchor("media")}
              >
                Próximo: mídias
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => goToWorkflowAnchor("text")}
              >
                Ir para textos
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => goToWorkflowAnchor("post")}
              >
                Criar postagem
              </button>
            </div>
          </>
        ) : (
          <p>Selecione ou crie um modelo.</p>
        )}
      </article>

      {selectedTemplate && canUpdate ? (
        <article
          id="modelos-midias"
          ref={mediaSectionRef}
          className="panel-card workflow-card workflow-card--media"
        >
          <div className="workflow-heading">
            <span>Fase 3</span>
            <div>
              <h2>Adicionar mídia ao modelo</h2>
              <p>Inclua ou confira as imagens/vídeos que serão copiados para o post.</p>
            </div>
          </div>
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
            <button
              type="button"
              className="link-button"
              onClick={() => goToWorkflowAnchor("text")}
            >
              Próximo: textos
            </button>
          </form>
        </article>
      ) : null}

      {selectedTemplate && canUpdate ? (
        <article
          id="modelos-textos"
          ref={textSectionRef}
          className="panel-card workflow-card workflow-card--text"
        >
          <div className="workflow-heading">
            <span>Fase 4</span>
            <div>
              <h2>Nova variação de texto</h2>
              <p>Crie, gere ou revise textos. Só variações aprovadas viram post.</p>
            </div>
          </div>
          <div className="model-helper-card">
            <strong>O que preencher aqui?</strong>
            <p>
              Esta seção cria uma legenda específica para um tipo de post. O
              modelo guarda a regra geral; a variação guarda o texto que será
              revisado/aprovado para uso.
            </p>
            <button type="button" className="link-button" onClick={suggestVariantFields}>
              Sugerir preenchimento do texto
            </button>
          </div>
          <form className="upload-form" onSubmit={createVariant}>
            <label>
              Tipo de publicação
              <span className="field-help">
                Escolha o formato final: imagem única, carrossel, Reel ou Story.
              </span>
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
              <span className="field-help">
                Como a legenda deve soar. Ex.: direto, técnico, promocional, premium.
              </span>
              <input
                value={variantForm.tone}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, tone: event.target.value })
                }
              />
            </label>
            <label>
              Objetivo
              <span className="field-help">
                O que o texto precisa conseguir: explicar, vender, educar, chamar para direct.
              </span>
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
              <span className="field-help">
                Nome curto para identificar a variação. Não precisa ser publicado.
              </span>
              <input
                value={variantForm.title}
                onChange={(event) =>
                  setVariantForm({ ...variantForm, title: event.target.value })
                }
              />
            </label>
            <label>
              Legenda
              <span className="field-help">
                Texto principal da postagem. Pode ser manual ou gerado por Gemini.
              </span>
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
              <span className="field-help">
                Uma por linha ou separadas por vírgula. Revise para não duplicar.
              </span>
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
              <span className="field-help">
                A ação final esperada: chamar no direct, consultar aplicação, pedir orçamento.
              </span>
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
              <>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => generateVariantDraft("local")}
                  disabled={isSaving}
                >
                  Gerar sugestão local
                </button>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => generateVariantDraft("gemini")}
                  disabled={isSaving}
                >
                  Gerar com Gemini
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="link-button"
              onClick={() => goToWorkflowAnchor("post")}
              disabled={!approvedVariants.length}
            >
              Próximo: criar post
            </button>
          </form>
        </article>
      ) : null}

      {selectedTemplate && canCreatePost ? (
        <article
          id="modelos-post"
          ref={postSectionRef}
          className="panel-card workflow-card workflow-card--post"
        >
          <div className="workflow-heading">
            <span>Fase 5</span>
            <div>
              <h2>Criar postagem pela TAG</h2>
              <p>Revise a prévia. Confirmar aqui grava a postagem no fluxo atual.</p>
            </div>
          </div>
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
            {postPreview ? (
              <div
                className="panel-card"
                style={{ background: "#fffaf0", borderStyle: "dashed" }}
              >
                <h3>Prévia antes de criar</h3>
                <dl className="stat-list">
                  <div>
                    <dt>Status inicial</dt>
                    <dd>
                      {postPreview.status === "scheduled"
                        ? "Agendado"
                        : "Pendente"}
                    </dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{publishTypeLabel(postPreview.publishType)}</dd>
                  </div>
                  <div>
                    <dt>Mídias</dt>
                    <dd>{postPreview.mediaItems.length}</dd>
                  </div>
                  <div>
                    <dt>Agendamento</dt>
                    <dd>{postPreview.scheduledAt ?? "Sem data futura"}</dd>
                  </div>
                </dl>
                {!postPreview.canCreate ? (
                  <p className="error-text">
                    Para criar a postagem, o modelo deve estar ativo, ter pelo
                    menos uma mídia e usar uma variação aprovada.
                  </p>
                ) : null}
                <p>
                  <strong>Título:</strong> {postPreview.title}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  <strong>Legenda:</strong>
                  {"\n"}
                  {postPreview.caption}
                </p>
                {postPreview.cta ? (
                  <p>
                    <strong>CTA:</strong> {postPreview.cta}
                  </p>
                ) : null}
                {postPreview.hashtags.length ? (
                  <div className="hero-chip-list">
                    {postPreview.hashtags.map((hashtag) => (
                      <span key={hashtag} className="chip">
                        {hashtag}
                      </span>
                    ))}
                  </div>
                ) : null}
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
                      {postPreview.mediaItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.sortOrder}</td>
                          <td>{item.mediaKind}</td>
                          <td>{item.role}</td>
                          <td>{item.originalFilename ?? item.storedFilename}</td>
                          <td>{formatFileSize(item.fileSize)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p>
                Aprove uma variação de texto para visualizar a prévia da
                postagem antes de criar.
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving || !postPreview?.canCreate}
            >
              Confirmar criação da postagem
            </button>
          </form>
        </article>
      ) : null}

      {selectedTemplate ? (
        <article className="panel-card workflow-card workflow-card--variants">
          <div className="workflow-heading">
            <span>Revisão</span>
            <div>
              <h2>Variações de texto</h2>
              <p>Revise, aprove ou rejeite antes de avançar para a postagem.</p>
            </div>
          </div>
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
                    <td>
                      <div
                        style={{
                          maxWidth: 520,
                          maxHeight: 180,
                          overflow: "auto",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {variant.caption}
                      </div>
                    </td>
                    <td>{formatDate(variant.approvedAt)}</td>
                    <td>
                      {canUpdate ? (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => startEditVariant(variant)}
                          disabled={isSaving}
                        >
                          Revisar
                        </button>
                      ) : null}
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
          {canUpdate && editingVariant ? (
            <form
              ref={reviewSectionRef}
              className="upload-form"
              onSubmit={(event) => {
                event.preventDefault();
                void saveVariantReview("generated");
              }}
            >
              <h3>Revisar variação</h3>
              <p>
                Editando {publishTypeLabel(editingVariant.publishType)} — status
                atual: {statusLabel(editingVariant.status)}. Salvar revisão
                deixa o texto como gerado; use "Salvar e aprovar" somente quando
                estiver pronto para criar postagens.
              </p>
              <label>
                Tipo de publicação
                <select
                  value={editingVariantForm.publishType}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
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
                  value={editingVariantForm.tone}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      tone: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Objetivo
                <input
                  value={editingVariantForm.objective}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      objective: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Título
                <input
                  value={editingVariantForm.title}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      title: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Legenda
                <textarea
                  rows={10}
                  value={editingVariantForm.caption}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      caption: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Hashtags
                <textarea
                  rows={3}
                  value={editingVariantForm.hashtags}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      hashtags: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                CTA
                <input
                  value={editingVariantForm.cta}
                  onChange={(event) =>
                    setEditingVariantForm({
                      ...editingVariantForm,
                      cta: event.target.value,
                    })
                  }
                />
              </label>
              <div className="button-row">
                <button
                  type="submit"
                  disabled={isSaving || !editingVariantForm.caption.trim()}
                >
                  Salvar revisão
                </button>
                {canApprove ? (
                  <button
                    type="button"
                    className="link-button"
                    disabled={isSaving || !editingVariantForm.caption.trim()}
                    onClick={() => void saveVariantReview("approved")}
                  >
                    Salvar e aprovar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="link-button"
                  disabled={isSaving}
                  onClick={cancelEditVariant}
                >
                  Cancelar edição
                </button>
              </div>
            </form>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
