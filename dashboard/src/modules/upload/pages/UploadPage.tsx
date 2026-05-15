import { useMemo, useState, type FormEvent } from "react";
import { useUploadModule } from "../hooks/useUploadModule";

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
  const [scheduleAt, setScheduleAt] = useState("");

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
      setScheduleAt("");
    }
  }

  return (
    <section className="upload-grid">
      <article className="panel-card">
        <h2>Upload de Videos</h2>
        <p className="hero-copy">Fluxo alvo do worker: {pendingPath}</p>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label>
            Arquivo de video (.mp4)
            <input
              type="file"
              accept="video/mp4"
              onChange={(event) =>
                setVideoFile(event.target.files?.[0] ?? null)
              }
            />
          </label>

          <label>
            Legenda (gera o .txt)
            <textarea
              value={captionText}
              onChange={(event) => setCaptionText(event.target.value)}
              rows={5}
              placeholder="Escreva a legenda com hashtags"
            />
          </label>

          <label>
            Conta (opcional)
            <input
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
              placeholder="HRM Motos"
            />
          </label>

          <label>
            Agendar para (opcional)
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </label>

          <button type="submit" disabled={!canSubmit}>
            {isUploading ? "Enviando..." : "Enviar para pending"}
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
