#!/usr/bin/env python3
"""Build distributable and updater assets from the same complete source tree."""
import base64,hashlib,json,re,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ext=root/'Transferify'
version=re.search(r'ExtensionBundleVersion="([0-9.]+)"',(ext/'CSXS/manifest.xml').read_text()).group(1)
files=sorted(p for p in ext.rglob('*') if p.is_file() and not any(x.startswith('.') or x=='__MACOSX' for x in p.relative_to(ext).parts))
out=root/'dist';out.mkdir(exist_ok=True)
archive=out/f'Transferify_{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in files:z.write(p,'Transferify/'+p.relative_to(ext).as_posix())
payload={'format':1,'version':version,'files':[]}
for p in files:
 b=p.read_bytes();payload['files'].append({'path':p.relative_to(ext).as_posix(),'sha256':hashlib.sha256(b).hexdigest(),'data':base64.b64encode(b).decode('ascii')})
update=out/'transferify-update.json';update.write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in [archive,update]))
print(f'Built {version}: {len(files)} files; ZIP {archive.stat().st_size} bytes; update {update.stat().st_size} bytes.')
