const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  try {
    // Hasher le mot de passe "password123"
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Vérifier si ce compte existe déjà
    let accountant = await prisma.user.findUnique({
      where: { email: 'comptable@comptabli.com' }
    });

    if (!accountant) {
      console.log('No COMPTABLE user found. Creating one...');
      accountant = await prisma.user.create({
        data: {
          email: 'comptable@comptabli.com',
          password: hashedPassword, // VRAI hash valide !
          firstName: 'Cabinet',
          lastName: 'Chevaille',
          role: 'COMPTABLE',
          status: 'VALIDATED', // IMPORTANT: Status VALIDATED pour se connecter
          companyName: 'Cabinet Chevaille',
          phone: '+216 22 000 000',
          location: 'Tunis',
        }
      });
      console.log('Created user:', accountant.email);
    } else {
      // Mettre à jour le mot de passe pour être sûr
      accountant = await prisma.user.update({
        where: { email: 'comptable@comptabli.com' },
        data: { password: hashedPassword, status: 'VALIDATED' }
      });
      console.log('User already exists. Updated password to password123 and status to VALIDATED.');
    }

    // Ensure they have an AccountantProfile
    let profile = await prisma.accountantProfile.findUnique({
      where: { accountantId: accountant.id }
    });

    if (!profile) {
      profile = await prisma.accountantProfile.create({
        data: {
          accountantId: accountant.id,
          companyName: accountant.companyName || 'Cabinet Expert',
          specialties: ['Fiscalité', 'Audit', 'Finance'],
          phone: accountant.phone || '+216 00 000 000',
          email: accountant.email,
          location: accountant.location || 'Tunis',
          bio: 'Cabinet d\'expertise comptable reconnu, accompagnant ses clients avec professionnalisme.',
          yearsExperience: 10,
          averageRating: 4.8,
          totalReviews: 24,
          isListed: true,
        }
      });
      console.log(`Created AccountantProfile for ${accountant.email}`);
    } else {
      console.log(`AccountantProfile already exists for ${accountant.email}`);
    }
    
    console.log('\n=============================================');
    console.log('Vous pouvez maintenant vous connecter avec :');
    console.log('Email : comptable@comptabli.com');
    console.log('Mot de passe : password123');
    console.log('=============================================\n');

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
