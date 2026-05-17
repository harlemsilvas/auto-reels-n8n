import { useEffect, useState } from "react";
import {
  scheduleService,
  type ScheduleTimeSlot,
} from "../services/schedule.service";

type FormState = {
  label: string;
  timeValue: string;
  sortOrder: string;
};

const INITIAL_FORM: FormState = {
  label: "",
  timeValue: "",
  sortOrder: "0",
};

export function ScheduleSlotsPage() {
  const [slots, setSlots] = useState<ScheduleTimeSlot[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadSlots() {
    setIsLoading(true);
    setError(null);

    try {
      const data = await scheduleService.getSlots(false);
      setSlots(data.items);
    } catch {
      setError("Falha ao carregar horarios fixos.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSlots().catch(() => null);
  }, []);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      await scheduleService.createSlot({
        label: form.label || form.timeValue,
        timeValue: form.timeValue,
        sortOrder: Number(form.sortOrder) || 0,
        enabled: true,
      });
      setMessage("Horario salvo com sucesso.");
      setForm(INITIAL_FORM);
      await loadSlots();
    } catch {
      setError("Nao foi possivel salvar o horario.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onToggleEnabled(slot: ScheduleTimeSlot) {
    setError(null);
    setMessage(null);

    try {
      await scheduleService.updateSlot(slot.id, { enabled: !slot.enabled });
      await loadSlots();
    } catch {
      setError("Falha ao alterar status do horario.");
    }
  }

  async function onDelete(slot: ScheduleTimeSlot) {
    setError(null);
    setMessage(null);

    const confirmed = window.confirm(
      `Excluir horario ${slot.timeValue} permanentemente?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await scheduleService.deleteSlot(slot.id);
      setMessage("Horario excluido com sucesso.");
      await loadSlots();
    } catch {
      setError("Falha ao excluir horario.");
    }
  }

  return (
    <section className="dashboard-grid">
      <article className="panel-card">
        <h2>Configuracao de horarios fixos</h2>
        <p className="hero-copy">
          Defina os horarios disponiveis para agendamento no upload.
        </p>

        <form
          className="simple-form"
          style={{ marginTop: 12 }}
          onSubmit={onCreate}
        >
          <label>
            Horario (HH:MM)
            <input
              type="time"
              value={form.timeValue}
              onChange={(event) => updateForm("timeValue", event.target.value)}
              required
            />
          </label>

          <label>
            Rotulo
            <input
              value={form.label}
              onChange={(event) => updateForm("label", event.target.value)}
              placeholder="Ex.: Primeira janela"
            />
          </label>

          <label>
            Ordem
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => updateForm("sortOrder", event.target.value)}
            />
          </label>

          <button type="submit" disabled={isSaving}>
            {isSaving ? "Salvando..." : "Adicionar horario"}
          </button>
        </form>

        {message ? <p className="tone-ok">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </article>

      <article className="panel-card full-width">
        <div className="panel-actions">
          <h2 style={{ margin: 0 }}>Horarios cadastrados</h2>
          <button type="button" onClick={() => void loadSlots()}>
            Atualizar
          </button>
        </div>

        {isLoading ? <p>Carregando horarios...</p> : null}

        {!isLoading ? (
          <div className="table-wrap" role="region" aria-label="horarios fixos">
            <table>
              <thead>
                <tr>
                  <th>Horario</th>
                  <th>Rotulo</th>
                  <th>Ordem</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id}>
                    <td>{slot.timeValue}</td>
                    <td>{slot.label}</td>
                    <td>{slot.sortOrder}</td>
                    <td>{slot.enabled ? "Ativo" : "Inativo"}</td>
                    <td>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          onClick={() => void onToggleEnabled(slot)}
                        >
                          {slot.enabled ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onDelete(slot)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {slots.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Nenhum horario cadastrado.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}
