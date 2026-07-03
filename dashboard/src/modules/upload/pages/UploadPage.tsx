import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useUploadModule } from "../hooks/useUploadModule";
import { scheduleService } from "../../schedule/services/schedule.service";
import type { PublishType } from "../../../shared/types/upload";

const FIXED_TIME_SLOTS = [
  "08:00",
  "10:30",
  "12:00",
  "14:30",
  "17:00",
  "19:30",
  "21:00",
];

const PUBLISH_TYPE_OPTIONS: Array<{
  value: PublishType;
  label: string;
  description: string;
  accept: string;
  multiple: boolean;
}> = [
  {
    value: "reel",
    label: "Reel",
    description: "1 vídeo MP4",
    accept: "video/mp4,.mp4",
    multiple: false,
  },
  {
    value: "feed_image",
    label: "Feed — imagem única",
    description: "1 imagem JPG, JPEG ou PNG",
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    multiple: false,
  },
  {
    value: "feed_carousel",
    label: "Feed — carrossel",
    description: "De 2 a 10 imagens ou vídeos MP4",
    accept: "image/jpeg,image/png,video/mp4,.jpg,.jpeg,.png,.mp4",
    multiple: true,
  },
  {
    value: "story_image",
    label: "Story — imagem",
    description: "1 imagem JPG, JPEG ou PNG",
    accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
    multiple: false,
  },
  {
    value: "story_video",
    label: "Story — vídeo",
    description: "1 vídeo MP4",
    accept: "video/mp4,.mp4",
    multiple: false,
  },
];

type PreviewItem = {
  file: File;
  url: string;
  kind: "image" | "video";
};

function isImage(file: File) {
  return file.type === "image/jpeg" || file.type === "image/png";
}

function isVideo(file: File) {
  return file.type === "video/mp4";
}

