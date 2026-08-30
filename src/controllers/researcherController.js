const db = require('../config/db');
const path = require('path');
const fs = require('fs');

// =========================================================================
// 1. Existing Biodiversity Reports (DO NOT REMOVE)
// =========================================================================

// Create Biodiversity Report (Researcher only)
exports.createBiodiversityReport = async (req, res) => {
  const { species_name, observation, latitude, longitude, observed_date } = req.body;
  const researcher_id = req.user.user_id;

  if (!species_name) {
    return res.status(400).json({ error: 'Species name is required.' });
  }

  let imageUrl = null;
  if (req.file) {
    imageUrl = `/uploads/${req.file.filename}`;
  }

  try {
    const insertQuery = `
      INSERT INTO biodiversity_reports 
      (researcher_id, species_name, observation, latitude, longitude, image, observed_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      species_name,
      observation || null,
      latitude ? parseFloat(latitude) : null,
      longitude ? parseFloat(longitude) : null,
      imageUrl,
      observed_date || new Date()
    ];

    const result = await db.query(insertQuery, values);
    res.status(201).json({ report: result.rows[0] });
  } catch (error) {
    console.error('Create Biodiversity Error:', error);
    res.status(500).json({ error: 'Server error creating biodiversity log.' });
  }
};

// Get Biodiversity Reports
exports.getBiodiversityReports = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT b.*, u.full_name as researcher_name 
      FROM biodiversity_reports b
      JOIN users u ON b.researcher_id = u.user_id
      ORDER BY b.observed_date DESC
    `);
    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Get Biodiversity Reports Error:', error);
    res.status(500).json({ error: 'Server error retrieving biodiversity logs.' });
  }
};

// =========================================================================
// 2. Research Projects
// =========================================================================

exports.createProject = async (req, res) => {
  const { title, description, study_area, objectives, start_date, end_date } = req.body;
  const researcher_id = req.user.user_id;

  if (!title) {
    return res.status(400).json({ error: 'Project title is required.' });
  }

  try {
    const query = `
      INSERT INTO research_projects 
      (researcher_id, title, description, study_area, objectives, start_date, end_date) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      title,
      description || null,
      study_area || null,
      objectives || null,
      start_date || null,
      end_date || null
    ];
    const result = await db.query(query, values);
    res.status(201).json({ project: result.rows[0] });
  } catch (error) {
    console.error('Create Project Error:', error);
    res.status(500).json({ error: 'Server error creating research project.' });
  }
};

exports.getProjects = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.*, u.full_name as researcher_name 
      FROM research_projects p
      JOIN users u ON p.researcher_id = u.user_id
      ORDER BY p.created_at DESC
    `);
    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Get Projects Error:', error);
    res.status(500).json({ error: 'Server error retrieving research projects.' });
  }
};

exports.deleteProject = async (req, res) => {
  const { id } = req.params;
  const researcher_id = req.user.user_id;

  try {
    const check = await db.query('SELECT * FROM research_projects WHERE project_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (check.rows[0].researcher_id !== researcher_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this project.' });
    }

    await db.query('DELETE FROM research_projects WHERE project_id = $1', [id]);
    res.json({ message: 'Research project deleted successfully.' });
  } catch (error) {
    console.error('Delete Project Error:', error);
    res.status(500).json({ error: 'Server error deleting research project.' });
  }
};

// =========================================================================
// 3. Research Datasets
// =========================================================================

