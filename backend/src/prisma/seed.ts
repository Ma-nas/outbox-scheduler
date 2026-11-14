import bcrypt from 'bcryptjs';
import prisma from './db';

async function seed() {
  console.log('[Seed] Seeding ReachInbox Outbox Database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'admin@reachinbox.ai' },
    update: {},
    create: {
      email: 'admin@reachinbox.ai',
      name: 'ReachInbox Lead Evaluator',
      password: hashedPassword,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    },
  });

  console.log(`[Seed] Seeded user: ${user.email} (Password: admin123)`);

  // Create sender accounts
  const senders = [
    { name: 'Primary Outreach Agent', email: 'outbox-agent-1@reachinbox.ai', isDefault: true },
    { name: 'Secondary Inbound Lead', email: 'outbox-agent-2@reachinbox.ai', isDefault: false },
    { name: 'Enterprise Partnership', email: 'partnerships@reachinbox.ai', isDefault: false },
  ];

  for (const s of senders) {
    await prisma.senderAccount.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    });
  }

  console.log(`[Seed] Seeded ${senders.length} multi-sender accounts.`);
  console.log('[Seed] Seeding complete.');
  process.exit(0);
}

seed().catch((e) => {
  console.error('[Seed Error]', e);
  process.exit(1);
});
