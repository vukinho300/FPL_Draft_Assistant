"""Optional bounded public-page acquisition, separate from offline release builds.

No authentication, private provider, undocumented POST, browser impersonation, or DNS override.
These audit snapshots do not establish data redistribution or product-use permission.
New acquisitions require a new input-selection pin and release review.
"""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen
from .integrity import sha256, json_bytes, IntegrityError

URLS = {
    'fc_quotes': 'https://www.fantacalcio.it/quotazioni-fantacalcio',
    'fc_stats': 'https://www.fantacalcio.it/statistiche-serie-a',
    'fpd_maignan': 'https://www.fantacalciopedia.com/lista-calciatori-serie-a/portieri/3172/maignan-mike.html',
    'fpd_injuries': 'https://www.fantacalciopedia.com/articoli-fcp/consigli-fantacalcio/75-lista-infortunati-serie-a-aggiornata.html',
    'fpd_robots': 'https://www.fantacalciopedia.com/robots.txt',
}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-root',type=Path,required=True)
    args=parser.parse_args()
    if args.output_root.exists():
        raise IntegrityError('Use a new snapshot directory; previous raw artifacts are immutable')
    args.output_root.mkdir(parents=True)
    result=[]
    for name,url in URLS.items():
        item={'source_name':name,'url':url,'retrieved_at':datetime.now(timezone.utc).isoformat()}
        try:
            with urlopen(Request(url,headers={'User-Agent':'FD2QA-Research/1.0'}),timeout=30) as response:
                payload=response.read()
                digest=sha256(payload)
                filename=name+'-'+digest[:12]+'.html'
                (args.output_root/filename).write_bytes(payload)
                item.update(status=response.status,path=filename,sha256=digest,size=len(payload))
        except Exception as error:
            item.update(error=str(error))
        result.append(item)
        print(json.dumps(item))
    (args.output_root/'index.json').write_bytes(json_bytes(result))


if __name__=='__main__':
    main()
