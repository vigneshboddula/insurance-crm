import { aiAvailable } from "@/lib/ai";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export const dynamic = "force-dynamic";

export default function Page() {
  return <AssistantChat available={aiAvailable()} />;
}
