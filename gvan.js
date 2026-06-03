
  let S = { lat:20.5937, lon:78.9629, soil:"Clay-Loam", rainfall:"900mm", climate:"Tropical Wet & Dry", sunlight:"High", ecoIndex:68 };
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
    // Site suitability components (0-1 each)
    let mm = parseInt(S.rainfall) || 900;
    let climateScore = S.climate.includes("Tropical") ? 0.9 : (S.climate.includes("Subtropical") ? 0.78 : 0.65);
    let rainfallScore = Math.min(1, mm/2000);
    let soilScore = (S.soil.includes("Clay")||S.soil.includes("Alluvial")) ? 0.85 : (S.soil.includes("Sandy") ? 0.6 : 0.7);
    let waterScore = parseFloat(document.getElementById("waterAvail").value) || 0.75;
    let elevationScore = (parseFloat(document.getElementById("elevation").value) || 320) < 800 ? 1 : 0.7;
    let phScore = getPHScore(parseFloat(document.getElementById("soilPH").value) || 6.5);
    let siteSuitability = (climateScore*0.25 + rainfallScore*0.2 + soilScore*0.2 + waterScore*0.2 + elevationScore*0.1 + phScore*0.05);
    
    // Goal alignment
    let goal = document.getElementById("goal").value;
    let goalScore = 1.0;
    if(goal === "fruit") {
      // Fruit trees need good water and moderate pH
      goalScore = (waterScore * 0.6 + (phScore > 0.7 ? 1 : 0.5) * 0.4);
    } else if(goal === "timber") {
      // Timber needs deep soil (soilScore) and good rainfall
      goalScore = (soilScore * 0.5 + rainfallScore * 0.5);
    } else if(goal === "carbon") {
      // Carbon works almost anywhere, but better with fast growth (water + rainfall)
      goalScore = (waterScore * 0.5 + rainfallScore * 0.5);
    } else if(goal === "restoration") {
      // Restoration tolerates poor conditions
      goalScore = (soilScore * 0.3 + waterScore * 0.3 + rainfallScore * 0.4);
    } else {
      // mixed
      goalScore = (soilScore * 0.4 + waterScore * 0.3 + rainfallScore * 0.3);
    }
    goalScore = Math.min(1, Math.max(0, goalScore));
    
    // Maintenance level (higher maintenance can compensate marginal site)
    let maintLevel = document.getElementById("maintenance").value;
    let maintScore = maintLevel === "high" ? 1.0 : (maintLevel === "medium" ? 0.7 : 0.4);
    
    // Budget adequacy
    let budget = parseFloat(document.getElementById("budget").value) || 500000;
    let fiveYrCost = parseFloat(document.getElementById("mCost").innerText.replace(/[^0-9.-]/g, '')) || 0;
    let budgetScore = Math.min(1, budget / (fiveYrCost || 1));
    
    // Spacing appropriateness
    let spacing = parseFloat(document.getElementById("spacing").value) || 3;
    let spacingScore = 1.0;
    if(goal === "timber" && spacing < 4) spacingScore = 0.6;
    if(goal === "fruit" && spacing > 4) spacingScore = 0.7;
    if(goal === "carbon" && spacing > 4) spacingScore = 0.8;
    if(goal === "mixed" && (spacing < 2.5 || spacing > 5)) spacingScore = 0.7;
    
    // Weighted sum
    let successRate = (siteSuitability * 0.50) +
                      (goalScore * 0.15) +
                      (maintScore * 0.10) +
                      (budgetScore * 0.15) +
                      (spacingScore * 0.10);
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
      item.onclick = (e) => {
        e.stopPropagation();
        onSelect(opt);
        div.remove();
      };
      div.appendChild(item);
    });
    document.body.appendChild(div);
    let closeHandler = (e) => {
      if (!div.contains(e.target)) {
        div.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  }

  function setupEditableFields() {
    const soilOpts = ['Clay-Loam', 'Sandy Loam', 'Alluvial', 'Silty Clay', 'Black Cotton', 'Red Laterite'];
    const rainOpts = ['400mm', '600mm', '900mm', '1200mm', '1600mm', '2200mm'];
    const climateOpts = ['Tropical Rainforest', 'Tropical Wet & Dry', 'Subtropical / Semi-arid', 'Temperate Oceanic', 'Continental Boreal'];
    
    const soilEl = document.getElementById('soilEdit');
    const rainEl = document.getElementById('rainEdit');
    const climateEl = document.getElementById('climateEdit');
    
    if(soilEl) {
      soilEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showDropdown(e.target, soilOpts, (val) => {
          S.soil = val;
          updateAllUI();
          toast(`Soil updated to ${val}`);
        });
      });
    }
    if(rainEl) {
      rainEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showDropdown(e.target, rainOpts, (val) => {
          S.rainfall = val;
          updateAllUI();
          toast(`Rainfall updated to ${val}`);
        });
      });
    }
    if(climateEl) {
      climateEl.addEventListener('click', (e) => {
        e.stopPropagation();
        showDropdown(e.target, climateOpts, (val) => {
          S.climate = val;
          updateAllUI();
          toast(`Climate updated to ${val}`);
        });
      });
    }
  }
  
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
      toast(`Location set to ${data[0].display_name.substring(0,40)}`);
    } catch(e) { toast("Search failed"); }
  }

  function deriveRainfall(lat) { let a=Math.abs(lat); if(a<10) return "2400mm"; if(a<15) return "1800mm"; if(a<23) return "1200mm"; if(a<30) return "900mm"; if(a<40) return "700mm"; return "500mm"; }
  function deriveClimate(lat) { let a=Math.abs(lat); if(a<10) return "Tropical Rainforest"; if(a<23) return "Tropical Wet & Dry"; if(a<35) return "Subtropical / Semi-arid"; return "Temperate Oceanic"; }
  function updateFromLocation(lat,lon) { S.lat=lat; S.lon=lon; S.rainfall=deriveRainfall(lat); S.climate=deriveClimate(lat); S.sunlight=Math.abs(lat)<25?"High Sunlight":"Moderate"; S.soil=["Clay-Loam","Sandy Loam","Alluvial","Silty Clay"][Math.floor(Math.random()*4)]; updateAllUI(); }
  
  function detectLocation() {
    if(!navigator.geolocation) { toast("Geolocation not supported"); return; }
    let btn=document.getElementById("detectBtn"); btn.innerText="⏳ detecting..."; btn.disabled=true;
    navigator.geolocation.getCurrentPosition(
      async (pos)=> { 
        let lat = pos.coords.latitude;
        let lon = pos.coords.longitude;
        updateFromLocation(lat, lon);
        if(leafMap) leafMap.setView([lat, lon], 16);
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
        btn.innerText="✅ Located"; btn.disabled=false;
      },
      (err)=> { toast("Location error: "+err.message); btn.innerText="📍 Detect"; btn.disabled=false; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  
  
  // ========== SPECIES RECOMMENDATION ==========

    function getAgroZone(lat, lon) {
  // 1. Basic Validation: Check if coordinates are roughly within India
  if (lat < 6.0 || lat > 38.0 || lon < 68.0 || lon > 98.0) {
    console.warn("Coordinates appear to be outside of India. Defaulting to North/Central.");
    return "north_central_arid_plains"; 
  }

  // 2. East & Northeast India (High Longitude / Eastern parameters)
  // Covers Assam, WB, Meghalaya, Arunachal, Odisha
  if (lon > 87.0 || (lat > 22.0 && lon > 84.0)) {
    return "east_northeast_subtropical";
  }

  // 3. Split the country roughly at Latitude 20.0 (Maharashtra/MP border)
  if (lat < 20.0) {
    // We are in South India. 
    // Now we split the West Coast (Ghats) from the Deccan Interior.
    // The Western Ghats run roughly west of 77.5 Longitude in the deep south.
    if (lon < 77.5) {
      return "western_ghats_coastal";
    } else {
      return "south_deccan_plateau";
    }
  } else {
    // We are above Latitude 20.0 and west of Longitude 84.0
    // Covers Delhi, Rajasthan, UP, MP, Haryana, Punjab, Gujarat
    return "north_central_arid_plains";
  }
} 
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
      tropical_wet: {
        carbon: ["Bamboo (Dendrocalamus strictus) - Fastest carbon sink, 20-30 tCO₂/ha/yr", "Mahogany (Swietenia macrophylla) - High density carbon", "Hopea parviflora - Native evergreen"],
        timber: ["Teak (Tectona grandis) - Premium timber", "Rosewood (Dalbergia latifolia) - Very high value", "White Cedar - Furniture"],
        fruit: ["Mango - King of fruits", "Jackfruit - Multipurpose", "Rambutan - High value"],
        restoration: ["Banyan - Keystone species", "Arjuna - Riparian restoration", "Indian Kino - Medicinal"],
        mixed: ["Arecanut + Pepper + Banana", "Coconut + Jackfruit + Clove", "Teak + Mango + Bamboo"]
      },
      tropical_dry: {
        carbon: ["Acacia auriculiformis - Nitrogen fixer, 12-18 tCO₂/ha/yr", "Casuarina equisetifolia - Fast growing", "Subabul - Very fast biomass"],
        timber: ["Teak - Best for central India", "Sagwan (Gmelina arborea) - 10-12 year rotation", "Neem - Multipurpose timber"],
        fruit: ["Guava - Low maintenance", "Jamun - Native medicinal fruit", "Custard Apple - Drought tolerant"],
        restoration: ["Neem - Pioneer", "Bamboo (Bambusa bambos) - Erosion control", "Pongamia - Oilseed"],
        mixed: ["Silvopasture: Subabul + Grass", "Teak + Turmeric", "Neem + Guava + Acacia"]
      },
      subtropical: {
        carbon: ["Eucalyptus tereticornis - Fast, good biomass", "Acacia nilotica - Hardy, nitrogen fixer", "Silver Oak - Windbreak, carbon"],
        timber: ["Sheesham (Dalbergia sissoo) - North Indian timber", "Teak (in deeper soils)", "Kikar - Fuelwood"],
        fruit: ["Ber (Ziziphus mauritiana) - Thrives in dry areas", "Pomegranate - Commercial", "Lasoda - Native dry fruit"],
        restoration: ["Neem - Excellent", "Khejri - Sacred tree", "Capparis decidua - Arid shrub"],
        mixed: ["Khejri + Ber + Grass", "Neem + Pomegranate border"]
      },
      temperate: {
        carbon: ["Oak (Quercus leucotrichophora) - High altitude carbon", "Pine (Pinus roxburghii) - Fast, slopes", "Cypress - Evergreen"],
        timber: ["Deodar (Cedrus deodara) - Premium Himalayan timber", "Walnut - Nut and wood", "Maple - Furniture"],
        fruit: ["Apple - Only in high hills", "Pear - Temperate fruit", "Plum - Low chilling"],
        restoration: ["Rhododendron - Soil binder", "Birch - Pioneer", "Himalayan Alder - Nitrogen fixer"],
        mixed: ["Oak + Pine + Grass", "Apple + Walnut + Legumes"]
      },
      arid: {
        carbon: ["Khejri (Prosopis cineraria) - Best for desert", "Acacia tortilis - Drought", "Capparis decidua - Very hardy"],
        timber: ["Khejri - Slow but strong", "Tecomella undulata (Rohida) - Desert teak", "Acacia nilotica - Drier areas"],
        fruit: ["Ber - Excellent for dryland", "Pilu - Salt tolerant", "Ker - Wild fruit"],
        restoration: ["Khejri - Keystone", "Neem (with irrigation)", "Cenchrus grass + Khejri"],
        mixed: ["Khejri + Ber + Pasture", "Agroforestry with Aloe vera"]
      }
    };
    
    let zoneData = speciesMap[zone] || speciesMap.tropical_dry;
    let baseRecs = (zoneData[goal] || zoneData.carbon).map(item => {
      let [name, reason] = item.split(" - ");
      return { name, reason };
    });
    
    // Soil adjustments
    let adjustedRecs = [...baseRecs];
    if(soilType === "Sandy Loam") {
      adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Jackfruit") && !r.name.includes("Mango"));
      adjustedRecs.unshift({ name: "Khejri (Prosopis cineraria)", reason: "Excellent for sandy soils, drought tolerant." });
      adjustedRecs.unshift({ name: "Neem (Azadirachta indica)", reason: "Adapts to sandy soils, multipurpose." });
    } else if(soilType === "Clay-Loam" || soilType === "Alluvial") {
      adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Khejri") && !r.name.includes("Acacia nilotica"));
      adjustedRecs.unshift({ name: "Teak (Tectona grandis)", reason: "Thrives in deep, fertile clay-loam." });
      adjustedRecs.unshift({ name: "Bamboo (Dendrocalamus strictus)", reason: "Loves moist, loamy soils." });
    } else if(soilType === "Black Cotton") {
      adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Teak") && !r.name.includes("Mahogany"));
      adjustedRecs.unshift({ name: "Neem", reason: "Tolerates heavy black cotton soil." });
      adjustedRecs.unshift({ name: "Acacia nilotica", reason: "Survives in cracking clay soils." });
    } else if(soilType === "Silty Clay" || soilType === "Red Laterite") {
      adjustedRecs = adjustedRecs.filter(r => !r.name.includes("Teak"));
      adjustedRecs.unshift({ name: "Casuarina equisetifolia", reason: "Adapts to laterite and silty clay." });
      adjustedRecs.unshift({ name: "Acacia auriculiformis", reason: "Tolerates poor, acidic laterite." });
    }
    
    // pH-based filtering
    let phAdjusted = [...adjustedRecs];
    if(ph < 5.5) {
      phAdjusted = phAdjusted.filter(r => !r.name.includes("Teak") && !r.name.includes("Mango") && !r.name.includes("Jackfruit"));
      phAdjusted.unshift({ name: "Casuarina equisetifolia", reason: "Excellent for acidic soils (pH 4.5-6.0)." });
      phAdjusted.unshift({ name: "Pine (Pinus roxburghii)", reason: "Tolerates acidic and poor soils." });
    } else if(ph > 8) {
      phAdjusted = phAdjusted.filter(r => !r.name.includes("Casuarina") && !r.name.includes("Pine"));
      phAdjusted.unshift({ name: "Prosopis juliflora", reason: "Tolerates high pH (8-9) and saline conditions (caution: invasive)." });
      phAdjusted.unshift({ name: "Khejri (Prosopis cineraria)", reason: "Thrives in alkaline soils of Rajasthan." });
    }
    
    // Spacing adjustments
    let spacingAdjusted = [...phAdjusted];
    if(spacing <= 2.5) {
      spacingAdjusted = spacingAdjusted.filter(r => !r.name.includes("Teak") && !r.name.includes("Mango"));
      spacingAdjusted.unshift({ name: "Bamboo", reason: "Narrow crown, ideal for dense spacing." });
      spacingAdjusted.unshift({ name: "Subabul (Leucaena leucocephala)", reason: "Slender tree, good for high density." });
    } else if(spacing >= 5) {
      spacingAdjusted = spacingAdjusted.filter(r => !r.name.includes("Bamboo") && !r.name.includes("Subabul"));
      spacingAdjusted.unshift({ name: "Teak", reason: "Needs wide spacing for large canopy." });
      spacingAdjusted.unshift({ name: "Mango", reason: "Spreading crown, requires 6-8 m spacing." });
    }
    
    if(waterAvail < 0.4 && !spacingAdjusted.some(r => r.name.includes("Khejri"))) {
      spacingAdjusted.unshift({ name: "Khejri (Prosopis cineraria)", reason: "Best for very dry conditions." });
    }
    
    let unique = [];
    let seen = new Set();
    for(let r of spacingAdjusted) {
      let key = r.name.toLowerCase();
      if(!seen.has(key)) { seen.add(key); unique.push(r); }
    }
    return unique.slice(0,6);
  }


  function updateSpeciesRec() {
    let recs = getSpeciesRecommendation();
    let html = `<div style="display:flex;flex-direction:column;gap:0.8rem;">`;
    for(let r of recs) {
      html += `<div class="species-rec-card"><strong>🌱 ${r.name}</strong><br><span style="font-size:0.8rem;color:var(--ink-mid);">${r.reason}</span></div>`;
    }
    html += `</div><p style="margin-top:0.8rem;font-size:0.7rem;">👉 Recommendations strongly influenced by soil pH, climate, rainfall, water, elevation, goal, and spacing.</p>`;
    document.getElementById("speciesRecBody").innerHTML = html;
  }
  
  function updateSuggestions() {
    let wA = parseFloat(document.getElementById("waterAvail").value);
    let mm = parseInt(S.rainfall) || 900;
    let budget = parseFloat(document.getElementById("budget").value);
    let fiveYrCost = parseFloat(document.getElementById("mCost").innerText.replace(/[^0-9.-]/g, '')) || 0;
    let ph = parseFloat(document.getElementById("soilPH").value);
    let soilScore = (S.soil.includes("Clay")||S.soil.includes("Alluvial")) ? 0.85 : 0.65;
    let phAdvice = getPHAdvice(ph);
    
    let suggestions = [];
    if(wA < 0.4) suggestions.push("💧 Water shortage: Dig farm ponds, use drip irrigation, plant drought‑tolerant trees like Neem, Khejri, Ber.");
    if(mm < 700) suggestions.push("☀️ Low rainfall: Mulch heavily, plant after monsoon, choose Acacia, Prosopis, Custard Apple.");
    if(budget < fiveYrCost) suggestions.push("💰 Budget shortfall: Apply for NAP, CAMPA, or SMAF subsidy at your local Agriculture Office or Forest Department.");
    if(soilScore < 0.5) suggestions.push("🌱 Poor soil: Add farmyard manure or compost. Grow green manure crops before planting.");
    if(ph < 5.5) suggestions.push(`🧪 ${phAdvice} Recommended: Mix wood ash (2-3 kg/10 sq m) or agricultural lime. Get soil test from KVK.`);
    if(ph > 8) suggestions.push(`🧪 ${phAdvice} Recommended: Add lots of compost (5-10 kg/sq m) or sulphur (1-2 kg/10 sq m).`);
    
    if(suggestions.length === 0) suggestions.push("✅ Your site looks good! Maintain regular weeding and watch for pests.");
    suggestions.push("🏛️ District Forest Officer: Contact your local forest range office for technical help and saplings.");
    suggestions.push("👨‍🌾 Agriculture Officer (ATMA): Get advice on agroforestry and subsidies. Call Kisan Call Centre 1551.");
    suggestions.push("🔥 Forest Fire: Dial 1924 immediately if you see fire.");
    suggestions.push("📞 Nearest Krishi Vigyan Kendra (KVK): Free soil testing and planting demonstrations.");
    
    let html = `<div style="display:flex;flex-direction:column;gap:0.6rem;">`;
    for(let s of suggestions) {
      html += `<div style="background:var(--sky);padding:0.6rem;border-radius:12px;font-size:0.8rem;">${s}</div>`;
    }
    html += `</div><p style="margin-top:0.6rem;font-size:0.7rem;">👉 Always consult local experts before large‑scale planting.</p>`;
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
    
    // Material calculations
    let totalSaplingsRaw = areaSqm * 3.5;
    let totalSaplings = Math.round(totalSaplingsRaw);
    let organicCompost = areaSqm * 0.20;
    let riceHusk = areaSqm * 0.10;
    let cocoPeat = areaSqm * 0.10;
    let surfaceMulch = areaSqm * 0.08;
    let irrigationWater = totalSaplings * 4.5 * 30;
    let phAmendment = getPHAmendment(pH, areaSqm);
    
    document.getElementById("totalSaplings").innerText = totalSaplings.toLocaleString();
    document.getElementById("organicCompost").innerText = organicCompost.toFixed(1) + " m³";
    document.getElementById("riceHusk").innerText = riceHusk.toFixed(1) + " m³";
    document.getElementById("cocoPeat").innerText = cocoPeat.toFixed(1) + " m³";
    document.getElementById("surfaceMulch").innerText = surfaceMulch.toFixed(1) + " m³";
    document.getElementById("irrigationWater").innerText = irrigationWater.toLocaleString() + " L";
    if(phAmendment.kg > 0) {
      document.getElementById("phAmendmentRow").style.display = "flex";
      document.getElementById("phAmendment").innerHTML = phAmendment.desc;
    } else {
      document.getElementById("phAmendmentRow").style.display = "none";
    }
    
    let multipliers = getGoalMultipliers(goal);
    let saplingCostPerTree = multipliers.saplingCost;
    let labourPerHa = multipliers.labourPerHa;
    let maintFactor = multipliers.maintFactor;
    let baseMaint = maintLevel === "low" ? 50 : maintLevel === "medium" ? 100 : 160;
    let maintCostPerTree = baseMaint * maintFactor;
    
    let treesPerHa = Math.round(10000/(sp*sp));
    let totalTrees = Math.round(area * treesPerHa);
    let plantingCost = totalTrees * saplingCostPerTree;
    let labourCost = area * labourPerHa;
    let phAmendmentCost = phAmendment.cost;
    let fiveYrCost = plantingCost + labourCost + (maintCostPerTree * totalTrees * 5) + phAmendmentCost;
    
    // Site suitability components for radar (excluding management factors)
    let climateScore = S.climate.includes("Tropical") ? 0.9 : (S.climate.includes("Subtropical") ? 0.78 : 0.65);
    let rainfallScore = Math.min(1, mm/2000);
    let soilScore = (S.soil.includes("Clay")||S.soil.includes("Alluvial")) ? 0.85 : (S.soil.includes("Sandy") ? 0.6 : 0.7);
    let waterScore = wA;
    let elevationScore = el<800 ? 1 : (el<1500 ? 0.8 : 0.5);
    let phScore = getPHScore(pH);
    
    // Update radar chart (only site factors)
    if(radarChart) { radarChart.data.datasets[0].data = [climateScore, rainfallScore, soilScore, waterScore, elevationScore, phScore]; radarChart.update(); }
    
    // Update cost chart (including amendment)
    if(costChart) { costChart.data.datasets[0].data = [plantingCost, labourCost, maintCostPerTree*totalTrees*5, phAmendmentCost]; costChart.update(); }
    
    // Carbon projection
    let kgPerTree = S.climate.includes("Tropical") ? 18 : (S.climate.includes("Subtropical") ? 15 : 12);
    let carbonPerYr = ((totalTrees * kgPerTree) / 1000).toFixed(1);
    let projData = [...Array(11).keys()].map(y => +((totalTrees * kgPerTree * y * (1 + y*0.035))/1000).toFixed(1));
    if(projChart) { projChart.data.datasets[0].data = projData; projChart.update(); }
    
    document.getElementById("mTrees").innerText = totalTrees.toLocaleString();
    document.getElementById("mCarbon").innerText = carbonPerYr;
    document.getElementById("mCost").innerText = "₹" + fiveYrCost.toLocaleString();
    
    // Compute comprehensive success rate
    let overall = computeSuccessRate();
    document.getElementById("mSuccess").innerText = (overall*100).toFixed(0)+"%";
    document.getElementById("heroTrees").innerText = totalTrees>999 ? (totalTrees/1000).toFixed(1)+"k" : totalTrees;
    document.getElementById("heroCarbon").innerText = carbonPerYr;
    document.getElementById("heroScore").innerText = (overall*100).toFixed(0)+"%";
    
    // Update health ring and bars (only site factors for visual)
    let siteOnlyOverall = climateScore*0.25 + rainfallScore*0.2 + soilScore*0.2 + waterScore*0.2 + elevationScore*0.1 + phScore*0.05;
    document.getElementById("rb-climate").style.width = climateScore*100+"%"; document.getElementById("rv-climate").innerText = (climateScore*100).toFixed(0)+"%";
    document.getElementById("rb-rain").style.width = rainfallScore*100+"%"; document.getElementById("rv-rain").innerText = (rainfallScore*100).toFixed(0)+"%";
    document.getElementById("rb-soil").style.width = soilScore*100+"%"; document.getElementById("rv-soil").innerText = (soilScore*100).toFixed(0)+"%";
    document.getElementById("rb-water").style.width = waterScore*100+"%"; document.getElementById("rv-water").innerText = (waterScore*100).toFixed(0)+"%";
    document.getElementById("ringPct").innerText = (overall*100).toFixed(0)+"%";
    let circ = document.getElementById("ringCircle"); if(circ) circ.style.strokeDashoffset = (263.89*(1-overall)).toFixed(2);
    document.getElementById("ecoIndexVal").innerText = (overall*100).toFixed(0)+"%";
    document.getElementById("ecoBar").style.width = overall*100+"%";
    
    // Factor analysis table (including goal, maintenance, budget, spacing)
    let budgetScore = Math.min(1, budget / (fiveYrCost || 1));
    let maintScore = maintLevel === "high" ? 1.0 : (maintLevel === "medium" ? 0.7 : 0.4);
    let spacingScore = 1.0;
    if(goal === "timber" && sp < 4) spacingScore = 0.6;
    if(goal === "fruit" && sp > 4) spacingScore = 0.7;
    if(goal === "carbon" && sp > 4) spacingScore = 0.8;
    let goalAlignmentScore = (goal === "fruit" ? (waterScore * 0.6 + (phScore > 0.7 ? 1 : 0.5) * 0.4) :
                              (goal === "timber" ? (soilScore * 0.5 + rainfallScore * 0.5) :
                               (goal === "carbon" ? (waterScore * 0.5 + rainfallScore * 0.5) :
                                (goal === "restoration" ? (soilScore * 0.3 + waterScore * 0.3 + rainfallScore * 0.4) :
                                 (soilScore * 0.4 + waterScore * 0.3 + rainfallScore * 0.3)))));
    goalAlignmentScore = Math.min(1, Math.max(0, goalAlignmentScore));
    
    let rows = [
      {f:"Climate", v:S.climate, score:climateScore, status:climateScore>0.7?"ok":"warn"},
      {f:"Rainfall", v:S.rainfall, score:rainfallScore, status:rainfallScore>0.6?"ok":"warn"},
      {f:"Soil", v:S.soil, score:soilScore, status:soilScore>0.7?"ok":"warn"},
      {f:"Water", v:wA.toFixed(2), score:waterScore, status:waterScore>0.6?"ok":"warn"},
      {f:"Elevation", v:el+" m", score:elevationScore, status:elevationScore>0.7?"ok":"warn"},
      {f:"Soil pH", v:pH.toFixed(1), score:phScore, status:phScore>0.8?"ok":(phScore>0.5?"warn":"bad")},
      {f:"Goal Alignment", v:goal, score:goalAlignmentScore, status:goalAlignmentScore>0.7?"ok":"warn"},
      {f:"Maintenance", v:maintLevel, score:maintScore, status:maintScore>0.7?"ok":"warn"},
      {f:"Budget Adequacy", v:"₹"+budget.toLocaleString(), score:budgetScore, status:budgetScore>0.8?"ok":(budgetScore>0.5?"warn":"bad")},
      {f:"Spacing Suitability", v:sp+" m", score:spacingScore, status:spacingScore>0.8?"ok":"warn"}
    ];
    document.getElementById("analysisBody").innerHTML = rows.map(r => `
      <tr>
        <td style="font-weight:500">${r.f}</td>
        <td>${r.v}</td>
        <td><div style="background:#e2e8cf;border-radius:20px;width:60px"><div style="width:${r.score*100}%;background:var(--moss);height:6px"></div></div>${(r.score*100).toFixed(0)}%</td>
        <td><span class="status-pill ${r.status}">${r.status==="ok"?"Good":(r.status==="warn"?"Marginal":"Poor")}</span></td>
      </tr>
    `).join("");
    
    updateSpeciesRec();
    updateSuggestions();
    if(polyClosed) renderPlantation();
  }
  
  function updateAllUI() { 
    document.getElementById("soilEdit").innerText = S.soil;
    document.getElementById("rainEdit").innerText = S.rainfall;
    document.getElementById("climateEdit").innerText = S.climate;
    calc(); 
  }
  
  // FIELD DRAWING (unchanged, fully functional)
  function setDrawMode(mode) { drawModeActive=mode; document.getElementById("drawModeBtn").classList.toggle("active",mode); }
  function drawPolygonCanvas() { let c=document.getElementById("fieldCanvas"); if(!c) return; let ctx=c.getContext("2d"); c.width=c.clientWidth||600; c.height=340; ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="var(--canopy)"; ctx.fillRect(0,0,c.width,c.height); if(polyPoints.length===0){ ctx.fillStyle="var(--ink-lt)"; ctx.font="14px sans-serif"; ctx.fillText("Click to place boundary points",c.width/2-110,c.height/2); return; } if(polyPoints.length>=3){ ctx.beginPath(); ctx.moveTo(polyPoints[0].x,polyPoints[0].y); polyPoints.forEach(p=>ctx.lineTo(p.x,p.y)); if(polyClosed) ctx.closePath(); ctx.fillStyle=polyClosed?"rgba(61,90,43,0.2)":"rgba(61,90,43,0.1)"; ctx.fill(); ctx.strokeStyle="var(--moss)"; ctx.lineWidth=2.5; ctx.setLineDash(polyClosed?[]:[6,6]); ctx.stroke(); ctx.setLineDash([]); } polyPoints.forEach((p,i)=>{ ctx.beginPath(); ctx.arc(p.x,p.y,5,0,Math.PI*2); ctx.fillStyle=i===0?"var(--amber)":"var(--moss)"; ctx.fill(); ctx.strokeStyle="white"; ctx.lineWidth=1.5; ctx.stroke(); }); }
  function handleCanvasClick(e) { if(!drawModeActive||polyClosed) return; let canvas=document.getElementById("fieldCanvas"); let rect=canvas.getBoundingClientRect(); let scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height; let mouseX=(e.clientX-rect.left)*scaleX, mouseY=(e.clientY-rect.top)*scaleY; mouseX=Math.min(canvas.width,Math.max(0,mouseX)); mouseY=Math.min(canvas.height,Math.max(0,mouseY)); if(polyPoints.length>2){ let first=polyPoints[0]; if(Math.hypot(mouseX-first.x,mouseY-first.y)<15){ closePolygon(); return; } } polyPoints.push({x:mouseX,y:mouseY}); drawPolygonCanvas(); document.getElementById("polyInfo").innerText=`${polyPoints.length} points. Click near orange start to close.`; }
  function clearPolygon() { polyPoints=[]; polyClosed=false; drawPolygonCanvas(); let pc=document.getElementById("plantationCanvas"); if(pc){ pc.width=pc.clientWidth||600; pc.height=340; pc.getContext("2d").clearRect(0,0,pc.width,pc.height); } document.getElementById("polyTrees").innerHTML="—"; document.getElementById("polyArea").innerHTML="—"; document.getElementById("polyCoverage").innerHTML="—"; document.getElementById("polyChannels").innerHTML="—"; toast("Polygon cleared"); }
  function closePolygon() { if(polyPoints.length<3){ toast("Need at least 3 points"); return; } polyClosed=true; drawPolygonCanvas(); renderPlantation(); toast("Polygon closed. Plantation simulated."); }
  function loadSampleField() { let c=document.getElementById("fieldCanvas"); if(c){ c.width=c.clientWidth||600; let w=c.width, h=340; polyPoints=[{x:w*0.2,y:h*0.3},{x:w*0.75,y:h*0.25},{x:w*0.85,y:h*0.6},{x:w*0.5,y:h*0.8},{x:w*0.25,y:h*0.7}]; polyClosed=true; drawPolygonCanvas(); renderPlantation(); toast("Sample field loaded"); } }
  function pointInPolygon(px,py,poly){ let inside=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ let xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y; if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside; } return inside; }
  function renderPlantation() { if(!polyClosed||polyPoints.length<3) return; let c=document.getElementById("plantationCanvas"); if(!c) return; c.width=c.clientWidth||600; c.height=340; let ctx=c.getContext("2d"); ctx.clearRect(0,0,c.width,c.height); ctx.fillStyle="var(--canopy)"; ctx.fillRect(0,0,c.width,c.height); ctx.beginPath(); ctx.moveTo(polyPoints[0].x,polyPoints[0].y); polyPoints.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.closePath(); ctx.fillStyle="rgba(141,191,100,0.2)"; ctx.fill(); ctx.strokeStyle="var(--moss)"; ctx.stroke(); let spacing=parseFloat(document.getElementById("spacing").value)||3; let step=spacing*4.2; let bbox={minX:Math.min(...polyPoints.map(p=>p.x)),maxX:Math.max(...polyPoints.map(p=>p.x)),minY:Math.min(...polyPoints.map(p=>p.y)),maxY:Math.max(...polyPoints.map(p=>p.y))}; let treeCount=0, channels=0; for(let y=bbox.minY+step/2; y<bbox.maxY; y+=step){ let isChannel=Math.floor(y/step)%7===3; if(isChannel){ ctx.beginPath(); ctx.moveTo(bbox.minX,y); ctx.lineTo(bbox.maxX,y); ctx.strokeStyle="#4a8fa8"; ctx.lineWidth=3; ctx.stroke(); channels++; continue; } for(let x=bbox.minX+step/2; x<bbox.maxX; x+=step){ if(pointInPolygon(x,y,polyPoints)){ let color=Math.floor(x/step)%3===1?"#8fb870":Math.floor(x/step)%3===2?"#c97a2f":"#3d5a2b"; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill(); treeCount++; } } } let areaUnits=Math.abs(polyPoints.reduce((a,p,i)=>{let j=(i+1)%polyPoints.length;return a+p.x*polyPoints[j].y-polyPoints[j].x*p.y;},0)/2); let estHa=(areaUnits/(step*step*800)).toFixed(1); let coverage=Math.min(92,(treeCount*20/areaUnits)*10).toFixed(0); document.getElementById("polyTrees").innerHTML=treeCount; document.getElementById("polyArea").innerHTML=estHa+" ha"; document.getElementById("polyCoverage").innerHTML=coverage+"%"; document.getElementById("polyChannels").innerHTML=channels; }
 

  function initCharts() {
    radarChart = new Chart(document.getElementById("radarChart"),{type:"radar",data:{labels:["Climate","Rainfall","Soil","Water","Elevation","pH"],datasets:[{label:"Suitability",data:[0,0,0,0,0,0],backgroundColor:"rgba(61,90,43,0.2)",borderColor:"#3d5a2b"}]},options:{responsive:true,maintainAspectRatio:false,scales:{r:{beginAtZero:true,max:1}}}});
    costChart = new Chart(document.getElementById("costChart"),{type:"doughnut",data:{labels:["Sapling + Planting","Labour (5 yr)","Maintenance (5 yr)","Soil Amendment"],datasets:[{data:[0,0,0,0],backgroundColor:["#3d5a2b","#567a40","#a8c97f","#c97a2f"]}]},options:{cutout:"60%"}});
    projChart = new Chart(document.getElementById("projChart"),{type:"line",data:{labels:[0,1,2,3,4,5,6,7,8,9,10],datasets:[{label:"tCO₂",data:[0,0,0,0,0,0,0,0,0,0,0],borderColor:"#3d5a2b",fill:true}]},options:{responsive:true}});
  }
  
  window.addEventListener("DOMContentLoaded",()=>{
    leafMap = L.map("map").setView([S.lat,S.lon],5); L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",{attribution:"© OpenStreetMap"}).addTo(leafMap); leafMarker = L.marker([S.lat,S.lon]).addTo(leafMap).bindPopup("📍 Default").openPopup();
    initCharts(); 
    setupEditableFields();
    updateAllUI();
    let fcanvas = document.getElementById("fieldCanvas"); fcanvas.addEventListener("click",handleCanvasClick); drawPolygonCanvas();
    document.getElementById("themeToggle").addEventListener("click",()=>{ document.body.classList.toggle("dark"); toast("Theme toggled"); });
    setDrawMode(true); 
    toast("✅ Success rate now includes goal, maintenance, budget, spacing – fully comprehensive");
  });
  window.calc=calc; window.detectLocation=detectLocation; window.clearPolygon=clearPolygon; window.closePolygon=closePolygon; window.loadSampleField=loadSampleField; window.setDrawMode=setDrawMode; window.searchLocation=searchLocation;
