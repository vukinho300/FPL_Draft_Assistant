"""Read only pinned workbook, CSV, SQLite and public HTML snapshots."""
from collections import Counter, defaultdict
import csv
import re
import sqlite3
from pathlib import Path
import openpyxl
from lxml import html
from .integrity import IntegrityError, number, source_id, role, season, unique


def workbook(path, expected_season, sheet='Tutti'):
    season(expected_season)
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        if sheet not in book.sheetnames:
            raise IntegrityError('Missing workbook sheet ' + sheet)
        rows = list(book[sheet].values)
        expected = expected_season[:4] + ' ' + str(int(expected_season[:4])+1)[-2:]
        if not rows or expected not in str(rows[0][0]):
            raise IntegrityError('Wrong workbook season/title')
        headers = [str(x).strip() if x is not None else '' for x in rows[1]]
        if not {'Id', 'R', 'Nome', 'Squadra'} <= set(headers):
            raise IntegrityError('Unknown workbook schema')
        if len(set(headers)) != len(headers):
            raise IntegrityError('Duplicate workbook headers')
        result = []
        for index, raw in enumerate(rows[2:], 3):
            if all(x is None for x in raw):
                continue
            row = dict(zip(headers, raw))
            row['Id'] = source_id(row['Id'])
            row['_row'] = index
            role(row['R'])
            if not row['Nome'] or not row['Squadra']:
                raise IntegrityError('Missing workbook identity')
            result.append(row)
        return result, {'sheets': book.sheetnames, 'sheet': sheet, 'fields': headers,
                        'row_count': len(result), 'title': str(rows[0][0])}
    finally:
        book.close()


def fc_statistics(rows, season_name, source_ref, observed_at):
    result = []
    fields = {'Pv': 'PV', 'Mv': 'MV', 'Fm': 'FM', 'Gf': 'goals', 'Gs': 'goals_conceded',
              'Rp': 'penalties_saved', 'Rc': 'penalties_taken', 'R+': 'penalties_scored',
              'R-': 'penalties_missed', 'Ass': 'assists', 'Amm': 'yellow_cards',
              'Esp': 'red_cards', 'Au': 'own_goals'}
    for raw in rows:
        row = {'fantacalcioId': raw['Id'], 'season': season_name, 'displayName': raw['Nome'],
               'club': raw['Squadra'], 'role': role(raw['R']), 'source_ref': source_ref,
               'observed_at': observed_at, 'competition': 'IT_SERIE_A',
               'club_scope': 'SOURCE_SEASON_LABEL_NOT_STINT',
               'statistics_scope': 'PLAYER_SEASON_TOTAL'}
        for src, dest in fields.items():
            row[dest] = number(raw.get(src), integer=dest not in {'MV', 'FM'}, nonnegative=dest != 'FM')
        row['raw_MV'] = row['MV']
        row['raw_FM'] = row['FM']
        if row['PV'] == 0:
            if row['MV'] not in (None, 0) or row['FM'] not in (None, 0):
                raise IntegrityError('Nonzero mean with zero rated appearances')
            row['MV'] = row['FM'] = None
            row['rating_missing_reason'] = 'NO_APPEARANCE'
        else:
            row['rating_missing_reason'] = None
        result.append(row)
    return result


def fc_page(path, kind, expected_season):
    tree = html.fromstring(Path(path).read_bytes())
    # Verify the displayed selected season, not any year occurring in the navigation.
    selected = [' '.join(x.itertext()).strip() for x in tree.xpath('//select//option[@selected]')]
    title = ' '.join(tree.xpath('//title/text()'))
    if not any(expected_season in x for x in selected) and expected_season not in title:
        raise IntegrityError(f'Cannot verify current HTML season: {selected}, {title}')
    rows = []
    for tr in tree.xpath('//tr[contains(concat(" ",normalize-space(@class)," ")," player-row ")]'):
        links = tr.xpath('.//a[contains(@class,"player-link")]')
        if len(links) != 1:
            raise IntegrityError('Ambiguous player link')
        link = links[0]
        parts = link.get('href').rstrip('/').split('/')
        ident = source_id(parts[-1])
        row = {'Id': ident, 'R': tr.get('data-filter-role-classic', '').upper(),
               'Nome': ' '.join(link.itertext()).strip(), 'Squadra': parts[-3].replace('-', ' ').title(),
               'club_slug': parts[-3], 'club_source_id': source_id(tr.get('data-filter-team-id')),
               'url': link.get('href'),
               # Statistics includes departed players but does not carry the quotation-list marker.
               'out_of_list': bool(tr.xpath('.//span[contains(@class,"out-of-game")]')) if kind == 'quotes' else None}
        cells = {x.get('data-col-key'): ' '.join(x.itertext()).strip() for x in tr.xpath('./td[@data-col-key]')}
        if kind == 'quotes':
            for a, b in [('c_qi','Qt.I'), ('c_qa','Qt.A'), ('c_fvm','FVM')]:
                row[b] = number(cells.get(a))
        elif kind == 'stats':
            for a,b in [('pg','Pv'),('mv','Mv'),('mfv','Fm'),('gol','Gf'),('gs','Gs'),
                        ('rp','Rp'),('ass','Ass'),('amm','Amm'),('esp','Esp')]:
                row[b] = number(cells.get(a), integer=a not in {'mv','mfv'}, nonnegative=a != 'mfv')
            pen = cells.get('rig','').split('/')
            if len(pen) != 2:
                raise IntegrityError('Unknown penalty display')
            row['R+'], row['Rc'] = [number(x, integer=True) for x in pen]
            row['R-'] = row['Rc'] - row['R+'] if None not in (row['Rc'],row['R+']) else None
            row['Au'] = None  # Not in this page; do not invent zero.
        else:
            raise IntegrityError('Unknown page type')
        role(row['R'])
        rows.append(row)
    if not rows:
        raise IntegrityError('No player records')
    unique(rows, ['Id'])
    return rows, {'row_count': len(rows), 'fields': sorted(rows[0]), 'selected_season': selected,
                  'title': title, 'html_player_table_count': len(tree.xpath('//table[.//tr[contains(@class,"player-row")]]'))}


