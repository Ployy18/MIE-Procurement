import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'admin123';
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(password, salt);

console.log('--- PASSWORD HASH TOOL ---');
console.log('Password:', password);
console.log('Hash (use this in Google Sheets):');
console.log(hash);
console.log('---------------------------');
