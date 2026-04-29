const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, 'src/components/PatientDashboard.tsx'),
  path.join(__dirname, 'src/components/DoctorDashboard.tsx'),
  path.join(__dirname, 'src/components/LoginGateway.tsx')
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/dark:bg-teal-900/g, 'dark:bg-emerald-900');
  content = content.replace(/dark:border-teal-800/g, 'dark:border-emerald-800');
  fs.writeFileSync(file, content, 'utf8');
  console.log(`Processed ${file}`);
});
