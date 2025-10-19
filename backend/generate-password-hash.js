// Generate password hash for Admin@123
const bcrypt = require('bcryptjs');

const password = 'Admin@123';

bcrypt.hash(password, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  console.log('\n==============================================');
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('==============================================\n');
  console.log('SQL Insert Query:');
  console.log(`UPDATE employee SET password = '${hash}' WHERE username = 'admin';`);
  console.log('==============================================\n');
  
  // Test the hash
  bcrypt.compare(password, hash, (err, result) => {
    console.log('Verification test:', result ? '✅ PASS' : '❌ FAIL');
    process.exit(0);
  });
});