def advanced_csv(path, expected_season):
    with open(path, encoding='utf-8-sig', newline='') as handle:
        raw = list(csv.reader(handle))
    header_index = next((i for i,r in enumerate(raw) if r and r[0] == 'Rk'), None)
    if header_index is None:
        raise IntegrityError('Missing advanced CSV header')
    counts = Counter()
    headers = []
    for key in raw[header_index]:
        counts[key] += 1
        headers.append(f'{key}#{counts[key]}')
    rows, ignored = [], []
    footer = ''
    for line, values in enumerate(raw[header_index+1:], header_index+2):
        if not values or not any(v.strip() for v in values):
            continue
        if values[0].startswith('Provided by '):
            footer = ','.join(values)
            ignored.append({'line': line, 'reason': 'ATTRIBUTION_FOOTER'})
            continue
        if values[0] == 'Rk':
            ignored.append({'line': line, 'reason': 'REPEATED_HEADER'})
            continue
        if len(values) != len(headers):
            raise IntegrityError(f'CSV field count mismatch at {line}')
        row = dict(zip(headers, values))
        ident = row.get('-9999#1', '')
        if not re.fullmatch(r'[a-f0-9]{8}', ident):
            raise IntegrityError('Invalid Sports Reference ID')
        result = {'source_player_id': ident, 'season': expected_season,
                  'displayName': row['Player#1'], 'club': row['Squad#1'],
                  'position': row.get('Pos#1'), 'source_row': line}
        for a,b in [('MP#1','appearances'),('Starts#1','starts'),('Min#1','minutes'),
                    ('Gls#1','goals'),('Ast#1','assists'),('Sh#1','shots'),('SoT#1','shots_on_target'),
                    ('PK#1','penalties_scored'),('PKatt#1','penalties_taken'),
                    ('CrdY#1','yellow_cards'),('CrdR#1','red_cards')]:
            value = row.get(a)
            if a == 'Min#1' and value and re.fullmatch(r'\d{1,3}(,\d{3})+', value):
                value = value.replace(',', '')
            result[b] = number(value, integer=True)
        rows.append(result)
    long_season = expected_season[:4] + '-' + str(int(expected_season[:4])+1)
    if 'fbref.com/en/comps/11/' not in footer:
        raise IntegrityError('Competition attribution is not Serie A')
    historical_urls = re.findall(r'/comps/11/(20\d{2}-20\d{2})/', footer)
    if historical_urls and set(historical_urls) != {long_season}:
        raise IntegrityError('Advanced CSV season mismatch')
    return rows, {'row_count': len(rows), 'fields': headers, 'footer': footer, 'ignored_rows': ignored,
                  'season_verification': 'FOOTER_URL' if historical_urls else 'PATH_AND_CURRENT_SOURCE_URL'}


def sqlite_inventory(path):
    conn = sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro', uri=True)
    result = {'integrity_check': conn.execute('PRAGMA integrity_check').fetchone()[0], 'tables': {}}
    try:
        for name, sql in conn.execute("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name"):
            quoted = '"' + name.replace('"','""') + '"'
            fields = conn.execute('PRAGMA table_info('+quoted+')').fetchall()
            item = {'schema': sql, 'fields': [x[1] for x in fields],
                    'row_count': conn.execute('SELECT count(*) FROM '+quoted).fetchone()[0]}
            if 'stagione' in item['fields']:
                item['seasons'] = dict(conn.execute('SELECT stagione,count(*) FROM '+quoted+' GROUP BY stagione'))
            if 'aggiornato_il' in item['fields']:
                item['timestamp_range'] = conn.execute('SELECT min(aggiornato_il),max(aggiornato_il) FROM '+quoted).fetchone()
            result['tables'][name] = item
        result['missing_canonical_tables'] = sorted({'giocatori','statistiche_fanta','quotazioni_fanta','collegamenti_fbref'}-result['tables'].keys())
        result['decision'] = 'AUDIT_ONLY_NO_FANTACALCIO_CROSSWALK'
        return result
    finally:
        conn.close()
