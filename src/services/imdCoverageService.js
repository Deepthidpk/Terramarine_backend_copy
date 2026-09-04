/**
 * Centralized IMD Coverage Region Mapping Service
 * Maps registered location (State, District, Municipality, Coastal Area)
 * to authoritative IMD Coastal Layers and Port Identifiers.
 */

const NORTH_KERALA_DISTRICTS = ['malappuram', 'kasargod', 'kasaragod', 'kannur', 'kozhikode', 'thrissur'];
const SOUTH_KERALA_DISTRICTS = ['ernakulam', 'alappuzha', 'kollam', 'thiruvananthapuram'];

const KERALA_PORT_MAPPINGS = [
  { keywords: ['ponnani'], portName: 'Ponnani' },
  { keywords: ['beypore'], portName: 'Beypore' },
  { keywords: ['vizhinjam', 'kovalam'], portName: 'Vizhinjam' },
  { keywords: ['neendakara', 'sakthikulangara'], portName: 'Neendakara' },
  { keywords: ['kochi', 'cochin', 'fort kochi', 'vypin', 'munambam'], portName: 'Cochin' },
  { keywords: ['alappuzha', 'alleppey', 'thottappally'], portName: 'Alleppey' },
  { keywords: ['thangassery', 'kollam beach'], portName: 'Thangassery' },
  { keywords: ['azheekal'], portName: 'Azheekal' },
  { keywords: ['vatakara', 'chombala'], portName: 'Vatakara' },
  { keywords: ['koyilandy'], portName: 'Koyilandy' }
];

/**
 * Resolve IMD Coverage Region & Port Mapping
 * @param {string} state 
 * @param {string} district 
 * @param {string} municipality 
 * @param {string} coastalArea 
 * @returns {object} IMD Coverage metadata
 */
