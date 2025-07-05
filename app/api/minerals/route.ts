import { NextResponse } from "next/server";
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

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
    const deg = radiusM / 111_000;
    bbox = [lon - deg, lat - deg, lon + deg, lat + deg];
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

  // Only use local data
  const localData = loadLocal();
  // Filter by bbox
  const filtered = localData.filter((d) => {
    if (!bbox) return true;
    return (
      d.longitude >= bbox[0] && d.longitude <= bbox[2] &&
      d.latitude >= bbox[1] && d.latitude <= bbox[3]
    );
  });
  return NextResponse.json({ data: filtered.slice(0, Number(limitParam)) });
} 