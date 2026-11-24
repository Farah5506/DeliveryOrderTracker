require('dotenv').config({ quiet: true });
const authService = require('../services/authService');

async function main() {
  const [role, fullName, email, password, phone, vehicleType] = process.argv.slice(2);

  if (!['dispatcher', 'courier'].includes(role) || !fullName || !email || !password) {
    console.log('Usage: node scripts/seed-user.js <dispatcher|courier> "Full Name" email password [phone vehicleType]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.log('The password must be at least 8 characters.');
    process.exit(1);
  }

  const existing = await authService.findUserByEmail(email);
  if (existing) {
    console.log(`  ${email} already exists (${existing.role}), nothing to do.`);
    return;
  }

  const extra = role === 'courier'
    ? { phone: phone || '01000000000', vehicleType: vehicleType || 'motorcycle', availability: 'available' }
    : {};
  const user = await authService.createUser({ fullName, email, password, role, extra });
  console.log(`  created ${role} ${user.fullName} <${user.email}> (id ${user.id})`);
}

main().catch((error) => {
  console.error(`  could not create the user: ${error.message}`);
  process.exit(1);
});
