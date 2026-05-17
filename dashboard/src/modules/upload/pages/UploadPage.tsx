import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useUploadModule } from "../hooks/useUploadModule";
import { scheduleService } from "../../schedule/services/schedule.service";

const FIXED_TIME_SLOTS = [
  "08:00",
  "10:30",
  "12:00",
  "14:30",
  "17:00",
  "19:30",
  "21:00",
];

export function UploadPage() {
  const {
    pendingPath,
    items,
    isLoadingList,
    isUploading,
    error,
    uploadVideo,
    loadPending,
  } = useUploadModule();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captionText, setCaptionText] = useState("");
  const [accountName, setAccountName] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSlot, setScheduleSlot] = useState("");
  const [availableSlots, setAvailableSlots] =
    useState<string[]>(FIXED_TIME_SLOTS);

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

  const scheduleAt = useMemo(() => {
    if (!scheduleDate || !scheduleSlot) {
      return "";
    }

    return `${scheduleDate}T${scheduleSlot}:00`;
  }, [scheduleDate, scheduleSlot]);

  const canSubmit = useMemo(() => {
    return Boolean(videoFile) && captionText.trim().length > 0 && !isUploading;
  }, [videoFile, captionText, isUploading]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!videoFile || !captionText.trim()) {
      return;
    }

    const ok = await uploadVideo({
      videoFile,
      captionText,
      accountName: accountName || undefined,
      scheduleAt: scheduleAt || undefined,
    });

    if (ok) {
      setVideoFile(null);
      setCaptionText("");
      setAccountName("");
      setScheduleDate("");
      setScheduleSlot("");
    }
  }

  return (
    <section className="upload-grid">
      <article className="panel-card">
        <h2>Upload de Videos</h2>
        <p className="hero-copy">Fluxo alvo do worker: {pendingPath}</p>

        <form className="upload-form" onSubmit={handleSubmit}>
          {isUploading ? (
            <div className="upload-progress" role="status" aria-live="polite">
              <span className="upload-spinner" aria-hidden="true" />
              <span>Enviando para pending, aguarde...</span>
            </div>
          ) : null}

          <label>
            Arquivo de video (.mp4)
            <input
              type="file"
              accept="video/mp4"
              disabled={isUploading}
              onChange={(event) =>
                setVideoFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <label>
            Legenda (gera o .txt)
            <textarea
              value={captionText}
              disabled={isUploading}
              onChange={(event) => setCaptionText(event.target.value)}
              rows={5}
              placeholder="Escreva a legenda com hashtags"
            />
          </label>

          <label>
            Conta (opcional)
            <input
              value={accountName}
              disabled={isUploading}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="HRM Motos"
            />
          </label>

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
            Horario fixo (opcional)
            <select
              value={scheduleSlot}
              disabled={isUploading}
              onChange={(event) => setScheduleSlot(event.target.value)}
            >
              <option value="">Selecione um horario</option>
              {availableSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </label>

          {scheduleAt ? (
            <p className="helper-text">
              Agendamento selecionado: {scheduleDate} as {scheduleSlot}
            </p>
          ) : null}

          <button type="submit" disabled={!canSubmit}>
            {isUploading ? (
              <span className="btn-busy-wrap">
                <span className="upload-spinner" aria-hidden="true" />
                <span>Enviando...</span>
              </span>
            ) : (
              "Enviar para pending"
            )}
          </button>
        </form>
      </article>

      <article className="panel-card">
        <div className="upload-list-header">
          <h2>Arquivos em pending</h2>
          <button
            type="button"
            className="link-button"
            onClick={() => void loadPending()}
          >
            Atualizar
          </button>
        </div>

        {isLoadingList ? <p>Carregando arquivos...</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {!isLoadingList && items.length === 0 ? (
          <p>Nenhum video pendente encontrado.</p>
        ) : null}

        {items.length > 0 ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="lista de videos pendentes"
          >
            <table>
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Video</th>
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
