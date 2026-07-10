// Seeds the CRM with realistic demo data so you can test immediately.
// Run with: npm run db:seed   (or it runs as part of `npm run setup`)

import { PrismaClient } from "@prisma/client";
import { encrypt } from "../lib/crypto";

// Load .env (DATABASE_URL, ENCRYPTION_KEY) when run directly via tsx.
try {
  // Node 20.12+/21.7+/25 built-in — no dotenv dependency needed.
  (process as any).loadEnvFile?.();
} catch {
  /* .env already loaded by the Prisma CLI, ignore */
}

const prisma = new PrismaClient();

// ── date helpers (relative to "today" so the dashboard always has live data) ──
const today = new Date();
function addDays(n: number) {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  d.setHours(9, 0, 0, 0);
  return d;
}
function addMonths(n: number) {
  const d = new Date(today);
  d.setMonth(d.getMonth() + n);
  return d;
}
function yearsAgo(n: number) {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - n);
  return d;
}

async function main() {
  console.log("🌱 Seeding Insurance CRM demo data…");

  // Wipe existing demo data (safe on a local dev DB)
  await prisma.$transaction([
    prisma.commission.deleteMany(),
    prisma.renewal.deleteMany(),
    prisma.claim.deleteMany(),
    prisma.communication.deleteMany(),
    prisma.task.deleteMany(),
    prisma.document.deleteMany(),
    prisma.policy.deleteMany(),
    prisma.lead.deleteMany(),
    prisma.clientVault.deleteMany(),
    prisma.client.deleteMany(),
    prisma.household.deleteMany(),
    prisma.messageTemplate.deleteMany(),
    prisma.aIInsight.deleteMany(),
    prisma.agent.deleteMany(),
  ]);

  // ── The agent (you) ──
  await prisma.agent.create({
    data: {
      name: "Vignesh",
      email: "vigneshbunty07@gmail.com",
      phone: "+919000000000",
    },
  });

  // ── Households ──
  const sharma = await prisma.household.create({
    data: { name: "Sharma Family", address: "Plot 22, Madhapur, Hyderabad 500081" },
  });
  const reddy = await prisma.household.create({
    data: { name: "Reddy Family", address: "Flat 4B, Gachibowli, Hyderabad 500032" },
  });
  const khan = await prisma.household.create({
    data: { name: "Khan Family", address: "12-3-45, Secunderabad 500003" },
  });

  // ── Clients ──
  const ramesh = await prisma.client.create({
    data: {
      name: "Ramesh Sharma",
      phone: "+919812345678",
      email: "ramesh.sharma@example.com",
      address: "Plot 22, Madhapur, Hyderabad 500081",
      dob: new Date("1980-04-12"),
      occupation: "Software Architect",
      incomeBand: "25L+",
      gender: "male",
      relationship: "self",
      tags: "high-value,renewal-due",
      householdId: sharma.id,
      vault: {
        create: {
          aadhaarEnc: encrypt("4567 8901 2345"),
          panEnc: encrypt("ABCPS1234K"),
          whatsappNumber: "+919812345678",
          postalAddress: "Plot 22, Madhapur, Hyderabad 500081",
          dob: new Date("1980-04-12"),
          nomineeName: "Sunita Sharma",
          nomineeRelation: "spouse",
        },
      },
    },
  });

  const sunita = await prisma.client.create({
    data: {
      name: "Sunita Sharma",
      phone: "+919812300011",
      email: "sunita.sharma@example.com",
      dob: new Date("1984-09-03"),
      occupation: "Homemaker",
      incomeBand: "<5L",
      gender: "female",
      relationship: "spouse",
      tags: "household",
      householdId: sharma.id,
      vault: {
        create: {
          aadhaarEnc: encrypt("7788 9900 1122"),
          panEnc: encrypt("DEFPS5678L"),
          whatsappNumber: "+919812300011",
          nomineeName: "Ramesh Sharma",
          nomineeRelation: "spouse",
        },
      },
    },
  });

  const arjun = await prisma.client.create({
    data: {
      name: "Arjun Reddy",
      phone: "+919845512300",
      email: "arjun.reddy@example.com",
      address: "Flat 4B, Gachibowli, Hyderabad 500032",
      dob: new Date("1990-11-21"),
      occupation: "Entrepreneur",
      incomeBand: "10-25L",
      gender: "male",
      relationship: "self",
      tags: "high-value",
      householdId: reddy.id,
      vault: {
        create: {
          aadhaarEnc: encrypt("2233 4455 6677"),
          panEnc: encrypt("GHIPR9012M"),
          whatsappNumber: "+919845512300",
          nomineeName: "Priya Reddy",
          nomineeRelation: "spouse",
        },
      },
    },
  });

  const priya = await prisma.client.create({
    data: {
      name: "Priya Reddy",
      phone: "+919845599881",
      dob: new Date("1992-02-14"),
      occupation: "Doctor",
      incomeBand: "10-25L",
      gender: "female",
      relationship: "spouse",
      householdId: reddy.id,
    },
  });

  const imran = await prisma.client.create({
    data: {
      name: "Imran Khan",
      phone: "+919701122334",
      email: "imran.khan@example.com",
      address: "12-3-45, Secunderabad 500003",
      dob: new Date("1975-07-30"),
      occupation: "Shop Owner",
      incomeBand: "5-10L",
      gender: "male",
      relationship: "self",
      tags: "renewal-due,lapse-risk",
      householdId: khan.id,
      vault: {
        create: {
          aadhaarEnc: encrypt("9988 7766 5544"),
          panEnc: encrypt("JKLPK3456N"),
          whatsappNumber: "+919701122334",
          nomineeName: "Ayesha Khan",
          nomineeRelation: "spouse",
        },
      },
    },
  });

  const lakshmi = await prisma.client.create({
    data: {
      name: "Lakshmi Devi",
      phone: "+919966554433",
      dob: new Date("1968-12-05"),
      occupation: "Retired Teacher",
      incomeBand: "5-10L",
      gender: "female",
      relationship: "self",
      tags: "senior",
    },
  });

  // ── Policies (Life / Term / Health) with varied renewal dates ──
  const policies = await Promise.all([
    // Ramesh — term (due in 3 days → amber), health (future)
    prisma.policy.create({
      data: {
        clientId: ramesh.id,
        line: "term",
        carrier: "HDFC Life",
        policyNumber: "HDFC-TRM-100245",
        planName: "Click 2 Protect Super",
        sumAssured: 10000000,
        premium: 18500,
        frequency: "annual",
        paymentMode: "online",
        startDate: yearsAgo(3),
        renewalDate: addDays(3),
        status: "active",
        nomineeName: "Sunita Sharma",
        nomineeRelation: "spouse",
        commission: { create: { expectedAmount: 4625, receivedAmount: 4625, status: "received", payoutDate: yearsAgo(3) } },
      },
    }),
    prisma.policy.create({
      data: {
        clientId: ramesh.id,
        line: "health",
        carrier: "Star Health",
        policyNumber: "STAR-HLT-558210",
        planName: "Family Health Optima",
        sumAssured: 1000000,
        premium: 32000,
        frequency: "annual",
        paymentMode: "auto_debit",
        startDate: addMonths(-7),
        renewalDate: addMonths(5),
        status: "active",
        commission: { create: { expectedAmount: 4800, status: "pending" } },
      },
    }),
    // Sunita — health floater (overdue → red)
    prisma.policy.create({
      data: {
        clientId: sunita.id,
        line: "health",
        carrier: "Niva Bupa",
        policyNumber: "NIVA-HLT-220119",
        planName: "ReAssure 2.0",
        sumAssured: 500000,
        premium: 14500,
        frequency: "annual",
        paymentMode: "online",
        startDate: yearsAgo(1),
        renewalDate: addDays(-6),
        status: "active",
        commission: { create: { expectedAmount: 2175, status: "pending" } },
      },
    }),
    // Arjun — term (due in 21 days → this month)
    prisma.policy.create({
      data: {
        clientId: arjun.id,
        line: "term",
        carrier: "ICICI Pru",
        policyNumber: "ICICI-TRM-778451",
        planName: "iProtect Smart",
        sumAssured: 20000000,
        premium: 26000,
        frequency: "annual",
        paymentMode: "online",
        startDate: yearsAgo(2),
        renewalDate: addDays(21),
        status: "active",
        nomineeName: "Priya Reddy",
        nomineeRelation: "spouse",
        commission: { create: { expectedAmount: 6500, status: "pending" } },
      },
    }),
    // Imran — health (overdue → red, lapse risk), life endowment (future)
    prisma.policy.create({
      data: {
        clientId: imran.id,
        line: "health",
        carrier: "Star Health",
        policyNumber: "STAR-HLT-661004",
        planName: "Senior Citizens Red Carpet",
        sumAssured: 700000,
        premium: 28000,
        frequency: "annual",
        paymentMode: "cheque",
        startDate: yearsAgo(1),
        renewalDate: addDays(-12),
        status: "active",
        commission: { create: { expectedAmount: 4200, status: "pending" } },
      },
    }),
    prisma.policy.create({
      data: {
        clientId: imran.id,
        line: "life",
        carrier: "LIC",
        policyNumber: "LIC-END-903311",
        planName: "Jeevan Anand",
        sumAssured: 1500000,
        premium: 62000,
        frequency: "annual",
        paymentMode: "agent",
        startDate: yearsAgo(5),
        renewalDate: addMonths(4),
        maturityDate: addMonths(180),
        status: "active",
        nomineeName: "Ayesha Khan",
        nomineeRelation: "spouse",
        commission: { create: { expectedAmount: 3100, receivedAmount: 3100, status: "received", payoutDate: yearsAgo(5) } },
      },
    }),
    // Lakshmi — life (matured), health (due in 9 days → amber)
    prisma.policy.create({
      data: {
        clientId: lakshmi.id,
        line: "health",
        carrier: "Niva Bupa",
        policyNumber: "NIVA-HLT-330078",
        planName: "Senior First",
        sumAssured: 500000,
        premium: 22000,
        frequency: "annual",
        paymentMode: "online",
        startDate: yearsAgo(1),
        renewalDate: addDays(9),
        status: "active",
        commission: { create: { expectedAmount: 3300, status: "pending" } },
      },
    }),
  ]);

  // ── Enrich policies with newer fields + insured members (family model) ──
  for (const p of policies) {
    await prisma.policy.update({
      where: { id: p.id },
      data: {
        variant: p.planName,
        tenureYears: 1,
        firstInception: p.startDate,
        deductible: p.line === "health" ? 0 : null,
        source: "manual",
      },
    });
    await prisma.policyVersion.create({
      data: {
        policyId: p.id,
        policyNumber: p.policyNumber,
        yearLabel: `${p.startDate.getFullYear()}-${String((p.startDate.getFullYear() + 1) % 100).padStart(2, "0")}`,
        premium: p.premium,
        sumInsured: p.sumAssured,
        startDate: p.startDate,
        endDate: p.renewalDate,
        dueDate: p.renewalDate,
        status: "active",
        source: "manual",
      },
    });
  }
  const insure = async (policyId: string, members: { name: string; relation: string; clientId?: string; age?: number }[]) => {
    for (const m of members) await prisma.policyInsured.create({ data: { policyId, ...m } });
  };
  await insure(policies[0].id, [{ name: "Ramesh Sharma", relation: "Self", clientId: ramesh.id, age: 46 }]);
  await insure(policies[1].id, [
    { name: "Ramesh Sharma", relation: "Self", clientId: ramesh.id, age: 46 },
    { name: "Sunita Sharma", relation: "Wife", clientId: sunita.id, age: 41 },
  ]);
  await insure(policies[2].id, [{ name: "Sunita Sharma", relation: "Self", clientId: sunita.id, age: 41 }]);
  await insure(policies[3].id, [{ name: "Arjun Reddy", relation: "Self", clientId: arjun.id, age: 35 }]);
  await insure(policies[4].id, [
    { name: "Imran Khan", relation: "Self", clientId: imran.id, age: 50 },
    { name: "Ayesha Khan", relation: "Wife", age: 45 },
  ]);
  await insure(policies[5].id, [{ name: "Imran Khan", relation: "Self", clientId: imran.id, age: 50 }]);
  await insure(policies[6].id, [{ name: "Lakshmi Devi", relation: "Self", clientId: lakshmi.id, age: 57 }]);

  await prisma.client.update({ where: { id: ramesh.id }, data: { altPhone: "+919812300099" } });
  await prisma.client.update({ where: { id: arjun.id }, data: { altPhone: "+919845500077" } });

  // ── Renewal rows for active policies (mirrors each policy's due date) ──
  for (const p of policies) {
    if (p.status === "active") {
      await prisma.renewal.create({
        data: {
          policyId: p.id,
          dueDate: p.renewalDate,
          amount: p.premium,
          status: p.renewalDate < today ? "pending" : "pending",
        },
      });
    }
  }

  // ── A claim in progress ──
  await prisma.claim.create({
    data: {
      policyId: policies[1].id, // Ramesh — Star Health
      clientId: ramesh.id,
      claimNumber: "CLM-2026-00891",
      reason: "Hospitalisation — dengue",
      amount: 85000,
      status: "processing",
      notes: "Cashless approved at Apollo. Awaiting final bill settlement.",
      intimatedAt: addDays(-8),
    },
  });

  // ── Leads (pipeline) ──
  await prisma.lead.createMany({
    data: [
      { name: "Suresh Babu", phone: "+919887766554", source: "referral", stage: "quoted", interest: "term", expectedPremium: 22000, notes: "Referred by Ramesh. Wants 1.5Cr term cover." },
      { name: "Anita Rao", phone: "+919776655443", source: "social", stage: "contacted", interest: "health", expectedPremium: 18000, notes: "Saw Instagram post. Family floater for 4." },
      { name: "Venkat Naidu", phone: "+919665544332", source: "walk_in", stage: "new", interest: "health", expectedPremium: 15000, notes: "Walk-in at office. Comparing plans." },
      { name: "Deepa Menon", phone: "+919554433221", source: "website", stage: "new", interest: "term", expectedPremium: 30000, notes: "Filled website enquiry form." },
    ],
  });

  // ── Tasks / follow-ups ──
  await prisma.task.createMany({
    data: [
      { clientId: imran.id, title: "Call Imran re: overdue health renewal", type: "call", dueDate: addDays(0), notes: "Health policy overdue 12 days — high lapse risk." },
      { clientId: sunita.id, title: "Send renewal reminder to Sunita (WhatsApp)", type: "renewal", dueDate: addDays(0) },
      { clientId: ramesh.id, title: "Follow up on dengue claim settlement", type: "follow_up", dueDate: addDays(2) },
      { clientId: arjun.id, title: "Pitch health floater to Arjun (cross-sell)", type: "follow_up", dueDate: addDays(5) },
      { title: "Quote 1.5Cr term for Suresh Babu", type: "follow_up", dueDate: addDays(1) },
    ],
  });

  // ── Communication history ──
  await prisma.communication.createMany({
    data: [
      { clientId: ramesh.id, channel: "call", direction: "outbound", subject: "Claim update", body: "Informed cashless approved; awaiting final bill.", outcome: "positive", occurredAt: addDays(-7) },
      { clientId: imran.id, channel: "whatsapp", direction: "outbound", subject: "Renewal reminder", body: "Reminder sent for Star Health renewal.", status: "delivered", occurredAt: addDays(-15) },
      { clientId: arjun.id, channel: "meeting", direction: "outbound", subject: "Annual review", body: "Discussed increasing term cover; interested in health.", outcome: "follow-up", occurredAt: addDays(-20) },
    ],
  });

  // ── WhatsApp message templates (English + Telugu) ──
  await prisma.messageTemplate.createMany({
    data: [
      {
        name: "Welcome / Onboarding (EN)",
        category: "onboarding",
        language: "en",
        body: "Hello {{name}}, welcome aboard! 🎉 Your policy {{policyNumber}} is now active. Save my number for any help with claims or renewals. — Vignesh",
      },
      {
        name: "Welcome / Onboarding (TE)",
        category: "onboarding",
        language: "te",
        body: "నమస్కారం {{name}} గారు! మీ పాలసీ {{policyNumber}} ఇప్పుడు యాక్టివ్‌గా ఉంది. క్లెయిమ్‌లు లేదా రెన్యూవల్‌ల కోసం నా నంబర్‌ను సేవ్ చేసుకోండి. — విఘ్నేష్",
      },
      {
        name: "Renewal Reminder (EN)",
        category: "renewal",
        language: "en",
        body: "Hi {{name}}, a friendly reminder that your policy {{policyNumber}} is due for renewal on {{dueDate}}. Premium: {{amount}}. Reply here and I'll help you renew quickly. — Vignesh",
      },
      {
        name: "Renewal Reminder (TE)",
        category: "renewal",
        language: "te",
        body: "నమస్కారం {{name}} గారు, మీ పాలసీ {{policyNumber}} {{dueDate}} నాటికి రెన్యూవల్ చేయాలి. ప్రీమియం: {{amount}}. రెన్యూవల్ కోసం నాకు రిప్లై ఇవ్వండి. — విఘ్నేష్",
      },
      {
        name: "Claim Update (EN)",
        category: "claim",
        language: "en",
        body: "Hi {{name}}, an update on your claim {{policyNumber}}: it is currently being processed. I'll keep you posted at every step. — Vignesh",
      },
    ],
  });

  // ── Realistic activity & history (powers rings, streak, momentum) ──

  // Normalize enrolment dates so "new this month" / "today" metrics aren't
  // skewed by everything being created at seed time.
  await prisma.policy.updateMany({ data: { createdAt: addDays(-45) } });
  await prisma.lead.updateMany({ data: { createdAt: addDays(-12) } });

  // A lead you added today → powers the "new business" activity ring.
  await prisma.lead.create({
    data: {
      name: "Pranav Joshi",
      phone: "+919900112233",
      source: "referral",
      stage: "new",
      interest: "health",
      expectedPremium: 16000,
      notes: "Added today — referral from Arjun.",
      createdAt: addDays(0),
    },
  });

  // A quote you sent 3 days ago and haven't followed up (powers the 48h alert).
  await prisma.lead.create({
    data: {
      name: "Kavya Nair",
      phone: "+919812011223",
      source: "website",
      stage: "quoted",
      interest: "term",
      expectedPremium: 28000,
      notes: "Quoted 1Cr term 3 days ago — awaiting decision.",
      createdAt: addDays(-3),
    },
  });

  // Two follow-ups you completed today.
  await prisma.task.createMany({
    data: [
      { clientId: arjun.id, title: "Called Arjun — annual review booked", type: "call", dueDate: addDays(0), done: true },
      { clientId: ramesh.id, title: "Logged claim update for Ramesh", type: "follow_up", dueDate: addDays(0), done: true },
    ],
  });

  // Renewals already closed — one today, one earlier this month.
  await prisma.renewal.create({
    data: { policyId: policies[3].id, dueDate: addDays(-1), amount: policies[3].premium, status: "renewed", renewedAt: addDays(0) },
  });
  await prisma.renewal.create({
    data: { policyId: policies[6].id, dueDate: addDays(-4), amount: policies[6].premium, status: "renewed", renewedAt: addDays(-4) },
  });

  // A 14-day touchpoint streak — one logged interaction per day.
  const streakClients = [ramesh.id, imran.id, arjun.id, sunita.id, lakshmi.id];
  const streakChannels = ["call", "whatsapp", "email"];
  for (let i = 0; i < 14; i++) {
    await prisma.communication.create({
      data: {
        clientId: streakClients[i % streakClients.length],
        channel: streakChannels[i % streakChannels.length],
        direction: "outbound",
        subject: "Check-in",
        body: "Logged touchpoint.",
        occurredAt: addDays(-i),
      },
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Clients:", await prisma.client.count());
  console.log("   Policies:", await prisma.policy.count());
  console.log("   Renewals:", await prisma.renewal.count());
  console.log("   Leads:", await prisma.lead.count());
  console.log("   Templates:", await prisma.messageTemplate.count());
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