function resolveImdCoverage(state = '', district = '', municipality = '', coastalArea = '') {
  const cleanState = (state || '').trim().toLowerCase();
  const cleanDistrict = (district || '').trim().toLowerCase();
  const cleanMuni = (municipality || '').trim().toLowerCase();
  const cleanArea = (coastalArea || '').trim().toLowerCase();

  const combinedText = `${cleanArea} ${cleanMuni} ${cleanDistrict} ${cleanState}`;

  // 1. KERALA
  if (cleanState.includes('kerala')) {
    let portName = null;
    for (const item of KERALA_PORT_MAPPINGS) {
      if (item.keywords.some(kw => combinedText.includes(kw))) {
        portName = item.portName;
        break;
      }
    }

    // Check if North Kerala
    if (NORTH_KERALA_DISTRICTS.some(d => cleanDistrict.includes(d) || combinedText.includes(d))) {
      return {
        region: 'North Kerala Coast',
        layerKeywords: ['north kerala coast', 'north kerala', 'north coast of kerala'],
        seaAreaKeywords: ['south east arabian sea', 'kerala coast', 'lakshadweep-kerala', 'arabian sea'],
        portName: portName || (cleanDistrict.includes('malappuram') ? 'Ponnani' : null),
        state: 'Kerala'
      };
    }

    // Check if South Kerala
    if (SOUTH_KERALA_DISTRICTS.some(d => cleanDistrict.includes(d) || combinedText.includes(d))) {
      return {
        region: 'South Kerala Coast',
        layerKeywords: ['south kerala coast', 'south kerala', 'south coast of kerala'],
        seaAreaKeywords: ['south east arabian sea', 'kerala coast', 'lakshadweep-kerala', 'arabian sea'],
        portName: portName || (cleanDistrict.includes('ernakulam') ? 'Cochin' : null),
        state: 'Kerala'
      };
    }

    // Fallback for general Kerala if district not matched
    return {
      region: 'Kerala Coast',
      layerKeywords: ['kerala coast', 'kerala'],
      seaAreaKeywords: ['south east arabian sea', 'kerala coast', 'arabian sea'],
      portName: portName,
      state: 'Kerala'
    };
  }

  // 2. LAKSHADWEEP
  if (cleanState.includes('lakshadweep') || combinedText.includes('lakshadweep')) {
    return {
      region: 'Lakshadweep Area',
      layerKeywords: ['lakshadweep area', 'lakshadweep'],
      seaAreaKeywords: ['lakshadweep area', 'south east arabian sea'],
      portName: 'Kavaratti',
      state: 'Lakshadweep'
    };
  }

  // 3. KARNATAKA
  if (cleanState.includes('karnataka') || combinedText.includes('mangaluru') || combinedText.includes('udupi')) {
    return {
      region: 'Karnataka Coast',
      layerKeywords: ['karnataka coast', 'karnataka'],
      seaAreaKeywords: ['east central arabian sea', 'south east arabian sea', 'karnataka coast'],
      portName: combinedText.includes('mangaluru') ? 'New Mangalore' : 'Malpe',
      state: 'Karnataka'
    };
  }

  // 4. TAMIL NADU
  if (cleanState.includes('tamil nadu') || combinedText.includes('chennai') || combinedText.includes('kanyakumari')) {
    return {
      region: 'Tamil Nadu Coast',
      layerKeywords: ['tamil nadu coast', 'tamil nadu', 'chennai coast'],
      seaAreaKeywords: ['bay of bengal', 'gulf of mannar', 'comorin area', 'tamil nadu coast'],
      portName: combinedText.includes('chennai') ? 'Chennai' : 'Tuticorin',
      state: 'Tamil Nadu'
    };
  }

  // 5. GOA
  if (cleanState.includes('goa') || combinedText.includes('panaji')) {
    return {
      region: 'Goa Coast',
      layerKeywords: ['goa coast', 'maharashtra-goa coast', 'goa'],
      seaAreaKeywords: ['east central arabian sea', 'goa coast'],
      portName: 'Mormugao',
      state: 'Goa'
    };
  }

  // 6. MAHARASHTRA
  if (cleanState.includes('maharashtra') || combinedText.includes('mumbai')) {
    return {
      region: 'Maharashtra Coast',
      layerKeywords: ['maharashtra coast', 'mumbai coast', 'maharashtra'],
      seaAreaKeywords: ['north east arabian sea', 'east central arabian sea'],
      portName: 'Mumbai',
      state: 'Maharashtra'
    };
  }

  // 7. GUJARAT
  if (cleanState.includes('gujarat') || combinedText.includes('veraval') || combinedText.includes('dwarka')) {
    return {
      region: 'Gujarat Coast',
      layerKeywords: ['gujarat coast', 'gujarat'],
      seaAreaKeywords: ['north east arabian sea', 'gulf of kutch', 'gulf of khambhat'],
      portName: combinedText.includes('veraval') ? 'Veraval' : 'Okha',
      state: 'Gujarat'
    };
  }

  // 8. ODISHA
  if (cleanState.includes('odisha') || combinedText.includes('puri')) {
    return {
      region: 'Odisha Coast',
      layerKeywords: ['odisha coast', 'orissa coast', 'odisha'],
      seaAreaKeywords: ['north bay of bengal', 'west central bay of bengal'],
      portName: 'Paradeep',
      state: 'Odisha'
    };
  }

  // 9. ANDHRA PRADESH
  if (cleanState.includes('andhra') || combinedText.includes('visakhapatnam')) {
    return {
      region: 'Andhra Pradesh Coast',
      layerKeywords: ['andhra pradesh coast', 'andhra coast'],
      seaAreaKeywords: ['west central bay of bengal', 'bay of bengal'],
      portName: 'Visakhapatnam',
      state: 'Andhra Pradesh'
    };
  }

  // 10. WEST BENGAL
  if (cleanState.includes('west bengal') || combinedText.includes('digha')) {
    return {
      region: 'West Bengal Coast',
      layerKeywords: ['west bengal coast', 'bengal coast'],
      seaAreaKeywords: ['north bay of bengal', 'head bay of bengal'],
      portName: 'Haldia',
      state: 'West Bengal'
    };
  }

  // Fallback for unmapped locations
  return {
    region: state ? `${state} Coastal Area` : 'Coastal Area',
    layerKeywords: state ? [state.toLowerCase()] : [],
    seaAreaKeywords: [],
    portName: null,
    state: state || 'India'
  };
}

module.exports = {
  resolveImdCoverage
};