exports.uploadDataset = async (req, res) => {
  const { name, description, project_id, location, data_type, record_count } = req.body;
  const researcher_id = req.user.user_id;

  if (!req.file) {
    return res.status(400).json({ error: 'Dataset file is required.' });
  }

  if (!name) {
    return res.status(400).json({ error: 'Dataset name is required.' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  const fileName = req.file.originalname;
  const fileSize = req.file.size;

  try {
    const query = `
      INSERT INTO research_datasets 
      (researcher_id, project_id, name, description, file_url, file_name, file_size, data_type, record_count, location) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      project_id || null,
      name,
      description || null,
      fileUrl,
      fileName,
      fileSize,
      data_type || 'CSV',
      record_count ? parseInt(record_count) : 0,
      location || null
    ];
    const result = await db.query(query, values);
    res.status(201).json({ dataset: result.rows[0] });
  } catch (error) {
    console.error('Upload Dataset Error:', error);
    res.status(500).json({ error: 'Server error uploading research dataset.' });
  }
};

exports.getDatasets = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT d.*, u.full_name as researcher_name, p.title as project_title 
      FROM research_datasets d
      JOIN users u ON d.researcher_id = u.user_id
      LEFT JOIN research_projects p ON d.project_id = p.project_id
      ORDER BY d.uploaded_at DESC
    `);
    res.json({ datasets: result.rows });
  } catch (error) {
    console.error('Get Datasets Error:', error);
    res.status(500).json({ error: 'Server error retrieving datasets.' });
  }
};

exports.deleteDataset = async (req, res) => {
  const { id } = req.params;
  const researcher_id = req.user.user_id;

  try {
    const check = await db.query('SELECT * FROM research_datasets WHERE dataset_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    if (check.rows[0].researcher_id !== researcher_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this dataset.' });
    }

    // Try deleting physical file
    const filePath = path.join(__dirname, '../../', check.rows[0].file_url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.query('DELETE FROM research_datasets WHERE dataset_id = $1', [id]);
    res.json({ message: 'Dataset deleted successfully.' });
  } catch (error) {
    console.error('Delete Dataset Error:', error);
    res.status(500).json({ error: 'Server error deleting dataset.' });
  }
};

// =========================================================================
// 4. Research Alerts
// =========================================================================

exports.createAlert = async (req, res) => {
  const { alert_type, parameter_name, threshold_value, comparison_operator, location, severity } = req.body;
  const researcher_id = req.user.user_id;

  if (!alert_type) {
    return res.status(400).json({ error: 'Alert type is required.' });
  }

  try {
    const query = `
      INSERT INTO research_alerts 
      (researcher_id, alert_type, parameter_name, threshold_value, comparison_operator, location, severity) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      alert_type,
      parameter_name || null,
      threshold_value ? parseFloat(threshold_value) : null,
      comparison_operator || null,
      location || null,
      severity || 'Medium'
    ];
    const result = await db.query(query, values);
    res.status(201).json({ alert: result.rows[0] });
  } catch (error) {
    console.error('Create Alert Error:', error);
    res.status(500).json({ error: 'Server error creating research alert.' });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.*, u.full_name as researcher_name 
      FROM research_alerts a
      JOIN users u ON a.researcher_id = u.user_id
      ORDER BY a.created_at DESC
    `);
    res.json({ alerts: result.rows });
  } catch (error) {
    console.error('Get Alerts Error:', error);
    res.status(500).json({ error: 'Server error retrieving alerts.' });
  }
};

exports.deleteAlert = async (req, res) => {
  const { id } = req.params;
  const researcher_id = req.user.user_id;

  try {
    const check = await db.query('SELECT * FROM research_alerts WHERE alert_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    if (check.rows[0].researcher_id !== researcher_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this alert.' });
    }

    await db.query('DELETE FROM research_alerts WHERE alert_id = $1', [id]);
    res.json({ message: 'Alert rule deleted successfully.' });
  } catch (error) {
    console.error('Delete Alert Error:', error);
    res.status(500).json({ error: 'Server error deleting alert.' });
  }
};

exports.toggleAlert = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  const researcher_id = req.user.user_id;

  try {
    const check = await db.query('SELECT * FROM research_alerts WHERE alert_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    if (check.rows[0].researcher_id !== researcher_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to modify this alert.' });
    }

    const result = await db.query(
      'UPDATE research_alerts SET is_active = $1 WHERE alert_id = $2 RETURNING *',
      [is_active, id]
    );
    res.json({ alert: result.rows[0] });
  } catch (error) {
    console.error('Toggle Alert Error:', error);
    res.status(500).json({ error: 'Server error toggling alert.' });
  }
};

// =========================================================================
// 5. Research Reports
// =========================================================================

