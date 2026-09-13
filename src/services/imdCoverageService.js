/**
 * Centralized IMD Coverage Region Mapping Service
 * Maps registered location (State, District, Municipality, Coastal Area)
 * to authoritative IMD Coastal Layers, Port Identifiers, and Coordinates.
 */

const NORTH_KERALA_DISTRICTS = ['malappuram', 'kasargod', 'kasaragod', 'kannur', 'kozhikode', 'thrissur'];
const SOUTH_KERALA_DISTRICTS = ['ernakulam', 'alappuzha', 'kollam', 'thiruvananthapuram'];

const KERALA_PORT_MAPPINGS = [
  { keywords: ['ponnani'], portName: 'Ponnani', coordinates: [75.925, 10.782] },
  { keywords: ['beypore'], portName: 'Beypore', coordinates: [75.805, 11.162] },
  { keywords: ['vizhinjam', 'kovalam'], portName: 'Vizhinjam', coordinates: [76.993, 8.375] },
  { keywords: ['neendakara', 'sakthikulangara'], portName: 'Neendakara', coordinates: [76.536, 8.937] },
  { keywords: ['kochi', 'cochin', 'fort kochi', 'vypin', 'munambam'], portName: 'Cochin', coordinates: [76.242, 9.965] },
  { keywords: ['alappuzha', 'alleppey', 'thottappally'], portName: 'Alleppey', coordinates: [76.326, 9.498] },
  { keywords: ['thangassery', 'kollam beach'], portName: 'Thangassery', coordinates: [76.581, 8.887] },
  { keywords: ['azheekal'], portName: 'Azheekal', coordinates: [75.370, 11.874] },
  { keywords: ['vatakara', 'chombala'], portName: 'Vatakara', coordinates: [75.590, 11.603] },
  { keywords: ['koyilandy'], portName: 'Koyilandy', coordinates: [75.696, 11.439] }
];

/**
 * Resolve IMD Coverage Region, Port Mapping & Coastal Coordinates
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
    let coords = null;
    for (const item of KERALA_PORT_MAPPINGS) {
      if (item.keywords.some(kw => combinedText.includes(kw))) {
        portName = item.portName;
        coords = item.coordinates;
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
        coordinates: coords || (cleanDistrict.includes('malappuram') ? [75.925, 10.782] : [75.805, 11.162]),
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
        coordinates: coords || (cleanDistrict.includes('ernakulam') ? [76.242, 9.965] : [76.993, 8.375]),
        state: 'Kerala'
      };
    }

    // Fallback for general Kerala
    return {
      region: 'Kerala Coast',
      layerKeywords: ['kerala coast', 'kerala'],
      seaAreaKeywords: ['south east arabian sea', 'kerala coast', 'arabian sea'],
      portName: portName,
      coordinates: coords || [76.242, 9.965],
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
      coordinates: [72.641, 10.566],
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
      coordinates: [74.880, 12.870],
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
      coordinates: combinedText.includes('chennai') ? [80.270, 13.082] : [78.134, 8.764],
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
      coordinates: [73.805, 15.418],
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
      coordinates: [72.834, 18.922],
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
      coordinates: [70.360, 20.900],
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
      coordinates: [86.611, 20.316],
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
      coordinates: [83.218, 17.686],
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
      coordinates: [88.069, 22.066],
      state: 'West Bengal'
    };
  }

  // Fallback for unmapped locations
  return {
    region: state ? `${state} Coastal Area` : 'Coastal Area',
    layerKeywords: state ? [state.toLowerCase()] : [],
    seaAreaKeywords: [],
    portName: null,
    coordinates: [76.242, 9.965],
    state: state || 'India'
  };
}

module.exports = {
  resolveImdCoverage
};
