import { MessagesSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function EmptyConversation() {
  const { t } = useTranslation("inbox");
  return <div className="inbox-empty"><MessagesSquare size={40} strokeWidth={1.3} /><h3>{t("noSelection")}</h3></div>;
}
