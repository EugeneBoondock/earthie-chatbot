import { NextResponse } from "next/server";

// USGS MRData ArcGIS Feature Service (points layer)
const USGS_ENDPOINT =
  "https://mrdata.usgs.gov/services/mrds/MapServer/0/query";

const MRDS_BBOX_URL = "https://mrdata.usgs.gov/mrds/search-bbox.php";

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
  const limitParam = searchParams.get("limit") ?? "200";

  let bbox: [number, number, number, number] | null = null;

  if (bboxParam) {
    const parts = bboxParam.split(",").map(Number);
    if (parts.length === 4 && parts.every((n) => !Number.isNaN(n))) {
      // ArcGIS expects xmin,ymin,xmax,ymax (lon/lat)
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

  return NextResponse.json({ data, sourceCount: data.length });
} 