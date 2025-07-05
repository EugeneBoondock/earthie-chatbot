import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

// USGS MRData ArcGIS Feature Service (points layer)
const USGS_ENDPOINT =
  "https://mrdata.usgs.gov/services/mrds/MapServer/0/query";

const MRDS_BBOX_URL = "https://mrdata.usgs.gov/mrds/search-bbox.php";

const commodityAbbreviationMap: { [key: string]: string } = {
  "Al": "Aluminum",
  "Ag": "Silver",
  "Au": "Gold",
  "B": "Boron",
  "Be": "Beryllium",
  "Co": "Cobalt",
  "Cr": "Chromium",
  "Cu": "Copper",
  "Fe": "Iron",
  "K": "Potassium",
  "Li": "Lithium",
  "Mo": "Molybdenum",
  "Nb": "Niobium",
  "Ni": "Nickel",
  "P": "Phosphorus",
  "Pb": "Lead",
  "REE": "Rare-earth elements",
  "S": "Sulfur",
  "Sn": "Tin",
  "Ta": "Tantalum",
  "Ti": "Titanium",
  "U": "Uranium",
  "Zn": "Zinc",
  "Zr": "Zirconium"
};

type Reference = {
  text: string;
  link: string | null;
}

/*
  Supported query params:
  - lat, lon  : centre coordinate (decimal degrees)
  - radius    : search radius in metres (default 10000)
  - bbox      : south,west,north,east (comma-separated) overrides lat/lon
  - limit     : max returned features (default 200)
*/
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const bboxParam = searchParams.get("bbox");
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");
  const radiusParam = searchParams.get("radius");
  const limitParam = searchParams.get("limit") ?? "5000";

  let bbox: [number, number, number, number] | null = null;

  if (bboxParam) {
    const parts = bboxParam.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      // LeafletJS uses south,west,north,east (lat/lon)
      // we need xmin,ymin,xmax,ymax (lon/lat)
      bbox = [parts[1], parts[0], parts[3], parts[2]];
    } else {
      return NextResponse.json(
        { error: "bbox must be south,west,north,east" },
        { status: 400 }
      );
    }
  } else {
    if (!latParam || !lonParam) {
      return NextResponse.json(
        { error: "lat and lon query parameters are required if bbox is not provided" },
        { status: 400 }
      );
    }
    const lat = Number(latParam);
    const lon = Number(lonParam);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return NextResponse.json(
        { error: "lat and lon must be valid numbers" },
        { status: 400 }
      );
    }
    const radiusM = Number(radiusParam ?? 10000);
    const deg = radiusM / 111_000; // approximate metres to degrees conversion
    bbox = [lon - deg, lat - deg, lon + deg, lat + deg];
  }

  const outFields = [
    "siteid",
    "sitename",
    "commod1",
    "commod2",
    "commod3",
    "lat",
    "long_",
    "hostrck",
    "deposit",
    "status",
  ].join(",");

  const qs = new URLSearchParams({
    geometry: bbox.join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    f: "pjson",
    where: "1=1",
  });

  const usgsUrl = `${USGS_ENDPOINT}?${qs.toString()}`;

  let data:any[]=[];
  try{
    const usgsRes = await fetch(usgsUrl, { next: { revalidate: 3600 } });
    if(usgsRes.ok){
      const json = await usgsRes.json();
      const featuresArr = Array.isArray(json.features)? json.features.slice(0,Number(limitParam)) : [];
      data = featuresArr.map((f:any)=>{
        const attrs=f.attributes||{}; const geom=f.geometry||{};
        return {
          id: attrs.siteid ?? attrs.OBJECTID ?? `${Math.random()}`,
          name: attrs.sitename ?? 'Unknown site',
          commodities: [attrs.commod1, attrs.commod2, attrs.commod3].filter(Boolean),
          description: attrs.deposit ?? null,
          status: attrs.status ?? null,
          coordinates:{ latitude:geom.y, longitude:geom.x },
          source:'USGS_MRDS'
        }
      });
    }
  }catch(err){
    console.warn('ArcGIS MRDS fetch failed, falling back',err);
  }

  if(data.length===0){
    // fallback MRDS bbox
    const [xmin,ymin,xmax,ymax]=bbox;
    const url=`${MRDS_BBOX_URL}?xmin=${xmin}&ymin=${ymin}&xmax=${xmax}&ymax=${ymax}&format=json`;
    try{
      const resp=await fetch(url,{ next:{ revalidate:3600 }});
      if(resp.ok){
        const j=await resp.json();
        if(Array.isArray(j)){
          data=j.slice(0,Number(limitParam)).map((r:any)=>({
            id:r.id,
            name:r.name || 'Unknown site',
            commodities:(r.commodity||'').split(';').map((c:string)=>c.trim()).filter(Boolean),
            description:r.depsummary||null,
            status:r.status||null,
            coordinates:{ latitude:Number(r.lat), longitude:Number(r.lon) },
            source:'USGS_MRDS_BBOX'
          }));
        }
      }
    }catch(err){
      console.error('MRDS bbox fallback failed',err);
    }
  }

  // ---------- Local dataset (deposit.csv) ----------
  type LocalDeposit = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    commodities: string[];
    description: string | null;
    references: Reference[];
  };

  let cachedLocal: LocalDeposit[] | null = null;
  let commodityMap: Map<string,string[]> | null = null;
  let refMap: Map<string,Reference> | null = null;

  function loadLocal(): LocalDeposit[] {
    if (cachedLocal) return cachedLocal;
    try {
      const csvPath = path.join(process.cwd(), 'public', 'data', 'minerals', 'deposit.csv');
      const raw = fs.readFileSync(csvPath, 'utf8');
      const records: any[] = parse(raw, { columns: true, skip_empty_lines: true });

      // load commodity.csv
      try{
        const comPath=path.join(process.cwd(),'public','data','minerals','commodity.csv');
        const comRaw=fs.readFileSync(comPath,'utf8');
        const comRecs:any[]=parse(comRaw,{columns:true,skip_empty_lines:true});
        commodityMap=new Map();
        comRecs.forEach(rec=>{
          const id=String(rec.gid);
          const val=(rec.value||'').trim();
          if(!val) return;
          if(!commodityMap!.has(id)) commodityMap!.set(id,[]);
          commodityMap!.get(id)!.push(val);
        });
      }catch{}

      // Load references from ref.csv
      try {
        const refPath = path.join(process.cwd(), 'public', 'data', 'minerals', 'ref.csv');
        const refRaw = fs.readFileSync(refPath, 'utf8');
        const refRecs: any[] = parse(refRaw, { columns: true, skip_empty_lines: true });
        refMap = new Map();
        refRecs.forEach(r => {
          if (r.reference && r.onlink) {
            const refId = r.reference.trim();
            const refText = r.onlink.trim();
            const refLink = refText.startsWith('http') ? refText : null;
            refMap!.set(refId, { text: refText, link: refLink });
          }
        });
      } catch (e) { console.error('Failed to load ref.csv', e); }

      cachedLocal = records.map((r) => {
        const id=String(r.gid);
        let commodities: string[] = commodityMap?.get(id) ?? (r.commodity? (r.commodity as string).split(',').map((c:string)=>c.trim()): []);
        const expandedCommodities = commodities.map(c => {
            const normalized = c.trim();
            return commodityAbbreviationMap[normalized] || normalized;
        });
        
        // Parse citation IDs and attach references
        const citation_ids = (r.citation || '').split(';').map((c: string) => c.trim()).filter(Boolean);
        const references: Reference[] = citation_ids.map((cit: string) => refMap?.get(cit)).filter(Boolean) as Reference[];

        return {
          id,
          name: r.dep_name,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          commodities: expandedCommodities,
          description: r.dep_type || null,
          references,
        };
      });
    } catch (err) {
      console.error('Failed to load local minerals CSV', err);
      cachedLocal = [];
    }
    return cachedLocal;
  }

  function haversineDistKm(lat1:number, lon1:number, lat2:number, lon2:number){
    const toRad=(d:number)=>d*Math.PI/180;
    const R=6371000; // metres
    const dLat=toRad(lat2-lat1);
    const dLon=toRad(lon2-lon1);
    const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
    const c=2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R*c; // metres
  }

  // --- Attempt LOCAL CSV first ---
  const localData = (() => {
    try {
      const deposits = loadLocal();
      if (!deposits.length) return [];

      if (bbox) {
        const [xmin, ymin, xmax, ymax] = bbox;
        return deposits.filter(d => 
          d.longitude >= xmin && d.longitude <= xmax &&
          d.latitude >= ymin && d.latitude <= ymax
        ).slice(0, Number(limitParam))
        .map((d) => ({
          id: d.id,
          name: d.name,
          commodities: d.commodities,
          description: d.description,
          coordinates: { latitude: d.latitude, longitude: d.longitude },
          references: d.references ?? [],
          source: 'USGS',
        }));
      }

      const lat = Number(latParam);
      const lon = Number(lonParam);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return [];
      }
      
      const radiusM = Number(radiusParam ?? 10000);
      const center = { lat, lon };
      const distLimit = radiusM;

      return deposits
        .filter((d) => {
          const dist = haversineDistKm(center.lat, center.lon, d.latitude, d.longitude);
          return dist <= distLimit;
        })
        .slice(0, Number(limitParam))
        .map((d) => ({
          id: d.id,
          name: d.name,
          commodities: d.commodities,
          description: d.description,
          coordinates: { latitude: d.latitude, longitude: d.longitude },
          references: d.references ?? [],
          source: 'USGS',
        }));
    } catch (err) {
      console.error('Local minerals search failed', err)
      return [];
    }
  })();

  return NextResponse.json({ data: localData });
} 