import { notFound } from "next/navigation";
import { getInbox } from "@/server/inbox.service";
import { InboxWorkspace } from "@/components/inbox/InboxWorkspace";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autorun?: string }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const item = await getInbox(id);
  if (!item) notFound();

  const initial = {
    id: item.id,
    channel: item.channel,
    fromName: item.fromName,
    fromEmail: item.fromEmail,
    subject: item.subject,
    bodyText: item.bodyText,
    receivedAt: item.receivedAt.toISOString(),
    status: item.status,
    category: item.category,
    draftReply: item.draftReply,
    customer: item.customer
      ? { id: item.customer.id, companyName: item.customer.companyName, email: item.customer.email }
      : null,
    assignedTo: item.assignedTo
      ? { id: item.assignedTo.id, name: item.assignedTo.name, role: item.assignedTo.role }
      : null,
  };

  return <InboxWorkspace initial={initial} autorun={sp.autorun === "1"} />;
}
