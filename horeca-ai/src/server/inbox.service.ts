import { prisma } from "@/lib/db";
import type { InboxStatus } from "@prisma/client";

export async function listInbox(filter?: { status?: InboxStatus; assignedToId?: string | null }) {
  return prisma.inboxItem.findMany({
    where: {
      ...(filter?.status ? { status: filter.status } : {}),
      ...(filter?.assignedToId !== undefined
        ? { assignedToId: filter.assignedToId }
        : {}),
    },
    include: { customer: true, assignedTo: { select: { id: true, name: true, role: true } } },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
}

export async function getInbox(id: string) {
  return prisma.inboxItem.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true, role: true } },
      attachments: true,
      conversation: { include: { messages: true } },
    },
  });
}