function validateFiles(publishType: PublishType, files: File[]) {
  if (files.length === 0) {
    return "Selecione pelo menos um arquivo.";
  }

  if (publishType === "feed_carousel") {
    if (files.length < 2 || files.length > 10) {
      return "O carrossel exige de 2 a 10 arquivos.";
    }

    if (files.some((file) => !isImage(file) && !isVideo(file))) {
      return "O carrossel aceita somente JPG, JPEG, PNG ou MP4.";
    }

    return null;
  }

  if (files.length !== 1) {
    return "Este tipo de publicação exige exatamente um arquivo.";
  }

  if (
    (publishType === "reel" || publishType === "story_video") &&
    !isVideo(files[0])
  ) {
    return "Selecione um vídeo MP4.";
  }

  if (
    (publishType === "feed_image" || publishType === "story_image") &&
    !isImage(files[0])
  ) {
    return "Selecione uma imagem JPG, JPEG ou PNG.";
  }

  return null;
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadPage() {
  const {
    pendingPath,
    items,
    isLoadingList,
    isUploading,
    error,
    capabilities,
    uploadPost,
    loadPending,
  } = useUploadModule();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [publishType, setPublishType] = useState<PublishType>("reel");
  const [files, setFiles] = useState<File[]>([]);
  const [postTitle, setPostTitle] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlot, setScheduleSlot] = useState("");
  const [availableSlots, setAvailableSlots] =
    useState<string[]>(FIXED_TIME_SLOTS);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    scheduleService
      .getSlots(true)
      .then((data) => {
        const slots = data.items.map((item) => item.timeValue).filter(Boolean);

        if (slots.length > 0) {
          setAvailableSlots(slots);
        }
      })
      .catch(() => null);
  }, []);

  const selectedType = useMemo(
    () =>
      PUBLISH_TYPE_OPTIONS.find((option) => option.value === publishType) ??
      PUBLISH_TYPE_OPTIONS[0],
    [publishType],
  );

  const selectedCapability = capabilities?.publishTypes[publishType] ?? null;

  const previews = useMemo<PreviewItem[]>(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        kind: isVideo(file) ? "video" : "image",
      })),
    [files],
  );

  useEffect(
    () => () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    },
    [previews],
  );

  const scheduleAt = useMemo(() => {
    if (!scheduleDate || !scheduleSlot) {
      return "";
    }

    return `${scheduleDate}T${scheduleSlot}:00`;
  }, [scheduleDate, scheduleSlot]);

  const fileValidationError = useMemo(
    () => validateFiles(publishType, files),
    [publishType, files],
  );

  const canSubmit =
    !isUploading &&
    postTitle.trim().length > 0 &&
    files.length > 0 &&
    !fileValidationError;

  function resetFiles() {
    setFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handlePublishTypeChange(nextType: PublishType) {
    setPublishType(nextType);
    setFormError(null);
    setSuccessMessage(null);
    resetFiles();
  }

  function handleFileChange(selectedFiles: FileList | null) {
    const nextFiles = Array.from(selectedFiles ?? []);
    setFiles(
      selectedType.multiple ? nextFiles.slice(0, 10) : nextFiles.slice(0, 1),
    );
    setFormError(null);
    setSuccessMessage(null);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setFormError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateFiles(publishType, files);

    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!postTitle.trim()) {
      setFormError("Informe um nome para identificar a postagem.");
      return;
    }

    if (!!scheduleDate !== !!scheduleSlot) {
      setFormError("Para agendar, informe o dia e o horário.");
      return;
    }

    setFormError(null);
    setSuccessMessage(null);

    const response = await uploadPost({
      files,
      postTitle: postTitle.trim(),
      publishType,
      captionText: captionText.trim(),
      scheduleAt: scheduleAt || undefined,
    });

    if (response) {
      const queueMessage = response.queue.queued
        ? "e enviada para a fila"
        : response.queue.reason === "scheduled"
          ? "e agendada"
          : response.queue.reason === "publish_disabled"
            ? "em modo de preparação"
            : response.queue.reason === "queue_error"
              ? "e mantida pendente para nova tentativa da fila"
              : "criada";

      setSuccessMessage(
        `“${response.post.title}” foi criada como ${selectedType.label} ${queueMessage} (${response.post.id}).`,
      );
      resetFiles();
      setCaptionText("");
      setPostTitle("");
      setScheduleDate("");
      setScheduleSlot("");
    }
  }

  return (
    <section className="upload-grid">
      <article className="panel-card">
        <h2>Nova publicação</h2>
        <p className="hero-copy">
          Selecione o formato e envie a mídia para preparação.
        </p>

        <form className="upload-form" onSubmit={handleSubmit}>
          {isUploading ? (
            <div className="upload-progress" role="status" aria-live="polite">
              <span className="upload-spinner" aria-hidden="true" />
              <span>Enviando arquivos, aguarde...</span>
            </div>
          ) : null}

          <label>
            Tipo de publicação
            <select
              value={publishType}
              disabled={isUploading}
              onChange={(event) =>
                handlePublishTypeChange(event.target.value as PublishType)
              }
            >
              {PUBLISH_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nome da postagem
            <input
              type="text"
              value={postTitle}
              maxLength={160}
              required
              disabled={isUploading}
              placeholder="Ex.: Campanha Potenza GT — Julho"
              onChange={(event) => setPostTitle(event.target.value)}
            />
          </label>

          <div className="upload-type-hint">
            <div>
              <strong>{selectedType.label}</strong>
              <span>{selectedType.description}</span>
            </div>
            <span
              className={`upload-capability-badge ${
                selectedCapability?.publishEnabled
                  ? "upload-capability-active"
                  : "upload-capability-preparation"
              }`}
            >
              {selectedCapability?.publishEnabled
                ? "Publicação ativa"
                : "Somente preparação"}
            </span>
          </div>

          {selectedCapability && !selectedCapability.publishEnabled ? (
            <p className="upload-capability-notice">
              O upload e o agendamento estão disponíveis, mas este formato não
              será publicado automaticamente enquanto a publicação multi-tipo
              estiver desativada.
            </p>
          ) : null}

          <label>
            {selectedType.multiple ? "Arquivos" : "Arquivo"}
            <input
              ref={fileInputRef}
              type="file"
              accept={selectedType.accept}
              multiple={selectedType.multiple}
              disabled={isUploading}
              onChange={(event) => handleFileChange(event.target.files)}
            />
          </label>

          {previews.length > 0 ? (
            <div
              className="upload-preview-grid"
              aria-label="Prévia dos arquivos"
            >
              {previews.map((preview, index) => (
                <article
                  className="upload-preview-card"
                  key={`${preview.file.name}-${index}`}
                >
                  <div className="upload-preview-media">
                    {preview.kind === "image" ? (
                      <img
                        src={preview.url}
                        alt={`Prévia de ${preview.file.name}`}
                      />
                    ) : (
                      <video src={preview.url} controls preload="metadata" />
                    )}
                    <span className="upload-order-badge">{index + 1}</span>
                  </div>
                  <div className="upload-preview-info">
                    <strong title={preview.file.name}>
                      {preview.file.name}
                    </strong>
                    <span>{formatFileSize(preview.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="upload-remove-file"
                    disabled={isUploading}
                    onClick={() => removeFile(index)}
                  >
                    Remover
                  </button>
                </article>
              ))}
            </div>
          ) : null}

          {fileValidationError && files.length > 0 ? (
            <p className="error-text">{fileValidationError}</p>
          ) : null}

          <label>
            Legenda
            <textarea
              value={captionText}
              disabled={isUploading}
              onChange={(event) => setCaptionText(event.target.value)}
              rows={5}
              placeholder={
                publishType.startsWith("story_")
                  ? "Opcional para Story; será mantida apenas internamente"
                  : "Escreva a legenda com hashtags"
              }
            />
          </label>

          <div className="upload-schedule-grid">
            <label>
              Dia do agendamento (opcional)
              <input
                type="date"
                value={scheduleDate}
                disabled={isUploading}
                onChange={(event) => setScheduleDate(event.target.value)}
              />
            </label>

            <label>
              Horário fixo (opcional)
              <select
                value={scheduleSlot}
                disabled={isUploading}
                onChange={(event) => setScheduleSlot(event.target.value)}
              >
                <option value="">Selecione um horário</option>
                {availableSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {scheduleAt ? (
            <p className="helper-text">
              Agendamento selecionado: {scheduleDate} às {scheduleSlot}
            </p>
          ) : !scheduleDate && !scheduleSlot ? (
            <p className="upload-immediate-notice">
              Sem data: a publicação entrará na fila assim que o upload for
              concluído.
            </p>
          ) : (
            <p className="error-text">
              Para agendar, informe o dia e o horário.
            </p>
          )}

          {formError ? <p className="error-text">{formError}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
          {successMessage ? (
            <p className="upload-success-text" role="status">
              {successMessage}
            </p>
          ) : null}

          <button type="submit" disabled={!canSubmit}>
            {isUploading ? (
              <span className="btn-busy-wrap">
                <span className="upload-spinner" aria-hidden="true" />
                <span>Enviando...</span>
              </span>
            ) : (
              `Criar ${selectedType.label}`
            )}
          </button>
        </form>
      </article>

      <article className="panel-card">
        <div className="upload-list-header">
          <div>
            <h2>Arquivos em pending</h2>
            <p className="helper-text">Fluxo legado de Reels: {pendingPath}</p>
          </div>
          <button
            type="button"
            className="link-button"
            onClick={() => void loadPending()}
          >
            Atualizar
          </button>
        </div>

        {isLoadingList ? <p>Carregando arquivos...</p> : null}

        {!isLoadingList && items.length === 0 ? (
          <p>Nenhum vídeo pendente encontrado.</p>
        ) : null}

        {items.length > 0 ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="lista de vídeos pendentes"
          >
            <table>
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Vídeo</th>
                  <th>Legenda</th>
                  <th>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.baseName}</td>
                    <td>{item.videoFile}</td>
                    <td>{item.captionFile ?? "-"}</td>
                    <td>{item.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
