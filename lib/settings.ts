import { prisma } from "@/lib/db";

// Single-row app settings, created on first read with sensible defaults.
export async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
}