exports.createReport = async (req, res) => {
  const { title, study_area, start_date, end_date, parameters, findings } = req.body;
  const researcher_id = req.user.user_id;

  if (!title) {
    return res.status(400).json({ error: 'Report title is required.' });
  }

  try {
    const query = `
      INSERT INTO research_reports 
      (researcher_id, title, study_area, start_date, end_date, parameters, findings) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `;
    const values = [
      researcher_id,
      title,
      study_area || null,
      start_date || null,
      end_date || null,
      parameters ? JSON.stringify(parameters) : null,
      findings || null
    ];
    const result = await db.query(query, values);
    res.status(201).json({ report: result.rows[0] });
  } catch (error) {
    console.error('Create Report Error:', error);
    res.status(500).json({ error: 'Server error creating report record.' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT r.*, u.full_name as researcher_name 
      FROM research_reports r
      JOIN users u ON r.researcher_id = u.user_id
      ORDER BY r.created_at DESC
    `);
    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Get Reports Error:', error);
    res.status(500).json({ error: 'Server error retrieving reports.' });
  }
};

exports.deleteReport = async (req, res) => {
  const { id } = req.params;
  const researcher_id = req.user.user_id;

  try {
    const check = await db.query('SELECT * FROM research_reports WHERE report_id = $1', [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    if (check.rows[0].researcher_id !== researcher_id && req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this report.' });
    }

    await db.query('DELETE FROM research_reports WHERE report_id = $1', [id]);
    res.json({ message: 'Research report deleted successfully.' });
  } catch (error) {
    console.error('Delete Report Error:', error);
    res.status(500).json({ error: 'Server error deleting report.' });
  }
};

// =========================================================================
// 6. AI Assistant Chat
// =========================================================================

exports.chatAssistant = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required.' });
  }

  const queryText = message.toLowerCase();

  try {
    // Gather current platform statistics for real data integration
    const repCount = await db.query('SELECT COUNT(*) FROM pollution_reports');
    const bioCount = await db.query('SELECT COUNT(*) FROM biodiversity_reports');
    const sensorCount = await db.query('SELECT COUNT(*) FROM sensor_readings');
    const deviceCount = await db.query('SELECT COUNT(*) FROM iot_devices');
    const campCount = await db.query('SELECT COUNT(*) FROM cleanup_campaigns');

    const totalReports = parseInt(repCount.rows[0].count);
    const totalBio = parseInt(bioCount.rows[0].count);
    const totalSensors = parseInt(sensorCount.rows[0].count);
    const totalDevices = parseInt(deviceCount.rows[0].count);
    const totalCampaigns = parseInt(campCount.rows[0].count);

    let reply = '';

    // Advanced Local Intelligence Rule Engine (Precludes hallucinating data)
    if (queryText.includes('species') || queryText.includes('biodiversity') || queryText.includes('dolphin') || queryText.includes('turtle')) {
      const bioList = await db.query(`
        SELECT species_name, observation, latitude, longitude, observed_date 
        FROM biodiversity_reports 
        LIMIT 5
      `);
      
      let speciesText = '';
      if (bioList.rows.length > 0) {
        speciesText = bioList.rows.map(r => `* **${r.species_name}**: Observed near coordinates (${r.latitude}, ${r.longitude}) on ${new Date(r.observed_date).toLocaleDateString()}. Detail: "${r.observation}"`).join('\n');
      } else {
        speciesText = 'No biodiversity observations recorded in this sector yet.';
      }

      reply = `### TerraMarine Platform Species Analysis
Based on current database records, we have logged **${totalBio} biodiversity observation(s)**.

Here are the latest recordings from our field researchers:
${speciesText}

*General Ecological Context:* The coastal waters of Kerala are highly diverse, housing species such as Humpback Dolphins (*Sousa plumbea*), Green Turtles (*Chelonia mydas*), and a variety of pelagic fishes. Biodiversity indices fluctuate based on plastic trash densities and water acidity.`;

    } else if (queryText.includes('pollution') || queryText.includes('trash') || queryText.includes('plastic') || queryText.includes('oil')) {
      const polList = await db.query(`
        SELECT title, waste_type, severity, location_name, status 
        FROM pollution_reports 
        ORDER BY reported_at DESC 
        LIMIT 5
      `);
      
      let polText = '';
      if (polList.rows.length > 0) {
        polText = polList.rows.map(r => `* **${r.title}** (${r.waste_type}): Severity **${r.severity}** at *${r.location_name || 'Coastal Line'}*. Status: [${r.status}]`).join('\n');
      } else {
        polText = 'No pollution incidents registered.';
      }

      reply = `### TerraMarine Pollution Density Assessment
The platform database currently lists **${totalReports} pollution reports**. 

Recent incidents logged by citizens and researchers:
${polText}

*Analysis:* Plastic and general litter make up the majority of coastal trash deposits. High severity incidents (such as oil spills near harbors) trigger warning parameters. Platform statistics show that community cleanups solve approximately ${totalCampaigns > 0 ? Math.round((totalCampaigns / (totalReports || 1)) * 100) : 30}% of local beach trash collections.`;

    } else if (queryText.includes('water') || queryText.includes('ph') || queryText.includes('turbidity') || queryText.includes('sensor') || queryText.includes('iot')) {
      const sensorList = await db.query(`
        SELECT s.ph, s.turbidity, s.temperature, s.recorded_at, d.device_name, d.location_name
        FROM sensor_readings s
        JOIN iot_devices d ON s.device_id = d.device_id
        ORDER BY s.recorded_at DESC
        LIMIT 3
      `);

      let sensorText = '';
      if (sensorList.rows.length > 0) {
        sensorText = sensorList.rows.map(r => `* **${r.device_name}** (*${r.location_name}*): pH = **${r.ph || 'N/A'}**, Turbidity = **${r.turbidity || 'N/A'} NTU**, Temp = **${r.temperature || 'N/A'}°C** (Recorded at ${new Date(r.recorded_at).toLocaleTimeString()})`).join('\n');
      } else {
        sensorText = 'No active telemetry nodes transmitting water metrics.';
      }

      reply = `### IoT Coastal Water Quality Telemetry
We have **${totalDevices} active IoT device(s)** currently transmitting environmental metrics.

Latest sensor readings from our nodes:
${sensorText}

*Scientific Parameters:* 
* **pH**: Standard healthy marine pH ranges from 7.5 to 8.4. Readout shifts below 7.0 signal acidic runoff.
* **Turbidity**: Readings below 10 NTU indicate high water clarity. Turbidity > 25 NTU indicates high suspended solids, which blocks sunlight from reefs.`;

    } else {
      reply = `### Welcome to TerraMarine Research Assistant
I can answer research inquiries using live database information from the TerraMarine platform.

**Quick Stats Overview:**
* **Pollution Incidents Logged:** ${totalReports}
* **Marine Biodiversity Observations:** ${totalBio}
* **Active IoT Monitoring Nodes:** ${totalDevices}
* **Environmental Campaigns Executed:** ${totalCampaigns}

**Example queries you can ask me:**
1. *"What species have been observed near this location?"*
2. *"Show pollution trends for the last six months."*
3. *"Which biodiversity hotspots have high pollution?"*
4. *"Compare water quality between these two locations."*`;
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat Assistant Error:', error);
    res.status(500).json({ error: 'Server error querying research assistant.' });
  }
};

// =========================================================================
// 7. AI Species Identification Simulator
// =========================================================================

exports.identifySpecies = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded for species identification.' });
  }

  // Define a dictionary of simulation predictions based on random select
  const speciesChoices = [
    {
      possibleSpecies: "Green Sea Turtle",
      confidence: 94,
      scientificName: "Chelonia mydas",
      classification: "Reptiles",
      habitat: "Tropical and subtropical coastal waters, reefs, and seagrass meadows",
      diet: "Herbivorous (mostly seagrasses and algae)",
      conservationStatus: "Endangered",
      pollutionSensitivity: "High (sensitive to plastics, chemical spills, and beach development)",
      alternatives: [
        { name: "Loggerhead Sea Turtle", confidence: 4 },
        { name: "Hawksbill Sea Turtle", confidence: 2 }
      ]
    },
    {
      possibleSpecies: "Indian Humpback Dolphin",
      confidence: 89,
      scientificName: "Sousa plumbea",
      classification: "Marine Mammals",
      habitat: "Shallow, coastal waters near river mouths and estuaries",
      diet: "Piscivorous (small fish, cephalopods)",
      conservationStatus: "Endangered",
      pollutionSensitivity: "High (sensitive to heavy metals, sewage discharge, noise, and nets)",
      alternatives: [
        { name: "Indo-Pacific Bottlenose Dolphin", confidence: 8 },
        { name: "Finless Porpoise", confidence: 3 }
      ]
    },
    {
      possibleSpecies: "Indian Mackerel",
      confidence: 92,
      scientificName: "Rastrelliger kanagurta",
      classification: "Fish",
      habitat: "Coastal waters, reefs, and shallow bays",
      diet: "Planktonic feeder (phytoplankton and zooplankton)",
      conservationStatus: "Least Concern",
      pollutionSensitivity: "Medium (sensitive to toxic runoff and microplastic ingestion)",
      alternatives: [
        { name: "Chub Mackerel", confidence: 6 },
        { name: "Sardine", confidence: 2 }
      ]
    }
  ];

  // Pick a simulated class
  const randomIndex = Math.floor(Math.random() * speciesChoices.length);
  const prediction = speciesChoices[randomIndex];

  res.json({ prediction });
};
