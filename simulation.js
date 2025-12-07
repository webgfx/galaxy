import * as THREE from 'three';
import { Fn, uniform, float, vec3, sin, cos, mix, normalize, length, positionLocal, positionWorld, WebGPURenderer, select, int, mx_noise_float, uv, vec2, color, normalView } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Simulation {
    constructor(canvas) {
        this.canvas = canvas;
        this.count = 8; // Sun + 7 Planets
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.controls = null;
        
        // Interaction
        this.targetPos = new THREE.Vector3(0, 0, 0);
        this.time = 0;
        this.isPaused = false;
        
        this.planets = []; // Array of { mesh, data, angle }
        
        // Language support
        this.currentLang = 'en';
        this.translations = {
            en: {
                Sun: 'Sun',
                Mercury: 'Mercury',
                Venus: 'Venus',
                Earth: 'Earth',
                Mars: 'Mars',
                Jupiter: 'Jupiter',
                Saturn: 'Saturn',
                Uranus: 'Uranus',
                Neptune: 'Neptune'
            },
            zh: {
                Sun: '太阳',
                Mercury: '水星',
                Venus: '金星',
                Earth: '地球',
                Mars: '火星',
                Jupiter: '木星',
                Saturn: '土星',
                Uranus: '天王星',
                Neptune: '海王星'
            }
        };
        
        this.init();
    }

    createLabelTexture(text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        canvas.width = 256;
        canvas.height = 64;
        
        // Clear canvas to fully transparent
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        
        ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.premultiplyAlpha = false;
        texture.needsUpdate = true;
        return texture;
    }

    // Set language and update all labels
    setLanguage(lang) {
        if (lang !== 'en' && lang !== 'zh') return;
        this.currentLang = lang;
        
        // Update all planet labels
        for (const p of this.planets) {
            const translatedName = this.translations[lang][p.data.name] || p.data.name;
            const newTexture = this.createLabelTexture(translatedName);
            p.label.material.map.dispose();
            p.label.material.map = newTexture;
            p.label.material.needsUpdate = true;
        }
    }

    // TSL Procedural Material Generator - Highly Detailed Realistic Planets
    createPlanetMaterial(index, planetName) {
        const material = new THREE.MeshStandardNodeMaterial();
        
        // Base Position for 3D noise (seamless on sphere)
        const pos = positionLocal.normalize();
        
        // Fresnel for atmosphere effect
        const fresnel = float(1.0).sub(normalView.z.abs()).pow(2.5);
        
        // FBM (Fractal Brownian Motion) helper - adds detail at multiple scales
        const fbm = (p, octaves) => {
            let value = mx_noise_float(p);
            let amplitude = float(0.5);
            let frequency = float(2.0);
            for (let i = 1; i < octaves; i++) {
                value = value.add(mx_noise_float(p.mul(frequency)).mul(amplitude));
                amplitude = amplitude.mul(0.5);
                frequency = frequency.mul(2.0);
            }
            return value;
        };

        switch (planetName) {
            case 'Sun': {
                const time = uniform(0);
                material.userData.timeUniform = time;
                
                // Multi-scale granulation for realistic solar surface
                const n1 = mx_noise_float(pos.mul(8.0).add(time.mul(0.08)));
                const n2 = mx_noise_float(pos.mul(20.0).add(time.mul(0.2)));
                const n3 = mx_noise_float(pos.mul(40.0).add(time.mul(0.4)));
                const n4 = mx_noise_float(pos.mul(80.0).add(time.mul(0.6)));
                const n5 = mx_noise_float(pos.mul(4.0).add(time.mul(0.03)));
                
                // Combine for granulation and sunspots
                const granulation = n1.mul(0.35).add(n2.mul(0.25)).add(n3.mul(0.2)).add(n4.mul(0.1)).add(n5.mul(0.1));
                
                // Sunspots (darker regions)
                const sunspots = mx_noise_float(pos.mul(6.0).add(time.mul(0.02)));
                const sunspotMask = sunspots.step(0.3).mul(0.4);
                
                // Strong limb darkening for 3D spherical appearance
                // normalView.z gives us how much the surface faces the camera (1 = facing, 0 = edge)
                const viewAngle = normalView.z.abs();
                const limbDarkening = viewAngle.pow(0.4); // Strong center-to-edge falloff
                
                // Color gradient from bright center to dark edge
                const coreColor = vec3(1.0, 1.0, 0.9);   // Bright white-yellow center
                const midColor = vec3(1.0, 0.75, 0.3);   // Orange-yellow
                const edgeColor = vec3(0.8, 0.25, 0.02); // Dark red-orange edge
                const spotColor = vec3(0.5, 0.2, 0.08);  // Dark sunspot
                
                // Layer the colors based on limb darkening
                let sunColor = mix(edgeColor, midColor, limbDarkening.pow(0.6));
                sunColor = mix(sunColor, coreColor, limbDarkening.pow(1.5));
                
                // Add granulation texture
                sunColor = sunColor.mul(granulation.mul(0.3).add(0.85));
                
                // Apply sunspots
                sunColor = mix(sunColor, spotColor, sunspotMask);
                
                // Enhanced corona glow at edge
                const coronaGlow = float(1.0).sub(viewAngle).pow(2.5).mul(0.25);
                sunColor = sunColor.add(vec3(coronaGlow, coronaGlow.mul(0.4), coronaGlow.mul(0.05)));
                
                // Boost overall brightness
                sunColor = sunColor.mul(1.15);
                
                material.colorNode = vec3(0.0);
                material.emissiveNode = sunColor;
                material.roughness = 1.0;
                break;
            }
            
            case 'Mercury': {
                // Heavily cratered surface with rays and scarps
                const largeCraters = mx_noise_float(pos.mul(12.0));
                const medCraters = mx_noise_float(pos.mul(30.0));
                const smallCraters = mx_noise_float(pos.mul(60.0));
                const surface = mx_noise_float(pos.mul(6.0));
                const rays = mx_noise_float(pos.mul(100.0));
                const microDetail = mx_noise_float(pos.mul(120.0));
                
                // More realistic Mercury colors with warm tones
                const baseGray = vec3(0.65, 0.60, 0.55);
                const darkGray = vec3(0.35, 0.32, 0.30);
                const lightGray = vec3(0.80, 0.77, 0.72);
                const warmGray = vec3(0.75, 0.68, 0.58);
                const rayColor = vec3(0.92, 0.90, 0.85);
                
                // Multi-scale crater depth
                const craterDepth = largeCraters.step(0.35).mul(0.35)
                    .add(medCraters.step(0.4).mul(0.2))
                    .add(smallCraters.step(0.45).mul(0.1));
                
                let mercuryColor = mix(baseGray, darkGray, craterDepth);
                mercuryColor = mix(mercuryColor, warmGray, surface.step(0.6).mul(0.3));
                mercuryColor = mix(mercuryColor, lightGray, surface.step(0.7).mul(0.2));
                
                // Bright crater rays
                const rayMask = rays.step(0.85).mul(largeCraters.step(0.3));
                mercuryColor = mix(mercuryColor, rayColor, rayMask.mul(0.5));
                
                // Scarps and ridges
                const scarpNoise = mx_noise_float(pos.mul(15.0).add(vec3(pos.x, 0.0, 0.0)));
                mercuryColor = mix(mercuryColor, darkGray, scarpNoise.step(0.55).mul(0.15));
                
                // Micro texture
                mercuryColor = mercuryColor.mul(microDetail.mul(0.15).add(0.925));
                
                material.colorNode = mercuryColor;
                material.roughness = 0.85;
                material.metalness = 0.0;
                break;
            }
            
            case 'Venus': {
                // Thick, swirling cloud atmosphere with multiple layers
                const largeSwirl = mx_noise_float(pos.mul(2.0).add(vec3(pos.y.mul(3.0), 0.0, 0.0)));
                const medSwirl = mx_noise_float(pos.mul(5.0).add(vec3(pos.y.mul(1.5), pos.x, 0.0)));
                const detail = mx_noise_float(pos.mul(15.0));
                const fineDetail = mx_noise_float(pos.mul(40.0));
                const bands = sin(pos.y.mul(6.0).add(largeSwirl.mul(2.0)));
                const turbulence = mx_noise_float(pos.mul(25.0));
                
                // More vibrant Venus colors
                const venusBright = vec3(1.0, 0.95, 0.75);
                const venusYellow = vec3(0.98, 0.88, 0.62);
                const venusGold = vec3(0.95, 0.80, 0.50);
                const venusTan = vec3(0.85, 0.72, 0.48);
                const venusDark = vec3(0.70, 0.58, 0.40);
                
                // Complex cloud layering with more color variation
                let venusColor = mix(venusYellow, venusGold, largeSwirl);
                venusColor = mix(venusColor, venusBright, bands.mul(0.5).add(0.5).mul(0.4));
                venusColor = mix(venusColor, venusTan, medSwirl.step(0.5).mul(0.3));
                venusColor = mix(venusColor, venusDark, medSwirl.step(0.6).mul(0.2));
                venusColor = mix(venusColor, venusColor.mul(0.88), detail.step(0.6).mul(0.2));
                venusColor = mix(venusColor, venusColor.mul(1.15), fineDetail.step(0.7).mul(0.15));
                venusColor = venusColor.mul(turbulence.mul(0.1).add(0.95));
                
                // Enhanced thick atmosphere glow
                const atmosColor = vec3(1.0, 0.95, 0.70);
                venusColor = venusColor.add(atmosColor.mul(fresnel.pow(1.5)).mul(0.7));
                
                material.colorNode = venusColor;
                material.roughness = 0.55;
                material.metalnessNode = float(0.0);
                break;
            }
            
            case 'Earth': {
                // Highly detailed Earth
                const continentNoise = mx_noise_float(pos.mul(4.0));
                const coastDetail = mx_noise_float(pos.mul(12.0));
                const terrainDetail = mx_noise_float(pos.mul(25.0));
                const microDetail = mx_noise_float(pos.mul(50.0));
                const cloudLarge = mx_noise_float(pos.mul(6.0).add(vec3(0.3, 0.0, 0.0)));
                const cloudDetail = mx_noise_float(pos.mul(18.0).add(vec3(0.1, 0.0, 0.0)));
                const iceNoise = mx_noise_float(pos.mul(30.0));
                
                // More vibrant ocean colors
                const deepOcean = vec3(0.02, 0.08, 0.25);
                const midOcean = vec3(0.04, 0.15, 0.45);
                const shallowOcean = vec3(0.08, 0.30, 0.60);
                const coastalWater = vec3(0.12, 0.40, 0.65);
                
                const oceanDepth = mx_noise_float(pos.mul(8.0));
                let ocean = mix(deepOcean, midOcean, oceanDepth.mul(0.5));
                ocean = mix(ocean, shallowOcean, coastDetail.step(0.55).mul(0.5));
                
                // Land biomes with richer, more vibrant colors
                const tropicalForest = vec3(0.08, 0.42, 0.12);
                const temperateForest = vec3(0.15, 0.48, 0.15);
                const grassland = vec3(0.45, 0.58, 0.25);
                const desert = vec3(0.88, 0.75, 0.50);
                const tundra = vec3(0.62, 0.60, 0.55);
                const mountain = vec3(0.52, 0.48, 0.42);
                const snow = vec3(0.98, 0.99, 1.0);
                
                // Latitude-based biome selection
                const absLat = pos.y.abs();
                const tropical = absLat.lessThan(0.25);
                const temperate = absLat.greaterThan(0.25).and(absLat.lessThan(0.55));
                const polar = absLat.greaterThan(0.75);
                
                // Base land color by latitude
                let land = select(tropical, mix(tropicalForest, desert, terrainDetail), temperateForest);
                land = select(temperate, mix(temperateForest, grassland, terrainDetail), land);
                land = select(polar, mix(tundra, snow, iceNoise), land);
                
                // Add mountains at high terrain values
                const isMountain = terrainDetail.greaterThan(0.6);
                land = select(isMountain, mix(land, mountain, terrainDetail), land);
                
                // Snow on high mountains
                const highMountain = terrainDetail.greaterThan(0.75);
                land = select(highMountain, mix(land, snow, microDetail.mul(0.5).add(0.3)), land);
                
                // Coastal transition
                const isLand = continentNoise.add(coastDetail.mul(0.2)).step(0.5);
                const coastMix = continentNoise.add(coastDetail.mul(0.2)).sub(0.45).mul(10.0).clamp(0.0, 1.0);
                const coastalLand = mix(coastalWater, land, coastMix);
                const surface = mix(ocean, coastalLand, isLand);
                
                // Multi-layer clouds
                const cloudBase = cloudLarge.step(0.45);
                const cloudWispy = cloudDetail.step(0.5).mul(0.6);
                const clouds = cloudBase.mul(0.9).add(cloudWispy.mul(0.4)).clamp(0.0, 1.0);
                const cloudShadow = cloudBase.mul(0.15);
                
                const cloudColor = vec3(1.0, 1.0, 1.0);
                let earthColor = mix(surface, surface.mul(0.85), cloudShadow);
                earthColor = mix(earthColor, cloudColor, clouds);
                
                // Enhanced blue atmosphere with stronger glow
                const atmosColor = vec3(0.45, 0.70, 1.0);
                earthColor = earthColor.add(atmosColor.mul(fresnel.pow(1.2)).mul(0.65));
                
                // Water reflectivity with specular highlights
                const isWater = float(1.0).sub(isLand);
                material.roughnessNode = mix(float(0.85), float(0.05), isWater.mul(float(1.0).sub(clouds)));
                material.metalnessNode = mix(float(0.0), float(0.1), isWater);
                material.colorNode = earthColor;
                break;
            }
            
            case 'Mars': {
                // Detailed Martian surface with geological features
                const largeFeature = mx_noise_float(pos.mul(3.0));
                const rockNoise = mx_noise_float(pos.mul(12.0));
                const detailNoise = mx_noise_float(pos.mul(35.0));
                const fineDetail = mx_noise_float(pos.mul(70.0));
                const dustStorm = mx_noise_float(pos.mul(8.0));
                const canyonNoise = mx_noise_float(pos.mul(5.0).add(vec3(0.0, pos.x.mul(2.0), 0.0)));
                
                // More vibrant Mars colors
                const marsRust = vec3(0.85, 0.45, 0.25);
                const marsOrange = vec3(0.92, 0.52, 0.28);
                const marsDark = vec3(0.55, 0.28, 0.15);
                const marsLight = vec3(0.95, 0.65, 0.42);
                const marsDust = vec3(0.98, 0.78, 0.58);
                const canyonDark = vec3(0.42, 0.22, 0.12);
                const ice = vec3(0.98, 0.98, 1.0);
                
                // Base terrain with more color variation
                let marsColor = mix(marsRust, marsOrange, largeFeature);
                marsColor = mix(marsColor, marsDark, largeFeature.step(0.35).mul(0.5));
                marsColor = mix(marsColor, marsLight, rockNoise.step(0.55).mul(0.4));
                marsColor = mix(marsColor, marsColor.mul(0.82), detailNoise.step(0.65).mul(0.25));
                marsColor = mix(marsColor, marsColor.mul(1.12), fineDetail.step(0.68).mul(0.18));
                
                // Valles Marineris-like canyons
                const canyonMask = canyonNoise.step(0.35).mul(pos.y.abs().lessThan(0.3));
                marsColor = mix(marsColor, canyonDark, canyonMask.mul(0.5));
                
                // Dust storm regions with more visibility
                marsColor = mix(marsColor, marsDust, dustStorm.step(0.65).mul(0.3));
                
                // Polar ice caps (both poles) - more prominent
                const northPolar = pos.y.greaterThan(0.78);
                const southPolar = pos.y.lessThan(-0.82);
                const iceDetail = mx_noise_float(pos.mul(25.0));
                const iceCap = select(northPolar.or(southPolar), mix(marsColor, ice, iceDetail.mul(0.3).add(0.7)), marsColor);
                marsColor = iceCap;
                
                // Enhanced thin orange atmosphere
                const atmosColor = vec3(1.0, 0.70, 0.50);
                marsColor = marsColor.add(atmosColor.mul(fresnel.pow(1.2)).mul(0.25));
                
                material.colorNode = marsColor;
                material.roughness = 0.82;
                material.metalnessNode = float(0.0);
                break;
            }
            
            case 'Jupiter': {
                // Complex banded structure with Great Red Spot and detailed turbulence
                const largeDistort = mx_noise_float(pos.mul(1.5));
                const medDistort = mx_noise_float(pos.mul(4.0));
                const fineDetail = mx_noise_float(pos.mul(25.0));
                const microDetail = mx_noise_float(pos.mul(50.0));
                const stormNoise = mx_noise_float(pos.mul(10.0));
                
                // Complex multi-frequency bands
                const bandY1 = pos.y.mul(14.0).add(largeDistort.mul(2.0));
                const bandY2 = pos.y.mul(28.0).add(medDistort.mul(1.5));
                const bands1 = sin(bandY1).mul(0.5).add(0.5);
                const bands2 = sin(bandY2).mul(0.5).add(0.5);
                
                // More vibrant Jupiter colors
                const cream = vec3(0.98, 0.94, 0.85);
                const tan = vec3(0.88, 0.76, 0.62);
                const orange = vec3(0.92, 0.70, 0.48);
                const brown = vec3(0.65, 0.48, 0.36);
                const darkBrown = vec3(0.48, 0.35, 0.25);
                const redSpot = vec3(0.95, 0.52, 0.40);
                const white = vec3(0.98, 0.97, 0.95);
                
                // Layer bands with more color variety
                let jupiterColor = mix(tan, cream, bands1);
                jupiterColor = mix(jupiterColor, orange, bands1.step(0.35).mul(0.3));
                jupiterColor = mix(jupiterColor, brown, bands2.mul(0.45));
                
                // Add turbulent eddies
                jupiterColor = mix(jupiterColor, darkBrown, stormNoise.step(0.58).mul(0.4));
                jupiterColor = mix(jupiterColor, white, stormNoise.step(0.82).mul(0.35));
                
                // Fine cloud texture
                jupiterColor = mix(jupiterColor, jupiterColor.mul(0.88), fineDetail.step(0.65).mul(0.2));
                jupiterColor = mix(jupiterColor, jupiterColor.mul(1.1), microDetail.step(0.68).mul(0.12));
                
                // Great Red Spot region - more prominent
                const spotX = pos.x.add(0.3);
                const spotZ = pos.z.sub(0.2);
                const spotY = pos.y.add(0.2);
                const spotDist = spotX.mul(spotX).add(spotZ.mul(spotZ).mul(0.5)).add(spotY.mul(spotY).mul(4.0));
                const inSpot = spotDist.lessThan(0.18);
                const spotTurbulence = mx_noise_float(pos.mul(20.0).add(vec3(spotX.mul(5.0), 0.0, 0.0)));
                jupiterColor = select(inSpot, mix(jupiterColor, redSpot, spotTurbulence.mul(0.4).add(0.6)), jupiterColor);
                
                material.colorNode = jupiterColor;
                material.roughness = 0.42;
                material.metalnessNode = float(0.0);
                break;
            }
            
            case 'Saturn': {
                // Subtle but detailed banded atmosphere
                const largeDistort = mx_noise_float(pos.mul(1.2));
                const medDistort = mx_noise_float(pos.mul(3.5));
                const detail = mx_noise_float(pos.mul(15.0));
                const fineDetail = mx_noise_float(pos.mul(35.0));
                const stormNoise = mx_noise_float(pos.mul(8.0));
                
                const bandY = pos.y.mul(10.0).add(largeDistort.mul(1.2));
                const bands = sin(bandY).mul(0.5).add(0.5);
                const subBands = sin(pos.y.mul(25.0).add(medDistort)).mul(0.5).add(0.5);
                
                // More beautiful golden Saturn colors
                const paleGold = vec3(0.98, 0.92, 0.72);
                const gold = vec3(0.95, 0.85, 0.60);
                const richGold = vec3(0.92, 0.80, 0.52);
                const tan = vec3(0.85, 0.76, 0.55);
                const brown = vec3(0.72, 0.62, 0.45);
                const cream = vec3(1.0, 0.98, 0.90);
                
                let saturnColor = mix(tan, paleGold, bands);
                saturnColor = mix(saturnColor, gold, bands.step(0.45).mul(0.4));
                saturnColor = mix(saturnColor, richGold, subBands.mul(0.3));
                saturnColor = mix(saturnColor, brown, detail.step(0.52).mul(0.2));
                saturnColor = mix(saturnColor, cream, stormNoise.step(0.78).mul(0.25));
                saturnColor = mix(saturnColor, saturnColor.mul(0.92), fineDetail.step(0.6).mul(0.12));
                
                // Polar hexagon hint (north pole)
                const northPolar = pos.y.greaterThan(0.85);
                const hexNoise = mx_noise_float(pos.mul(12.0));
                saturnColor = select(northPolar, mix(saturnColor, brown, hexNoise.mul(0.3)), saturnColor);
                
                material.colorNode = saturnColor;
                material.roughness = 0.38;
                material.metalnessNode = float(0.0);
                break;
            }
            
            case 'Uranus': {
                // Subtle banding with slight seasonal variation
                const subtle = mx_noise_float(pos.mul(4.0));
                const detail = mx_noise_float(pos.mul(12.0));
                const fineDetail = mx_noise_float(pos.mul(30.0));
                const bands = sin(pos.y.mul(8.0).add(subtle.mul(0.5))).mul(0.5).add(0.5);
                
                // More beautiful cyan-turquoise colors
                const uranusLight = vec3(0.78, 0.95, 0.98);
                const uranusBright = vec3(0.70, 0.90, 0.95);
                const uranusBase = vec3(0.62, 0.85, 0.90);
                const uranusDark = vec3(0.52, 0.75, 0.82);
                const uranusPole = vec3(0.68, 0.92, 0.95);
                
                let uranusColor = mix(uranusBase, uranusLight, bands.mul(0.35));
                uranusColor = mix(uranusColor, uranusBright, bands.step(0.5).mul(0.25));
                uranusColor = mix(uranusColor, uranusDark, detail.step(0.52).mul(0.18));
                uranusColor = mix(uranusColor, uranusColor.mul(0.95), fineDetail.step(0.6).mul(0.08));
                
                // Polar region (tilted axis effect) - more prominent
                const polar = pos.y.abs().greaterThan(0.68);
                uranusColor = select(polar, mix(uranusColor, uranusPole, float(0.4)), uranusColor);
                
                // Enhanced atmospheric haze
                const atmosColor = vec3(0.80, 0.97, 1.0);
                uranusColor = uranusColor.add(atmosColor.mul(fresnel.pow(1.3)).mul(0.45));
                
                material.colorNode = uranusColor;
                material.roughness = 0.32;
                material.metalnessNode = float(0.0);
                break;
            }
            
            case 'Neptune': {
                // Dynamic blue with visible storm features
                const largeStorm = mx_noise_float(pos.mul(4.0));
                const medStorm = mx_noise_float(pos.mul(10.0));
                const detail = mx_noise_float(pos.mul(20.0));
                const fineDetail = mx_noise_float(pos.mul(45.0));
                const bands = sin(pos.y.mul(10.0).add(largeStorm)).mul(0.5).add(0.5);
                
                // More vibrant deep blue colors
                const neptuneDeep = vec3(0.18, 0.32, 0.82);
                const neptuneBlue = vec3(0.25, 0.45, 0.92);
                const neptuneBright = vec3(0.35, 0.55, 0.98);
                const neptuneLight = vec3(0.50, 0.68, 1.0);
                const stormWhite = vec3(0.95, 0.96, 1.0);
                const darkSpot = vec3(0.12, 0.22, 0.60);
                
                let neptuneColor = mix(neptuneBlue, neptuneDeep, bands.mul(0.35));
                neptuneColor = mix(neptuneColor, neptuneBright, bands.step(0.5).mul(0.3));
                neptuneColor = mix(neptuneColor, neptuneLight, medStorm.step(0.62).mul(0.35));
                
                // Great Dark Spot region
                const spotDist = pos.x.add(0.2).mul(pos.x.add(0.2)).add(pos.y.mul(pos.y).mul(3.0)).add(pos.z.mul(pos.z));
                const inSpot = spotDist.lessThan(0.12);
                neptuneColor = select(inSpot, mix(neptuneColor, darkSpot, float(0.6)), neptuneColor);
                
                // Bright clouds - more prominent
                const cloudMask = detail.step(0.72).mul(medStorm.step(0.68));
                neptuneColor = mix(neptuneColor, stormWhite, cloudMask.mul(0.6));
                
                // Fine texture
                neptuneColor = mix(neptuneColor, neptuneColor.mul(0.92), fineDetail.step(0.55).mul(0.12));
                
                // Enhanced bright blue atmosphere
                const atmosColor = vec3(0.55, 0.75, 1.0);
                neptuneColor = neptuneColor.add(atmosColor.mul(fresnel.pow(1.2)).mul(0.5));
                
                material.colorNode = neptuneColor;
                material.roughness = 0.32;
                material.metalnessNode = float(0.0);
                break;
            }
            
            default: {
                material.colorNode = vec3(0.5, 0.5, 0.5);
                material.roughness = 0.6;
            }
        }
        
        return material;
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { alpha: true });
        canvas.width = 128;
        canvas.height = 128;
        
        // Clear to transparent first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 200, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 150, 50, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 0, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.premultiplyAlpha = false;
        texture.needsUpdate = true;
        return texture;
    }

    async init() {
        // 1. Renderer
        this.renderer = new WebGPURenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setAnimationLoop(this.animate.bind(this));
        
        // Tone Mapping
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;

        // 2. Scene & Camera
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x030812); // Rich deep space blue

        // Enhanced Starfield with varying sizes and colors
        const starGeo = new THREE.BufferGeometry();
        const starCount = 8000;
        const starPos = new Float32Array(starCount * 3);
        const starSizes = new Float32Array(starCount);
        const starColors = new Float32Array(starCount * 3);
        
        for(let i=0; i<starCount; i++) {
            // Position
            starPos[i * 3] = (Math.random() - 0.5) * 1000;
            starPos[i * 3 + 1] = (Math.random() - 0.5) * 1000;
            starPos[i * 3 + 2] = (Math.random() - 0.5) * 1000;
            
            // Size variation - most small, some larger
            starSizes[i] = Math.random() < 0.9 ? Math.random() * 0.6 + 0.3 : Math.random() * 1.5 + 0.8;
            
            // Color variation - most white, some blue, some yellow/orange
            const colorType = Math.random();
            if (colorType < 0.75) {
                // White stars
                starColors[i * 3] = 1.0;
                starColors[i * 3 + 1] = 1.0;
                starColors[i * 3 + 2] = 1.0;
            } else if (colorType < 0.9) {
                // Blue stars
                starColors[i * 3] = 0.7 + Math.random() * 0.3;
                starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
                starColors[i * 3 + 2] = 1.0;
            } else {
                // Yellow/orange stars
                starColors[i * 3] = 1.0;
                starColors[i * 3 + 1] = 0.8 + Math.random() * 0.2;
                starColors[i * 3 + 2] = 0.6 + Math.random() * 0.2;
            }
        }
        
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
        starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
        
        const starMat = new THREE.PointsMaterial({
            size: 0.7,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending
        });
        const stars = new THREE.Points(starGeo, starMat);
        this.scene.add(stars);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 60, 80);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 300;

        // 3. Enhanced Lighting for beautiful planets
        this.sunLight = new THREE.PointLight(0xfffaf0, 25, 600);
        this.sunLight.decay = 1.2;
        this.scene.add(this.sunLight);
        
        // Brighter, warmer ambient lighting for better visibility
        this.scene.add(new THREE.AmbientLight(0x909090)); 
        this.scene.add(new THREE.HemisphereLight(0xffeedd, 0x0a0a20, 0.6));
        
        // Add subtle fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0x4466aa, 0.3);
        fillLight.position.set(-50, 20, -50);
        this.scene.add(fillLight);

        // 4. Bodies Definition (with real orbital eccentricities)
        // e = eccentricity (0 = circle, closer to 1 = more elongated)
        const bodies = [
            { name: "Sun",     r: 0,    size: 5.0, color: [1.0, 0.6, 0.1], speed: 0,   e: 0 },
            { name: "Mercury", r: 10,   size: 0.4, color: [0.7, 0.7, 0.7], speed: 4.0, e: 0.206 },  // Most eccentric
            { name: "Venus",   r: 15,   size: 0.9, color: [0.9, 0.8, 0.6], speed: 3.0, e: 0.007 },  // Nearly circular
            { name: "Earth",   r: 20,   size: 1.0, color: [0.0, 0.4, 0.8], speed: 2.4, e: 0.017 },
            { name: "Mars",    r: 25,   size: 0.5, color: [1.0, 0.3, 0.2], speed: 2.0, e: 0.093 },
            { name: "Jupiter", r: 35,   size: 2.5, color: [0.8, 0.7, 0.6], speed: 1.3, e: 0.049 },
            { name: "Saturn",  r: 45,   size: 2.1, color: [0.9, 0.8, 0.5], speed: 0.9, e: 0.056 },
            { name: "Uranus",  r: 55,   size: 1.5, color: [0.6, 0.8, 0.9], speed: 0.6, e: 0.046 },
            { name: "Neptune", r: 65,   size: 1.4, color: [0.3, 0.4, 1.0], speed: 0.5, e: 0.010 }
        ];
        this.count = bodies.length;

        // 5. Create Meshes
        this.orbitLines = [];
        this.planets = [];

        for (let i = 0; i < this.count; i++) {
            const body = bodies[i];
            
            // Geometry
            const geometry = new THREE.SphereGeometry(body.size, 64, 64);
            
            // Material (Procedural TSL - Realistic)
            const material = this.createPlanetMaterial(i, body.name);
            
            const mesh = new THREE.Mesh(geometry, material);
            this.scene.add(mesh);
            
            // Sun Glow - Enhanced with multiple layers
            if (i === 0) {
                // Inner glow
                const glowTex = this.createGlowTexture();
                const glowMat = new THREE.SpriteMaterial({ 
                    map: glowTex, 
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    color: 0xffcc44,
                    opacity: 0.5,
                    depthWrite: false,
                    depthTest: false
                });
                const glowSprite = new THREE.Sprite(glowMat);
                glowSprite.scale.set(body.size * 3.0, body.size * 3.0, 1);
                glowSprite.renderOrder = -1;
                mesh.add(glowSprite);
                
                // Outer corona glow
                const outerGlowMat = new THREE.SpriteMaterial({ 
                    map: glowTex, 
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    color: 0xff6600,
                    opacity: 0.2,
                    depthWrite: false,
                    depthTest: false
                });
                const outerGlowSprite = new THREE.Sprite(outerGlowMat);
                outerGlowSprite.scale.set(body.size * 4.5, body.size * 4.5, 1);
                outerGlowSprite.renderOrder = -2;
                mesh.add(outerGlowSprite);
                
                mesh.renderOrder = 0;
            }

            // Initial Position (will be updated in animate)
            const angle = Math.random() * Math.PI * 2;
            
            // Label
            const labelTexture = this.createLabelTexture(body.name);
            const labelMaterial = new THREE.SpriteMaterial({ 
                map: labelTexture, 
                transparent: true,
                depthWrite: false,
                depthTest: true
            });
            const sprite = new THREE.Sprite(labelMaterial);
            sprite.scale.set(8, 2, 1);
            this.scene.add(sprite);

            // Store data
            this.planets.push({
                mesh: mesh,
                label: sprite,
                data: body,
                angle: angle
            });

            // Orbit Line (Elliptical - based on real eccentricity)
            if (i > 0) { // Skip Sun
                const a = body.r; // Semi-major axis
                const e = body.e || 0; // Eccentricity
                const b = a * Math.sqrt(1 - e * e); // Semi-minor axis
                const c = a * e; // Focus offset (Sun is at one focus)
                
                // Create ellipse curve
                const curve = new THREE.EllipseCurve(
                    -c, 0,  // Center offset (Sun at focus)
                    a, b,   // xRadius, yRadius
                    0, 2 * Math.PI, // Start/end angle
                    false,  // Clockwise
                    0       // Rotation
                );
                const points = curve.getPoints(128);
                const orbitGeo = new THREE.BufferGeometry().setFromPoints(points);
                const orbitMat = new THREE.LineBasicMaterial({ 
                    color: 0x6688cc, 
                    transparent: true, 
                    opacity: 0.25
                });
                const orbitLine = new THREE.Line(orbitGeo, orbitMat);
                orbitLine.rotation.x = -Math.PI / 2; // Lay flat on XZ plane
                this.scene.add(orbitLine);
                this.orbitLines.push(orbitLine);
            }
            
            // Saturn Rings
            if (body.name === "Saturn") {
                const ringGeo = new THREE.RingGeometry(body.size * 1.4, body.size * 2.3, 128);
                ringGeo.rotateX(-Math.PI / 2);
                
                // Create beautiful gradient colors for the rings
                const colors = [];
                const positions = ringGeo.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const x = positions.getX(i);
                    const y = positions.getY(i);
                    const distance = Math.sqrt(x * x + y * y);
                    const normalized = (distance - body.size * 1.4) / (body.size * 0.9);
                    
                    // Create bands with varying colors
                    const bandNoise = Math.sin(normalized * 15) * 0.5 + 0.5;
                    const r = 0.85 + bandNoise * 0.15;
                    const g = 0.75 + bandNoise * 0.15;
                    const b = 0.55 + bandNoise * 0.1;
                    colors.push(r, g, b);
                }
                ringGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
                
                const ringMat = new THREE.MeshStandardMaterial({ 
                    vertexColors: true,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.85,
                    roughness: 0.4,
                    metalness: 0.0
                });
                const ringMesh = new THREE.Mesh(ringGeo, ringMat);
                mesh.add(ringMesh); // Attach to Saturn
                // Tilt rings
                ringMesh.rotation.x = 0.4; 
            }
        }
    }

    updateInteraction(state) {
        // Handle paused state
        this.isPaused = state.isStopped;
        
        // Update Sun Light Position (Sun is always at center)
        if (this.sunLight) {
            this.sunLight.position.set(0, 0, 0);
        }
    }

    // Zoom camera in
    zoomIn() {
        const offset = this.camera.position.clone().sub(this.controls.target);
        const currentDist = offset.length();
        const newDist = Math.max(this.controls.minDistance, currentDist * 0.8);
        offset.normalize().multiplyScalar(newDist);
        this.camera.position.copy(this.controls.target).add(offset);
    }

    // Zoom camera out
    zoomOut() {
        const offset = this.camera.position.clone().sub(this.controls.target);
        const currentDist = offset.length();
        const newDist = Math.min(this.controls.maxDistance, currentDist * 1.25);
        offset.normalize().multiplyScalar(newDist);
        this.camera.position.copy(this.controls.target).add(offset);
    }

    animate() {
        this.controls.update();
        
        // Check if frozen (we need to pass this state down or check a flag)
        // Since we don't have the state directly here, let's check if targetPos is being updated
        // Actually, let's add a paused flag to the class
        if (!this.isPaused) {
            this.time += 0.01;
        }
        
        // Update Planets (CPU Kinematics for stability)
        for (let i = 0; i < this.planets.length; i++) {
            const p = this.planets[i];
            
            if (i === 0) {
                // Sun is always at center (0, 0, 0)
                p.mesh.position.set(0, 0, 0);
                
                // Update Sun Time Uniform for animation
                if (p.mesh.material.userData.timeUniform) {
                    p.mesh.material.userData.timeUniform.value = this.time;
                }
            } else {
                // Planets orbit the Sun in elliptical orbits
                // Update angle ONLY if not paused
                if (!this.isPaused) {
                    p.angle += p.data.speed * 0.005;
                    // Rotate planet on axis
                    p.mesh.rotation.y += 0.01;
                }
                
                // Elliptical orbit calculation
                const a = p.data.r; // Semi-major axis
                const e = p.data.e || 0; // Eccentricity
                const b = a * Math.sqrt(1 - e * e); // Semi-minor axis
                const c = a * e; // Focus offset
                
                // Parametric ellipse (Sun at focus, not center)
                const x = Math.cos(p.angle) * a - c;
                const z = Math.sin(p.angle) * b;
                
                p.mesh.position.set(x, 0, z);
            }
            
            // Update Label Position
            if (p.label) {
                p.label.position.copy(p.mesh.position);
                p.label.position.y += p.data.size + 2.0;
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Helper for cross product in TSL if not available (it should be)
const cross = Fn(([a, b]) => {
    return vec3(
        a.y.mul(b.z).sub(a.z.mul(b.y)),
        a.z.mul(b.x).sub(a.x.mul(b.z)),
        a.x.mul(b.y).sub(a.y.mul(b.x))
    );
});
