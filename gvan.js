let S = { lat:28.6139, lon:77.2090, soil:"Clay-Loam", rainfall:"900mm", climate:"Tropical Wet & Dry", sunlight:"High", ecoIndex:68 };
  let leafMap, leafMarker, radarChart, costChart, projChart;
  let polyPoints = [], polyClosed = false, drawModeActive = true;
  function toast(m) { let t=document.getElementById("toast"); t.innerText=m; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2500); }
  
  // ========== pH SCORING FUNCTION ==========
  function getPHScore(pH) {
    if(pH < 4) return 0;
    if(pH >= 4 && pH < 5.5) return 0.2 + (pH - 4) * (0.8 / 1.5);
    if(pH >= 5.5 && pH <= 7.5) return 1;
    if(pH > 7.5 && pH <= 9) return 1 - (pH - 7.5) * (1 / 1.5);
    return 0;
  }
  
  function getPHAdvice(pH) {
    if(pH < 5.5) return `⚠️ Soil too acidic (${pH}). Add wood ash (2-3 kg per 10 sq m) or agricultural lime. Contact KVK for exact dose.`;
    if(pH > 7.5) return `⚠️ Soil too alkaline (${pH}). Add organic compost (5-10 kg per sq m) or sulphur (1-2 kg per 10 sq m).`;
    return "✅ Soil pH is optimal for most trees.";
  }
  
  function getPHAmendment(pH, areaSqm) {
    if(pH >= 5.5 && pH <= 7.5) return { cost: 0, desc: "None needed", kg: 0 };
    let kgPerSqm = pH < 5.5 ? 0.25 : 0.20;
    let totalKg = areaSqm * kgPerSqm;
    let costPerKg = pH < 5.5 ? 8 : 15;
    let cost = totalKg * costPerKg;
    let desc = pH < 5.5 ? `Lime: ${totalKg.toFixed(1)} kg` : `Sulphur: ${totalKg.toFixed(1)} kg`;
    return { cost, desc, kg: totalKg };
  }
  
  // ========== NEW SUCCESS RATE CALCULATION ==========
  function computeSuccessRate() {
    let mm = parseInt(S.rainfall) || 900;
    let climateScore = S.climate.includes("Tropical") ? 0.9 : (S.climate.includes("Subtropical") ? 0.78 : 0.65);
    let rainfallScore = Math.min(1, mm/2000);
    let soilScore = (S.soil.includes("Clay")||S.soil.includes("Alluvial")) ? 0.85 : (S.soil.includes("Sandy") ? 0.6 : 0.7);
    let waterScore = parseFloat(document.getElementById("waterAvail").value) || 0.75;
    let elevationScore = (parseFloat(document.getElementById("elevation").value) || 320) < 800 ? 1 : 0.7;
    let phScore = getPHScore(parseFloat(document.getElementById("soilPH").value) || 6.5);
    let siteSuitability = (climateScore*0.25 + rainfallScore*0.2 + soilScore*0.2 + waterScore*0.2 + elevationScore*0.1 + phScore*0.05);
    
    let goal = document.getElementById("goal").value;
    let goalScore = 1.0;
    if(goal === "fruit") goalScore = (waterScore * 0.6 + (phScore > 0.7 ? 1 : 0.5) * 0.4);
    else if(goal === "timber") goalScore = (soilScore * 0.5 + rainfallScore * 0.5);
    else if(goal === "carbon") goalScore = (waterScore * 0.5 + rainfallScore * 0.5);
    else if(goal === "restoration") goalScore = (soilScore * 0.3 + waterScore * 0.3 + rainfallScore * 0.4);
    else goalScore = (soilScore * 0.4 + waterScore * 0.3 + rainfallScore * 0.3);
    goalScore = Math.min(1, Math.max(0, goalScore));
    
    let maintLevel = document.getElementById("maintenance").value;
    let maintScore = maintLevel === "high" ? 1.0 : (maintLevel === "medium" ? 0.7 : 0.4);
    
    let budget = parseFloat(document.getElementById("budget").value) || 500000;
    let fiveYrCost = window._fiveYrCost || 1;
    let budgetScore = Math.min(1, budget / (fiveYrCost || 1));
    
    let spacing = parseFloat(document.getElementById("spacing").value) || 3;
    let spacingScore = 1.0;
    if(goal === "timber" && spacing < 4) spacingScore = 0.6;
    if(goal === "fruit" && spacing > 4) spacingScore = 0.7;
    if(goal === "carbon" && spacing > 4) spacingScore = 0.8;
    if(goal === "mixed" && (spacing < 2.5 || spacing > 5)) spacingScore = 0.7;
    
    let successRate = (siteSuitability * 0.50) + (goalScore * 0.15) + (maintScore * 0.10) + (budgetScore * 0.15) + (spacingScore * 0.10);
    return Math.min(1, Math.max(0, successRate));
  }
  
  function showDropdown(anchorElement, options, onSelect) {
    let existing = document.querySelector('.custom-dropdown');
    if(existing) existing.remove();
    let rect = anchorElement.getBoundingClientRect();
    let div = document.createElement('div');
    div.className = 'custom-dropdown';
    div.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    div.style.left = (rect.left + window.scrollX) + 'px';
    div.style.minWidth = Math.max(120, rect.width) + 'px';
    options.forEach(opt => {
      let item = document.createElement('div');
      item.textContent = opt;
      item.onclick = (e) => { e.stopPropagation(); onSelect(opt); div.remove(); };
      div.appendChild(item);
    });
    document.body.appendChild(div);
    let closeHandler = (e) => { if (!div.contains(e.target)) { div.remove(); document.removeEventListener('click', closeHandler); } };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function setupEditableFields() {
    const soilOpts = ['Clay-Loam', 'Sandy Loam', 'Alluvial', 'Silty Clay', 'Black Cotton', 'Red Laterite'];
    const rainOpts = ['400mm', '600mm', '900mm', '1200mm', '1600mm', '2200mm'];
    const climateOpts = ['Tropical Rainforest', 'Tropical Wet & Dry', 'Subtropical / Semi-arid', 'Temperate Oceanic', 'Continental Boreal'];
    
    document.getElementById('soilEdit')?.addEventListener('click', (e) => { e.stopPropagation(); showDropdown(e.target, soilOpts, (val) => { S.soil = val; updateAllUI(); toast(`Soil updated to ${val}`); }); });
    document.getElementById('rainEdit')?.addEventListener('click', (e) => { e.stopPropagation(); showDropdown(e.target, rainOpts, (val) => { S.rainfall = val; updateAllUI(); toast(`Rainfall updated to ${val}`); }); });
    document.getElementById('climateEdit')?.addEventListener('click', (e) => { e.stopPropagation(); showDropdown(e.target, climateOpts, (val) => { S.climate = val; updateAllUI(); toast(`Climate updated to ${val}`); }); });
  }
  
  // ========== GLOBAL LOCATION FUNCTIONS (Bridged to Miyawaki Engine) ==========
  async function searchLocation() {
    let query = document.getElementById("locationInput").value.trim();
    if(!query) { toast("Enter a location name"); return; }
    try {
      let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      let data = await res.json();
      if(data.length===0) { toast("Location not found"); return; }
      let lat = parseFloat(data[0].lat);
      let lon = parseFloat(data[0].lon);
      updateFromLocation(lat, lon);
      
      if(leafMap) leafMap.setView([lat, lon], 14);
      if(leafMarker) leafMarker.setLatLng([lat, lon]).bindPopup(`📍 ${data[0].display_name.substring(0,50)}`).openPopup();
      document.getElementById("locDot").style.background = "#4caf50";
      document.getElementById("locStatus").innerHTML = `📍 ${data[0].display_name.substring(0,40)}`;

      // Bridge: Update Miyawaki Form coordinates
      if(document.getElementById('mw-lat')) document.getElementById('mw-lat').value = lat.toFixed(4);
      if(document.getElementById('mw-lon')) document.getElementById('mw-lon').value = lon.toFixed(4);
      
      // Bridge: Auto-calculate Miyawaki if already active
      if (typeof window.analyzeSite === "function" && document.getElementById('mw-results') && document.getElementById('mw-results').style.display === 'block') {
         window.analyzeSite();
      }

      toast(`Location set to ${data[0].display_name.substring(0,40)}`);
    } catch(e) { toast("Search failed"); }
  }

  function detectLocation() {
    if(!navigator.geolocation) { toast("Geolocation not supported"); return; }
    let btn = document.getElementById("detectBtn"); 
    if(btn) { btn.innerText = "⏳ detecting..."; btn.disabled = true; }
    
    navigator.geolocation.getCurrentPosition(
      async (pos)=> { 
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;
        updateFromLocation(lat, lon);
        if(leafMap) leafMap.setView([lat, lon], 16);

        // Bridge: Update Miyawaki Form coordinates
        if(document.getElementById('mw-lat')) document.getElementById('mw-lat').value = lat.toFixed(4);
        if(document.getElementById('mw-lon')) document.getElementById('mw-lon').value = lon.toFixed(4);

        // Bridge: Auto-calculate Miyawaki if already active
        if (typeof window.analyzeSite === "function" && document.getElementById('mw-results') && document.getElementById('mw-results').style.display === 'block') {
           window.analyzeSite();
        }

        let locationName = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        try {
          let res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18`);
          let data = await res.json();
          if(data.display_name) locationName = data.display_name.substring(0,60);
        } catch(e) {}
        if(leafMarker) leafMarker.setLatLng([lat, lon]).bindPopup(`📍 ${locationName} (accuracy ${pos.coords.accuracy}m)`).openPopup();
        document.getElementById("locDot").style.background = "#4caf50";
        document.getElementById("locStatus").innerHTML = `📍 ${locationName}`;
        toast(`Exact location detected!`);
        if(btn) { btn.innerText = "✅ Located"; btn.disabled = false; }
      },
      (err)=> { 
        toast("Location error: "+err.message); 
        if(btn) { btn.innerText = "📍 Detect"; btn.disabled = false; } 
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  
  function deriveRainfall(lat) { let a=Math.abs(lat); if(a<10) return "2400mm"; if(a<15) return "1800mm"; if(a<23) return "1200mm"; if(a<30) return "900mm"; if(a<40) return "700mm"; return "500mm"; }
  function deriveClimate(lat) { let a=Math.abs(lat); if(a<10) return "Tropical Rainforest"; if(a<23) return "Tropical Wet & Dry"; if(a<35) return "Subtropical / Semi-arid"; return "Temperate Oceanic"; }
  function updateFromLocation(lat,lon) { S.lat=lat; S.lon=lon; S.rainfall=deriveRainfall(lat); S.climate=deriveClimate(lat); S.sunlight=Math.abs(lat)<25?"High Sunlight":"Moderate"; S.soil=["Clay-Loam","Sandy Loam","Alluvial","Silty Clay"][Math.floor(Math.random()*4)]; updateAllUI(); }
  
  // ========== MIYAWAKI AGRO-ZONE CALCULATOR ==========
  function getAgroZone(lat, lon) {
    if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) return "north_central_arid_plains"; 
    if (lon > 87.0 || (lat > 22.0 && lon > 84.0)) return "east_northeast_subtropical";
    if (lat < 20.0) {
      if (lon < 77.5) return "western_ghats_coastal";
      else return "south_deccan_plateau";
    } else {
      return "north_central_arid_plains";
    }
  } 

  // ========== MIYAWAKI ANALYZER & UI UPDATERS ==========
  let plantData = null;
  let soilData = null;
  let currentZoneId = null;

  async function analyzeSite() {
    const lat = parseFloat(document.getElementById('mw-lat').value);
    const lon = parseFloat(document.getElementById('mw-lon').value);
    
    document.getElementById('mw-loading').style.display = 'block';
    document.getElementById('mw-results').style.display = 'none';

    try {
      if (!plantData || !soilData) {
        const [pRes, sRes] = await Promise.all([
          fetch('plant data.json'),
          fetch('soil quaility and enhancers.json')
        ]);
        
        if (!pRes.ok || !sRes.ok) throw new Error("Ensure JSON files are on a local server.");
        
        plantData = await pRes.json();
        soilData = await sRes.json();
      }

      currentZoneId = getAgroZone(lat, lon);
      populateMiyawakiUI();
      
    } catch (error) {
      alert("Error loading data: " + error.message);
      document.getElementById('mw-loading').style.display = 'none';
    }
  }

  function populateMiyawakiUI() {
    document.getElementById('mw-loading').style.display = 'none';
    document.getElementById('mw-results').style.display = 'block';

    const plantRegion = plantData.regions[currentZoneId];
    const soilRegion = soilData.agro_zones[currentZoneId];

    document.getElementById('mw-zone-name').innerText = plantRegion.display_name;

    let plantsHtml = '';
    const layers = ['canopy', 'tree', 'sub_tree', 'shrub'];
    layers.forEach(layer => {
      plantsHtml += `<div style="margin-bottom:8px;"><strong>${layer.toUpperCase()} (25%):</strong><br>`;
      plantRegion.layers[layer].forEach(p => {
        plantsHtml += `• ${p.common_name} <em style="color:#6b7a5e;">(${p.botanical_name})</em><br>`;
      });
      plantsHtml += `</div>`;
    });
    document.getElementById('mw-plants-list').innerHTML = plantsHtml;

    const soilSelect = document.getElementById('mw-soil-select');
    soilSelect.innerHTML = '';
    soilRegion.dominant_soils.forEach((soil, index) => {
      let opt = document.createElement('option');
      opt.value = index; 
      opt.innerHTML = soil.soil_name + " - " + soil.characteristics;
      soilSelect.appendChild(opt);
    });

    calculateEnhancersAndBudget();
  }

  function calculateEnhancersAndBudget() {
    const area = parseFloat(document.getElementById('mw-area').value) || 100;
    const ph = parseFloat(document.getElementById('mw-ph').value) || 6.5;
    const soilIndex = document.getElementById('mw-soil-select').value;
    const soilRegion = soilData.agro_zones[currentZoneId];
    const selectedSoil = soilRegion.dominant_soils[soilIndex];
    const formula = selectedSoil.enhancer_formula_kg_per_sqm;

    const rates = { sapling: 45, excavation: 80, coco: 20, husk: 10, compost: 15, mulch: 15 };

    const saplings = Math.round(area * 3.5);
    const cocoKg = area * formula.water_retainer_cocopeat;
    const huskKg = area * formula.perforator_rice_husk;
    const compostKg = area * formula.organic_compost;

    let costSaplings = saplings * rates.sapling;
    let costExcavation = area * rates.excavation;
    let costCoco = cocoKg * rates.coco;
    let costHusk = huskKg * rates.husk;
    let costCompost = compostKg * rates.compost;
    let costMulch = area * rates.mulch;

    let phAmendmentName = "";
    let costPh = 0;
    let phAdviceHtml = "";

    if (ph < 5.5) {
      const limeKg = area * 0.25; 
      costPh = limeKg * 8; 
      phAmendmentName = `Dolomitic Lime (${limeKg.toFixed(1)}kg)`;
      phAdviceHtml = `<div style="background:#fde8e8; color:#c0392b; padding:8px; border-radius:6px; margin-bottom:8px;">⚠️ <strong>Acidic Soil (pH ${ph}):</strong> Added lime budget to prevent mineral toxicity.</div>`;
    } else if (ph > 7.5) {
      const sulphurKg = area * 0.20; 
      costPh = sulphurKg * 15; 
      phAmendmentName = `Agri-Sulphur (${sulphurKg.toFixed(1)}kg)`;
      phAdviceHtml = `<div style="background:#fff3e0; color:#c97a2f; padding:8px; border-radius:6px; margin-bottom:8px;">⚠️ <strong>Alkaline Soil (pH ${ph}):</strong> Added sulphur budget to prevent nutrient locking.</div>`;
    } else {
      phAdviceHtml = `<div style="background:#e6f5e8; color:#2d7a3a; padding:8px; border-radius:6px; margin-bottom:8px;">✅ <strong>Optimal pH (${ph}):</strong> No special pH amendments required.</div>`;
    }
    
    const totalCost = costSaplings + costExcavation + costCoco + costHusk + costCompost + costMulch + costPh;

    let budgetHtml = `
      ${phAdviceHtml}
      <table style="width:100%; border-collapse: collapse; margin-bottom: 10px;">
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>Saplings (x${saplings})</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costSaplings.toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>1m Trench Excavation</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costExcavation.toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>Cocopeat (${cocoKg.toFixed(1)}kg)</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costCoco.toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>Rice Husk (${huskKg.toFixed(1)}kg)</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costHusk.toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>Compost (${compostKg.toFixed(1)}kg)</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costCompost.toLocaleString()}</td></tr>
        <tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0;"><strong>Surface Mulch</strong></td><td style="text-align:right; font-family:'DM Mono', monospace;">₹${costMulch.toLocaleString()}</td></tr>
    `;
    
    if (costPh > 0) {
      budgetHtml += `<tr style="border-bottom: 1px solid #ddd;"><td style="padding:4px 0; color:#c0392b;"><strong>pH Correction:<br><span style="font-size:0.75rem;font-weight:normal;">${phAmendmentName}</span></strong></td><td style="text-align:right; color:#c0392b; font-family:'DM Mono', monospace;">₹${costPh.toLocaleString()}</td></tr>`;
    }
    
    budgetHtml += `</table>
      <div style="background:#f9f9f9; padding:8px; border-radius:6px; font-size:0.75rem; border: 1px solid #eee;">
        <strong>Other Required Additives:</strong> ${selectedSoil.special_additives.join(', ')}
      </div>
    `;

    document.getElementById('mw-budget-list').innerHTML = budgetHtml;
    document.getElementById('mw-total-cost').innerText = '₹' + totalCost.toLocaleString();
  }

  // ========== GEOMETRY CALCULATIONS ==========
  let geometryInputMode = 'estimate';

  function toggleGeometryMode(mode) {
    geometryInputMode = mode;
    const compContainer = document.getElementById('mw-complexity-container');
    const manualContainer = document.getElementById('mw-manual-perimeter-container');
    const btnEstimate = document.getElementById('btn-mode-estimate');
    const btnManual = document.getElementById('btn-mode-manual');

    if (mode === 'manual') {
      compContainer.style.display = 'none'; manualContainer.style.display = 'block';
      btnManual.style.background = '#3d5a2b'; btnManual.style.color = 'white';
      btnEstimate.style.background = 'transparent'; btnEstimate.style.color = '#3d5a2b';
    } else {
      compContainer.style.display = 'block'; manualContainer.style.display = 'none';
      btnEstimate.style.background = '#3d5a2b'; btnEstimate.style.color = 'white';
      btnManual.style.background = 'transparent'; btnManual.style.color = '#3d5a2b';
    }
    calculateIrregularGeometry();
  }

  function calculateIrregularGeometry() {
    const area = parseFloat(document.getElementById('mw-area-input').value) || 0;
    let finalPerimeter = 0;

    if (geometryInputMode === 'estimate') {
      const complexityFactor = parseFloat(document.getElementById('mw-shape-complexity').value);
      finalPerimeter = Math.round(4 * Math.sqrt(area) * complexityFactor);
    } else {
      finalPerimeter = parseFloat(document.getElementById('mw-perimeter-input').value) || 0;
    }
    
    const fencingRatePerMeter = 150; 
    const totalFencingCost = finalPerimeter * fencingRatePerMeter;
    
    document.getElementById('mw-perimeter').innerText = finalPerimeter + ' m';
    document.getElementById('mw-fencing-cost').innerText = '₹' + totalFencingCost.toLocaleString();

    const warningBox = document.getElementById('mw-geometry-warning');
    warningBox.style.display = 'block';

    if (area < 30 && area > 0) {
      warningBox.style.background = '#fff3e0'; warningBox.style.color = '#c97a2f';
      warningBox.innerHTML = '⚠️ <strong>Area warning:</strong> Miyawaki patches require a minimum footprint of 30 sq meters to effectively bundle microclimate humidity.';
    } else if (geometryInputMode === 'manual' && finalPerimeter > 0 && area > 0) {
      const criticalRatio = finalPerimeter / Math.sqrt(area);
      if (criticalRatio > 6.0) {
        warningBox.style.background = '#fff3e0'; warningBox.style.color = '#c97a2f';
        warningBox.innerHTML = '⚠️ <strong>High Edge Exposure Ratio:</strong> This perimeter layout is highly stretched or segmented. Broaden the forest shape dimensions.';
      } else {
        warningBox.style.background = '#e6f5e8'; warningBox.style.color = '#2d7a3a';
        warningBox.innerHTML = '✅ <strong>Manual Bounds Registered.</strong>';
      }
    } else if (area >= 30) {
      warningBox.style.background = '#e6f5e8'; warningBox.style.color = '#2d7a3a';
      warningBox.innerHTML = '✅ <strong>Dimensions Validated.</strong>';
    } else {
      warningBox.style.display = 'none';
    }
    
    const mainAreaInput = document.getElementById('mw-area');
    if (mainAreaInput) { 
      mainAreaInput.value = area;
      if (document.getElementById('mw-results') && document.getElementById('mw-results').style.display === 'block') {
         calculateEnhancersAndBudget(); 
      }
    }
  }

  // ========== TIMELINE SIMULATOR ==========
  function simulateForestGrowth() {
    const year = parseInt(document.getElementById('mw-year-slider').value);
    document.getElementById('mw-year-label').innerText = 'Year ' + year;

    const areaInput = document.getElementById('mw-area');
    const area = areaInput ? parseFloat(areaInput.value) || 100 : 100;
    const saplings = Math.round(area * 3.5);

    const taskList = document.getElementById('mw-maintenance-tasks');
    const statusList = document.getElementById('mw-eco-status');
    const co2Output = document.getElementById('mw-co2-output');

    let co2PerTree = 0;
    if (year === 1) co2PerTree = 2; else if (year === 2) co2PerTree = 6; else if (year === 3) co2PerTree = 15; else co2PerTree = 15 + ((year - 3) * 18); 
    const totalCO2 = saplings * co2PerTree;
    
    if (totalCO2 > 1000) co2Output.innerText = (totalCO2 / 1000).toFixed(2) + ' Tons';
    else co2Output.innerText = totalCO2.toLocaleString() + ' kg';

    if (year === 1) {
      taskList.innerHTML = `<li>Water 4L per sqm daily.</li><li>Manual weeding monthly (do not uproot, cut and drop as mulch).</li><li>Check support sticks.</li>`;
      statusList.innerHTML = `<li>Average height: 1.5 - 2 meters.</li><li>Roots establishing in perforated soil.</li><li>Vulnerable to pests and grazing.</li>`;
    } else if (year === 2) {
      taskList.innerHTML = `<li>Watering reduced to 2L per sqm daily.</li><li>Bi-monthly check for invasive vines.</li><li>Remove support sticks if stems are thick.</li>`;
      statusList.innerHTML = `<li>Average height: 3 - 4 meters.</li><li>Canopy is beginning to touch and merge.</li><li>Local birds and insects start nesting.</li>`;
    } else if (year === 3) {
      taskList.innerHTML = `<li><strong>Zero maintenance required.</strong></li><li>Stop watering (unless extreme drought).</li><li>Do not enter or walk inside the patch.</li>`;
      statusList.innerHTML = `<li>Average height: 5+ meters.</li><li>Canopy is completely closed.</li><li>No sunlight reaches the floor (weeds die naturally).</li>`;
    } else {
      taskList.innerHTML = `<li><strong>100% Self-Sustaining.</strong></li><li>Monitor perimeter fencing.</li><li>Enjoy the local biodiversity.</li>`;
      statusList.innerHTML = `<li>Distinct 4-tier canopy fully established.</li><li>Local ambient temperature drops by 2°C to 4°C.</li><li>Heavy leaf drop creates natural compost layer.</li>`;
    }
  }

  // ========== GENERAL PLANNER ==========
  function getSpeciesRecommendation() {
    const goal = document.getElementById("goal").value;
    const climate = S.climate;
    const rainfall = parseInt(S.rainfall) || 900;
    const waterAvail = parseFloat(document.getElementById("waterAvail").value) || 0.75;
    const ph = parseFloat(document.getElementById("soilPH").value) || 6.5;
    const elevation = parseFloat(document.getElementById("elevation").value) || 300;
    const spacing = parseFloat(document.getElementById("spacing").value) || 3;
    const soilType = S.soil;
    
    let zone = "tropical_dry";
    if(climate.includes("Rainforest")) zone = "tropical_wet";
    else if(climate.includes("Tropical Wet")) zone = "tropical_dry";
    else if(climate.includes("Subtropical")) zone = "subtropical";
    else if(climate.includes("Temperate")) zone = "temperate";
    if(rainfall < 600) zone = "arid";
    if(elevation > 1500) zone = "temperate";
    if(waterAvail < 0.35) zone = "arid";
    
    const speciesMap = {
      tropical_wet: { carbon: ["Bamboo (Dendrocalamus strictus) - Fastest carbon sink", "Mahogany - High density carbon", "Hopea parviflora - Native evergreen"], timber: ["Teak - Premium timber", "Rosewood - Very high value", "White Cedar - Furniture"], fruit: ["Mango - King of fruits", "Jackfruit - Multipurpose", "Rambutan - High value"], restoration: ["Banyan - Keystone species", "Arjuna - Riparian restoration", "Indian Kino - Medicinal"], mixed: ["Arecanut + Pepper + Banana", "Coconut + Jackfruit + Clove", "Teak + Mango + Bamboo"] },
      tropical_dry: { carbon: ["Acacia auriculiformis - Nitrogen fixer", "Casuarina equisetifolia - Fast growing", "Subabul - Very fast biomass"], timber: ["Teak - Best for central India", "Sagwan - 10-12 year rotation", "Neem - Multipurpose timber"], fruit: ["Guava - Low maintenance", "Jamun - Native medicinal fruit", "Custard Apple - Drought tolerant"], restoration: ["Neem - Pioneer", "Bamboo - Erosion control", "Pongamia - Oilseed"], mixed: ["Silvopasture: Subabul + Grass", "Teak + Turmeric", "Neem + Guava + Acacia"] },
      subtropical: { carbon: ["Eucalyptus tereticornis - Fast, good biomass", "Acacia nilotica - Hardy, nitrogen fixer", "Silver Oak - Windbreak, carbon"], timber: ["Sheesham - North Indian timber", "Teak (in deeper soils)", "Kikar - Fuelwood"], fruit: ["Ber - Thrives in dry areas", "Pomegranate - Commercial", "Lasoda - Native dry fruit"], restoration: ["Neem - Excellent", "Khejri - Sacred tree", "Capparis decidua - Arid shrub"], mixed: ["Khejri + Ber + Grass", "Neem + Pomegranate border"] },
      temperate: { carbon: ["Oak - High altitude carbon", "Pine - Fast, slopes", "Cypress - Evergreen"], timber: ["Deodar - Premium Himalayan timber", "Walnut - Nut and wood", "Maple - Furniture"], fruit: ["Apple - Only in high hills", "Pear - Temperate fruit", "Plum - Low chilling"], restoration: ["Rhododendron - Soil binder", "Birch - Pioneer", "Himalayan Alder - Nitrogen fixer"], mixed: ["Oak + Pine + Grass", "Apple + Walnut + Legumes"] },
      arid: { carbon: ["Khejri - Best for desert", "Acacia tortilis - Drought", "Capparis decidua - Very hardy"], timber: ["Khejri - Slow but strong", "Tecomella undulata - Desert teak", "Acacia nilotica - Drier areas"], fruit: ["Ber - Excellent for dryland", "Pilu - Salt tolerant", "Ker - Wild fruit"], restoration: ["Khejri - Keystone", "Neem (with irrigation)", "Cenchrus grass + Khejri"], mixed: ["Khejri + Ber + Pasture", "Agroforestry with Aloe vera"] }
    };
    
    let zoneData = speciesMap[zone] || speciesMap.tropical_dry;
    let baseRecs = (zoneData[goal] || zoneData.carbon).map(item => { let [name, reason] = item.split(" - "); return { name, reason }; });
    
    let adjustedRecs = [...baseRecs];
    if(soilType === "Sandy Loam") { adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Jackfruit") && !r.name.includes("Mango")); adjustedRecs.unshift({ name: "Khejri", reason: "Excellent for sandy soils, drought tolerant." }); adjustedRecs.unshift({ name: "Neem", reason: "Adapts to sandy soils, multipurpose." }); }
    else if(soilType === "Clay-Loam" || soilType === "Alluvial") { adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Khejri") && !r.name.includes("Acacia nilotica")); adjustedRecs.unshift({ name: "Teak", reason: "Thrives in deep, fertile clay-loam." }); adjustedRecs.unshift({ name: "Bamboo", reason: "Loves moist, loamy soils." }); }
    
    let phAdjusted = [...adjustedRecs];
    if(ph < 5.5) { phAdjusted = phAdjusted.filter(r => !r.name.includes("Teak") && !r.name.includes("Mango")); phAdjusted.unshift({ name: "Casuarina equisetifolia", reason: "Excellent for acidic soils." }); }
    else if(ph > 8) { phAdjusted = phAdjusted.filter(r => !r.name.includes("Casuarina")); phAdjusted.unshift({ name: "Prosopis juliflora", reason: "Tolerates high pH and saline conditions." }); }
    
    let unique = []; let seen = new Set();
    for(let r of phAdjusted) { let key = r.name.toLowerCase(); if(!seen.has(key)) { seen.add(key); unique.push(r); } }
    return unique.slice(0,6);
  }

  function updateSpeciesRec() {
    let recs = getSpeciesRecommendation();
    let html = `<div style="display:flex;flex-direction:column;gap:0.8rem;">`;
    for(let r of recs) html += `<div class="species-rec-card"><strong>🌱 ${r.name}</strong><br><span style="font-size:0.8rem;color:var(--ink-mid);">${r.reason}</span></div>`;
    html += `</div><p style="margin-top:0.8rem;font-size:0.7rem;">👉 Recommendations influenced by soil pH, climate, rainfall, water.</p>`;
    document.getElementById("speciesRecBody").innerHTML = html;
  }
  
  function updateSuggestions() {
    let wA = parseFloat(document.getElementById("waterAvail").value);
    let mm = parseInt(S.rainfall) || 900;
    let budget = parseFloat(document.getElementById("budget").value);
    let fiveYrCost = window._fiveYrCost || 0;
    let ph = parseFloat(document.getElementById("soilPH").value);
    let phAdvice = getPHAdvice(ph);
    
    let suggestions = [];
    if(wA < 0.4) suggestions.push("💧 Water shortage: Dig farm ponds, use drip irrigation.");
    if(mm < 700) suggestions.push("☀️ Low rainfall: Mulch heavily, plant after monsoon.");
    if(budget < fiveYrCost) suggestions.push("💰 Budget shortfall: Apply for NAP, CAMPA, or SMAF subsidy.");
    if(ph < 5.5 || ph > 8) suggestions.push(`🧪 ${phAdvice}`);
    if(suggestions.length === 0) suggestions.push("✅ Your site looks good! Maintain regular weeding.");
    
    let html = `<div style="display:flex;flex-direction:column;gap:0.6rem;">`;
    for(let s of suggestions) html += `<div style="background:var(--sky);padding:0.6rem;border-radius:12px;font-size:0.8rem;">${s}</div>`;
    html += `</div>`;
    document.getElementById("suggestionsBody").innerHTML = html;
  }
  
  function getGoalMultipliers(goal) {
    switch(goal) {
      case 'carbon': return { saplingCost: 120, labourPerHa: 12000, maintFactor: 1.0 };
      case 'timber': return { saplingCost: 150, labourPerHa: 14000, maintFactor: 1.1 };
      case 'fruit': return { saplingCost: 130, labourPerHa: 13000, maintFactor: 1.3 };
      case 'restoration': return { saplingCost: 100, labourPerHa: 11000, maintFactor: 0.9 };
      default: return { saplingCost: 120, labourPerHa: 12000, maintFactor: 1.0 };
    }
  }

  function calc() {
    let unit = document.getElementById("area-unit").value;
    let raw_area = parseFloat(document.getElementById("area").value) || 10;
    let area = unit==="ha"? raw_area : unit==="sqm"? raw_area/10000 : raw_area*0.404686;
    let areaSqm = unit==="ha"? raw_area*10000 : unit==="sqm"? raw_area : raw_area*4046.86;
    
    let budget = parseFloat(document.getElementById("budget").value) || 500000;
    let sp = parseFloat(document.getElementById("spacing").value) || 3;
    let wA = parseFloat(document.getElementById("waterAvail").value);
    let pH = parseFloat(document.getElementById("soilPH").value);
    let el = parseFloat(document.getElementById("elevation").value);
    let mm = parseInt(S.rainfall) || 900;
    let goal = document.getElementById("goal").value;
    let maintLevel = document.getElementById("maintenance").value;
    
    // Kept for internal logic calculations downstream
    let totalSaplings = Math.round(areaSqm * 3.5);
    let phAmendment = getPHAmendment(pH, areaSqm);
    
    let multipliers = getGoalMultipliers(goal);
    let treesPerHa = Math.round(10000/(sp*sp));
    let totalTrees = Math.round(area * treesPerHa);
    let plantingCost = totalTrees * multipliers.saplingCost;
    let labourCost = area * multipliers.labourPerHa;
    let maintCostPerTree = (maintLevel === "low" ? 50 : maintLevel === "medium" ? 100 : 160) * multipliers.maintFactor;
    let fiveYrCost = plantingCost + labourCost + (maintCostPerTree * totalTrees * 5) + phAmendment.cost;
    window._fiveYrCost = fiveYrCost;
    
    let climateScore = S.climate.includes("Tropical") ? 0.9 : 0.7;
    let rainfallScore = Math.min(1, mm/2000);
    let soilScore = (S.soil.includes("Clay")||S.soil.includes("Alluvial")) ? 0.85 : 0.65;
    let elevationScore = el<800 ? 1 : (el<1500 ? 0.8 : 0.5);
    let phScore = getPHScore(pH);
    
    let kgPerTree = S.climate.includes("Tropical") ? 18 : 12;
    let carbonPerYr = ((totalTrees * kgPerTree) / 1000).toFixed(1);
    let projData = [...Array(11).keys()].map(y => +((totalTrees * kgPerTree * y * (1 + y*0.035))/1000).toFixed(1));
    if(projChart) { projChart.data.datasets[0].data = projData; projChart.update(); }
    
    let overall = computeSuccessRate();
    document.getElementById("mSuccess").innerText = (overall*100).toFixed(0)+"%";
    
    // REMOVED: UI element updates for material lists, updateSpeciesRec(), and updateSuggestions()
    
    if(polyClosed) renderPlantation();
}
  
function updateAllUI() {
    calc();
}
  // ========== FIELD DRAWING ==========
  function setDrawMode(mode) { drawModeActive=mode; document.getElementById("drawModeBtn")?.classList.toggle("active",mode); }
  function drawPolygonCanvas() { let c=document.getElementById("fieldCanvas"); if(!c) return; let ctx=c.getContext("2d"); c.width=c.clientWidth||600; c.height=340; ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="var(--canopy)"; ctx.fillRect(0,0,c.width,c.height); if(polyPoints.length===0){ ctx.fillStyle="var(--ink-lt)"; ctx.font="14px sans-serif"; ctx.fillText("Click to place boundary points",c.width/2-110,c.height/2); return; } if(polyPoints.length>=3){ ctx.beginPath(); ctx.moveTo(polyPoints[0].x,polyPoints[0].y); polyPoints.forEach(p=>ctx.lineTo(p.x,p.y)); if(polyClosed) ctx.closePath(); ctx.fillStyle=polyClosed?"rgba(61,90,43,0.2)":"rgba(61,90,43,0.1)"; ctx.fill(); ctx.strokeStyle="var(--moss)"; ctx.lineWidth=2.5; ctx.setLineDash(polyClosed?[]:[6,6]); ctx.stroke(); ctx.setLineDash([]); } polyPoints.forEach((p,i)=>{ ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fillStyle=i===0?"var(--amber)":"var(--moss)"; ctx.fill(); ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke(); }); }
  function handleCanvasClick(e) { if(!drawModeActive||polyClosed) return; let canvas=document.getElementById("fieldCanvas"); let rect=canvas.getBoundingClientRect(); let scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height; let mouseX=(e.clientX-rect.left)*scaleX, mouseY=(e.clientY-rect.top)*scaleY; mouseX=Math.min(canvas.width,Math.max(0,mouseX)); mouseY=Math.min(canvas.height,Math.max(0,mouseY)); if(polyPoints.length>2){ let first=polyPoints[0]; if(Math.hypot(mouseX-first.x,mouseY-first.y)<15){ closePolygon(); return; } } polyPoints.push({x:mouseX,y:mouseY}); drawPolygonCanvas(); document.getElementById("polyInfo").innerText=`${polyPoints.length} points. Click near orange start to close.`; }
  function clearPolygon() { polyPoints=[]; polyClosed=false; drawPolygonCanvas(); let pc=document.getElementById("plantationCanvas"); if(pc){ pc.width=pc.clientWidth||600; pc.height=340; pc.getContext("2d").clearRect(0,0,pc.width,pc.height); } document.getElementById("polyTrees").innerHTML="—"; document.getElementById("polyArea").innerHTML="—"; document.getElementById("polyCoverage").innerHTML="—"; document.getElementById("polyChannels").innerHTML="—"; toast("Polygon cleared"); }
  function closePolygon() { if(polyPoints.length<3){ toast("Need at least 3 points"); return; } polyClosed=true; drawPolygonCanvas(); renderPlantation(); toast("Polygon closed. Plantation simulated."); }
  function loadSampleField() { let c=document.getElementById("fieldCanvas"); if(c){ c.width=c.clientWidth||600; let w=c.width, h=340; polyPoints=[{x:w*0.2,y:h*0.3},{x:w*0.75,y:h*0.25},{x:w*0.85,y:h*0.6},{x:w*0.5,y:h*0.8},{x:w*0.25,y:h*0.7}]; polyClosed=true; drawPolygonCanvas(); renderPlantation(); toast("Sample field loaded"); } }
  function pointInPolygon(px,py,poly){ let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ let xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y; if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
  function renderPlantation() { if(!polyClosed||polyPoints.length<3) return; let c=document.getElementById("plantationCanvas"); if(!c) return; c.width=c.clientWidth||600; c.height=340; let ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="var(--canopy)"; ctx.fillRect(0,0,c.width,c.height); ctx.beginPath(); ctx.moveTo(polyPoints[0].x,polyPoints[0].y); polyPoints.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle="rgba(141,191,100,0.2)"; ctx.fill(); ctx.strokeStyle="var(--moss)"; ctx.stroke(); let spacing=parseFloat(document.getElementById("spacing").value)||3; let step=spacing*4.2; let bbox={minX:Math.min(...polyPoints.map(p=>p.x)),maxX:Math.max(...polyPoints.map(p=>p.x)),minY:Math.min(...polyPoints.map(p=>p.y)),maxY:Math.max(...polyPoints.map(p=>p.y))}; let treeCount=0, channels=0; for(let y=bbox.minY+step/2; y<bbox.maxY; y+=step){ let isChannel=Math.floor(y/step)%7===3; if(isChannel){ ctx.beginPath(); ctx.moveTo(bbox.minX,y); ctx.lineTo(bbox.maxX,y); ctx.strokeStyle="#4a8fa8"; ctx.lineWidth=3; ctx.stroke(); channels++; continue; } for(let x=bbox.minX+step/2; x<bbox.maxX; x+=step){ if(pointInPolygon(x,y,polyPoints)){ let color=Math.floor(x/step)%3===1?"#8fb870":Math.floor(x/step)%3===2?"#c97a2f":"#3d5a2b"; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); treeCount++; } } } let areaUnits=Math.abs(polyPoints.reduce((a,p,i)=>{let j=(i+1)%polyPoints.length;return a+p.x*polyPoints[j].y-polyPoints[j].x*p.y;},0)/2); let estHa=(areaUnits/(step*step*800)).toFixed(1); let coverage=Math.min(92,(treeCount*20/areaUnits)*10).toFixed(0); document.getElementById("polyTrees").innerHTML=treeCount; document.getElementById("polyArea").innerHTML=estHa+" ha"; document.getElementById("polyCoverage").innerHTML=coverage+"%"; document.getElementById("polyChannels").innerHTML=channels; }
 
function initCharts() {
  const chartCanvas = document.getElementById("projChart");

  if (!chartCanvas) {
    console.log("projChart canvas not found");
    return;
  }

  projChart = new Chart(chartCanvas,{
    type:"line",
    data:{
      labels:[0,1,2,3,4,5,6,7,8,9,10],
      datasets:[{
        label:"tCO₂",
        data:[0,0,0,0,0,0,0,0,0,0,0],
        borderColor:"#3d5a2b",
        fill:true
      }]
    },
    options:{responsive:true}
  });
}
  
  window.addEventListener("DOMContentLoaded",()=>{
    leafMap = L.map("map").setView([S.lat,S.lon],5); L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"© OpenStreetMap"}).addTo(leafMap); leafMarker = L.marker([S.lat,S.lon]).addTo(leafMap).bindPopup("📍 Default").openPopup();
    initCharts(); 
    setupEditableFields();
    updateAllUI();
    let fcanvas = document.getElementById("fieldCanvas"); fcanvas?.addEventListener("click",handleCanvasClick); drawPolygonCanvas();
    document.getElementById("themeToggle")?.addEventListener("click",()=>{ document.body.classList.toggle("dark"); toast("Theme toggled"); });
    setDrawMode(true); 
    toast("✅ App Loaded. Linked coordinates correctly.");
    setTimeout(calculateIrregularGeometry, 100);
    setTimeout(simulateForestGrowth, 100);
  });
  
  // Make functions global to the window
  window.calc=calc; window.detectLocation=detectLocation; window.clearPolygon=clearPolygon; window.closePolygon=closePolygon; window.loadSampleField=loadSampleField; window.setDrawMode=setDrawMode; window.searchLocation=searchLocation; window.getAgroZone=getAgroZone;
  window.analyzeSite = analyzeSite;
  window.calculateEnhancersAndBudget = calculateEnhancersAndBudget;
  window.toggleGeometryMode = toggleGeometryMode;
  window.calculateIrregularGeometry = calculateIrregularGeometry;
  window.simulateForestGrowth = simulateForestGrowth;
