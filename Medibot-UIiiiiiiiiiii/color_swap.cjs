const fs = require('fs');
const path = require('path');

const componentsDir = path.join(__dirname, 'src', 'components');

const patientReplacements = [
  // Backgrounds
  { regex: /bg-\[#0F1015\]/g, replace: 'bg-stone-50 dark:bg-teal-950' },
  { regex: /bg-\[#1A1C23\]/g, replace: 'bg-white dark:bg-teal-900' },
  { regex: /bg-\[#121318\]/g, replace: 'bg-stone-100 dark:bg-teal-900' },
  { regex: /bg-\[#1A1C23\]\/50/g, replace: 'bg-white/50 dark:bg-teal-900/50' },
  { regex: /bg-\[#1A1C23\]\/80/g, replace: 'bg-white/80 dark:bg-teal-900/80' },
  { regex: /bg-\[#121318\]\/50/g, replace: 'bg-stone-100/50 dark:bg-teal-900/50' },
  { regex: /bg-\[#121318\]\/80/g, replace: 'bg-stone-100/80 dark:bg-teal-900/80' },
  // Accents (Sky -> Emerald)
  { regex: /sky-500/g, replace: 'emerald-500 dark:emerald-400' },
  { regex: /sky-400/g, replace: 'emerald-500 dark:emerald-400' },
  { regex: /sky-600/g, replace: 'emerald-600 dark:emerald-500' },
  { regex: /sky-300/g, replace: 'emerald-400 dark:emerald-300' },
  // Text
  { regex: /text-white/g, replace: 'text-slate-900 dark:text-white' },
  { regex: /text-slate-400/g, replace: 'text-slate-500 dark:text-teal-200' },
  { regex: /text-slate-500/g, replace: 'text-slate-600 dark:text-teal-300' },
  // Borders
  { regex: /border-white\/5/g, replace: 'border-slate-200 dark:border-teal-800' },
  { regex: /border-white\/10/g, replace: 'border-slate-300 dark:border-teal-700' },
  { regex: /border-white\/20/g, replace: 'border-slate-300 dark:border-teal-600' },
  // Shadows
  { regex: /shadow-sky-500\/20/g, replace: 'shadow-emerald-500/20 dark:shadow-emerald-400/20' },
  { regex: /shadow-black\/20/g, replace: 'shadow-sm dark:shadow-black/20' },
];

const doctorReplacements = [
  // Backgrounds
  { regex: /bg-slate-50/g, replace: 'bg-stone-50 dark:bg-teal-950' },
  { regex: /bg-white/g, replace: 'bg-white dark:bg-teal-900' },
  { regex: /bg-\[#0F172A\]/g, replace: 'bg-stone-100 dark:bg-teal-950' }, // sidebar bg
  // Accents
  { regex: /sky-500/g, replace: 'emerald-500 dark:emerald-400' },
  { regex: /sky-600/g, replace: 'emerald-600 dark:emerald-500' },
  { regex: /sky-400/g, replace: 'emerald-500 dark:emerald-400' },
  { regex: /sky-50/g, replace: 'emerald-50 dark:teal-900' },
  { regex: /sky-100/g, replace: 'emerald-100 dark:teal-800' },
  { regex: /sky-200/g, replace: 'emerald-200 dark:teal-700' },
  { regex: /sky-700/g, replace: 'emerald-700 dark:emerald-300' },
  // Text
  { regex: /text-slate-900/g, replace: 'text-slate-900 dark:text-white' },
  { regex: /text-slate-800/g, replace: 'text-slate-800 dark:text-slate-100' },
  { regex: /text-slate-700/g, replace: 'text-slate-700 dark:text-slate-200' },
  { regex: /text-slate-600/g, replace: 'text-slate-600 dark:text-teal-100' },
  { regex: /text-slate-500/g, replace: 'text-slate-500 dark:text-teal-200' },
  { regex: /text-slate-400/g, replace: 'text-slate-400 dark:text-teal-300' },
  { regex: /text-white/g, replace: 'text-white' }, // Explicit white stays white
  // Borders
  { regex: /border-slate-200/g, replace: 'border-slate-200 dark:border-teal-800' },
  { regex: /border-slate-100/g, replace: 'border-slate-100 dark:border-teal-800' },
  { regex: /border-slate-800/g, replace: 'border-slate-800 dark:border-teal-800' },
];

function processFile(filename, replacements) {
  const filePath = path.join(componentsDir, filename);
  let content = fs.readFileSync(filePath, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.regex, r.replace);
  });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${filename}`);
}

processFile('PatientDashboard.tsx', patientReplacements);
processFile('DoctorDashboard.tsx', doctorReplacements);
processFile('LoginGateway.tsx', patientReplacements);
