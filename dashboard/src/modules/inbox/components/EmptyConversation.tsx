import { MessagesSquare } from "lucide-react";

export default function EmptyConversation() {
  return <div className="inbox-empty"><MessagesSquare size={40} strokeWidth={1.3} /><h3>Nenhuma conversa selecionada</h3></div>;
}
