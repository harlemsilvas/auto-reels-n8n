/**
 * ======================================
 * COMPONENT
 * ======================================
 */

export default function EmptyConversation() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-100">
      <div className="max-w-sm text-center">
        <div className="mb-4 text-5xl">📩</div>

        <h2 className="text-xl font-semibold text-zinc-800">Instagram Inbox</h2>

        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          Selecione uma conversa na lateral para visualizar as mensagens
          recebidas do Instagram.
        </p>
      </div>
    </div>
  );
}
