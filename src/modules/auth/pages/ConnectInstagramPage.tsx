import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3101";

export default function ConnectInstagramPage() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const connected = params.get("connected");
    const error = params.get("error");

    if (connected) {
      alert("Conta Instagram conectada com sucesso.");
    }

    if (error) {
      alert(`Erro ao conectar Instagram: ${error}`);
    }
  }, []);

  function handleConnectInstagram() {
    setLoading(true);

    window.location.href = `${API_URL}/api/auth/meta/login`;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-zinc-900 rounded-2xl border border-zinc-800 p-8 shadow-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Conectar Instagram</h1>

          <p className="text-zinc-400 mt-3 leading-relaxed">
            Conecte sua conta profissional do Instagram para permitir:
          </p>

          <ul className="mt-5 space-y-2 text-sm text-zinc-300">
            <li>✅ Publicação automática de Reels</li>

            <li>✅ Agendamento inteligente</li>

            <li>✅ Analytics de desempenho</li>

            <li>✅ Integração oficial Meta Graph API</li>

            <li>✅ Múltiplas contas Instagram</li>
          </ul>
        </div>

        <button
          onClick={handleConnectInstagram}
          disabled={loading}
          className="
            w-full
            rounded-xl
            bg-gradient-to-r
            from-pink-500
            via-red-500
            to-yellow-500
            px-6
            py-4
            text-lg
            font-semibold
            transition
            hover:opacity-90
            disabled:opacity-50
          "
        >
          {loading ? "Conectando..." : "Conectar com Facebook / Instagram"}
        </button>

        <div className="mt-6 text-xs text-zinc-500 leading-relaxed">
          Ao conectar sua conta, você autoriza o SocialBot a acessar permissões
          de publicação via Meta Graph API.
        </div>
      </div>
    </div>
  );
}
