"""Package only this curated public design handoff; excludes secrets and runtime output."""
from pathlib import Path
import hashlib,json,zipfile
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
NAME='FirstCustomer-Office-UIUX-Handoff-2026-11-08'
SKIP={'output','__pycache__','node_modules','tmp'}
def selected():
    return sorted(p for p in ROOT.rglob('*') if p.is_file() and not any(s.startswith('.') or s in SKIP for s in p.relative_to(ROOT).parts) and p.name!='manifest.json')
files=[]
for p in selected():
    rel=p.relative_to(ROOT).as_posix()
    if p.name.startswith('.env') or p.suffix in {'.pem','.key','.sqlite','.sql'}:raise ValueError('Unexpected private/runtime file: '+rel)
    item={'path':rel,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    if p.suffix.lower() in {'.png','.webp'}:
        with Image.open(p) as im:item['pixels']={'width':im.width,'height':im.height}
    files.append(item)
source=json.loads((ROOT/'content.zh-en.json').read_text())['meta']
manifest={'schemaVersion':1,'date':'2026-11-08','source':source,'note':'This manifest excludes itself. ZIP checksum is supplied beside the archive. Output/cache/environment files are excluded.','files':files,'fileCount':len(files),'totalBytes':sum(x['bytes'] for x in files)}
(ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
archive=ROOT.parent/(NAME+'.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted([ROOT/x['path'] for x in files]+[ROOT/'manifest.json']):
        info=zipfile.ZipInfo(NAME+'/'+p.relative_to(ROOT).as_posix(),date_time=(2026,11,8,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
        z.writestr(info,p.read_bytes())
digest=hashlib.sha256(archive.read_bytes()).hexdigest()
archive.with_suffix('.zip.sha256').write_text(digest+'  '+archive.name+'\n')
print(json.dumps({'files':len(files)+1,'zip':str(archive),'bytes':archive.stat().st_size,'sha256':digest}))
