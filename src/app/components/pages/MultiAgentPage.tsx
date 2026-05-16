import { MultiAgentChatPanel } from "../MultiAgentChatPanel";
import { PageHeader } from "../crm-ui/page-header";

export function MultiAgentPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Multi-Agent Assistant"
        description="7 specialized AI agents working together to help you manage contacts, deals, emails, pipeline, tasks, and meetings."
      />
      <div className="flex-1 p-6">
        <div className="h-full max-w-5xl mx-auto">
          <MultiAgentChatPanel />
        </div>
      </div>
    </div>
  );
}
