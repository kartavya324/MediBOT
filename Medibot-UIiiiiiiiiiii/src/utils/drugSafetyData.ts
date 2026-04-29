export const DRUG_INTERACTIONS: Record<string, { conflictsWith: string[]; risk: string }> = {
  'aspirin': { conflictsWith: ['warfarin', 'heparin', 'ibuprofen', 'naproxen'], risk: 'High Bleeding Risk' },
  'warfarin': { conflictsWith: ['aspirin', 'ibuprofen', 'amiodarone'], risk: 'Severe Bleeding Risk' },
  'metformin': { conflictsWith: ['iodinated contrast', 'topiramate'], risk: 'Lactic Acidosis / Kidney Strain' },
  'lisinopril': { conflictsWith: ['spironolactone', 'potassium'], risk: 'Hyperkalemia (High Potassium)' },
  'simvastatin': { conflictsWith: ['amiodarone', 'diltiazem', 'grapefruit'], risk: 'Increased risk of muscle damage (Myopathy)' },
  'sildenafil': { conflictsWith: ['nitroglycerin', 'isosorbide'], risk: 'Severe Hypotension (Dangerous drop in blood pressure)' },
  'ciprofloxacin': { conflictsWith: ['tizanidine', 'theophylline'], risk: 'Increased toxicity of concurrent medication' },
  'ibuprofen': { conflictsWith: ['aspirin', 'warfarin', 'lithium'], risk: 'Gastrointestinal bleeding / Kidney strain' },
};

export const checkInteractions = (newDrug: string, currentMeds: string[]): string | null => {
  const newDrugLower = newDrug.toLowerCase();
  
  // Check if new drug is in our database
  for (const [knownDrug, data] of Object.entries(DRUG_INTERACTIONS)) {
    // Case 1: The new drug is the known drug, check against current meds
    if (newDrugLower.includes(knownDrug)) {
      for (const current of currentMeds) {
        if (data.conflictsWith.some(conflict => current.toLowerCase().includes(conflict))) {
          return `Interacts with ${current} (${data.risk})`;
        }
      }
    }
    
    // Case 2: The new drug is a conflict of a known drug that the patient is already taking
    if (data.conflictsWith.some(conflict => newDrugLower.includes(conflict))) {
      for (const current of currentMeds) {
        if (current.toLowerCase().includes(knownDrug)) {
          return `Interacts with ${current} (${data.risk})`;
        }
      }
    }
  }

  return null;
};
