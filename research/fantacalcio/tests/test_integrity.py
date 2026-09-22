"""Synthetic malformed inputs plus optional pinned-real-source integration checks."""
import json
import os
from pathlib import Path
import tempfile
import unittest

from research.fantacalcio.pipeline.integrity import (
    IntegrityError, number, source_id, canonical_id, role, season, duplicates, left_join,
    validate_current, validate_stats, aggregate_stints, fixture_audit, classify_field,
    assert_feature_fields, split_overlap, score, readiness, WEIGHTS, sha256,
)
from research.fantacalcio.pipeline.adapters import workbook, fc_statistics, advanced_csv, fc_page
from research.fantacalcio.pipeline.release import build, write_immutable


class IntegrityTests(unittest.TestCase):
    def test_roles(self):
        self.assertEqual([role(x) for x in ['P','D','C','A']],['POR','DIF','CEN','ATT'])
        with self.assertRaises(IntegrityError): role('FW')

    def test_numeric_missing_zero_invalid(self):
        self.assertIsNone(number(''))
        self.assertEqual(number('0',integer=True),0)
        self.assertEqual(number('6,25'),6.25)
        for value in ['garbage','NaN','inf',-1,True,'1,234.0']:
            with self.subTest(value=value), self.assertRaises(IntegrityError): number(value)
        with self.assertRaises(IntegrityError): number('1.5',integer=True)

    def test_source_id_and_stable_canonical_identity(self):
        self.assertEqual(canonical_id('254'),canonical_id(254.0))
        self.assertNotEqual(canonical_id(254),canonical_id(255))
        for value in [None,'',0,-2]:
            with self.assertRaises(IntegrityError): source_id(value)

    def test_duplicate_records_are_not_dropped(self):
        rows=[{'id':'1','season':'2025/26'},{'id':'1','season':'2025/26'}]
        result=duplicates(rows,['id','season'])
        self.assertEqual(result[0]['affected_rows'],[0,1])
        self.assertEqual(result[0]['resolution'],'UNRESOLVED')

    def test_join_explosion_even_identical_right_rows_rejected(self):
        with self.assertRaises(IntegrityError):
            left_join([{'id':'1'}],[{'id':'1'},{'id':'1'}],['id'],name='bad')
        pairs,check=left_join([{'id':'1'},{'id':'2'}],[{'id':'1','v':7}],['id'],name='ok')
        self.assertEqual(check['after'],2)
        self.assertIsNone(pairs[1][1])

    def test_current_critical_fields_and_wrong_competition(self):
        row={'playerRef':'fantacalcio:fc:1','fantacalcioId':'1','displayName':'Synthetic',
             'normalizedName':'synthetic','club':'Test','role':'POR','eligibility':'SELECTABLE',
             'source_ref':'fixture','season':'2026/27','competition':'IT_SERIE_A'}
        self.assertEqual(validate_current([row],'2026/27'),[])
        for field in ['role','club','eligibility','displayName']:
            self.assertTrue(validate_current([{**row,field:None}],'2026/27'))
        self.assertTrue(validate_current([{**row,'season':'2025/26'}],'2026/27'))
        self.assertTrue(validate_current([{**row,'competition':'EN_PL'}],'2026/27'))

    def test_wrong_season_rejected(self):
        for token in ['2026/26','2026','2026/2027','1899/00']:
            with self.assertRaises(IntegrityError): season(token)

    def test_values(self):
        self.assertIn('starts>appearances',validate_stats({'starts':3,'appearances':2}))
        self.assertTrue(validate_stats({'minutes':-1,'MV':11,'PV':39}))

    def test_transfer_stints_no_double_count(self):
        rows=[{'source_player_id':'x','season':'2025/26','club':'A','minutes':100},
              {'source_player_id':'x','season':'2025/26','club':'B','minutes':200},
              {'source_player_id':'x','season':'2025/26','club':'2 squads','minutes':300}]
        values,method=aggregate_stints(rows,['minutes'])
        self.assertEqual(values['minutes'],300)
        self.assertEqual(method,'SELECT_VERIFIED_TOTAL')
        rows[-1]['minutes']=301
        with self.assertRaises(IntegrityError): aggregate_stints(rows,['minutes'])
        with self.assertRaises(IntegrityError): aggregate_stints([rows[0],rows[0]],['minutes'])

    def test_transfer_null_not_zero(self):
        rows=[{'source_player_id':'x','season':'2025/26','club':'A','minutes':None},
              {'source_player_id':'x','season':'2025/26','club':'B','minutes':20}]
        self.assertIsNone(aggregate_stints(rows,['minutes'])[0]['minutes'])

    def test_fixture_coverage_applicability_and_duplicates(self):
        self.assertIsNone(fixture_audit([],[],0,aggregate_source=True)['coverage_pct'])
        f={'season':'2025/26','fixture_id':'x','home':'A','away':'B'}
        result=fixture_audit([f,f],['A','B'],2)
        self.assertEqual(result['duplicates'],1)
        self.assertEqual(result['missing'],1)

    def test_leakage_classifier_requires_known_time(self):
        base=dict(source_season='2023/24',target_season='2024/25',cutoff='2024-06-30T23:59:59+00:00')
        self.assertEqual(classify_field('MV',available_at='2024-06-01T00:00:00+00:00',**base),'BACKTEST_SAFE')
        self.assertEqual(classify_field('MV',available_at='2026-09-01T00:00:00+00:00',**base),'UNSAFE')
        self.assertEqual(classify_field('MV',available_at=None,**base),'UNSAFE')
        self.assertEqual(classify_field('MV',available_at=None,target=True,**base),'TARGET_ONLY')
        self.assertEqual(classify_field('injury',available_at='2024-06-01T00:00:00+00:00',current_only=True,**base),'CURRENT_ONLY')

    def test_same_target_season_is_not_lagged_history(self):
        self.assertEqual(classify_field('FM',source_season='2024/25',target_season='2024/25',
            available_at='2024-01-01T00:00:00+00:00',cutoff='2024-08-01T00:00:00+00:00'),'UNSAFE')

    def test_target_denylist(self):
        for field in ['future_fm','target_fm','future_transfer','post_target_aggregate','Future_FM','target_FM']:
            with self.assertRaises(IntegrityError): assert_feature_fields(['historical_MV',field])
        assert_feature_fields(['historical_MV','historical_FM'])

    def test_split_overlap_including_duplicate_same_split(self):
        self.assertEqual(len(split_overlap({'train':['a'],'holdout':['a']})),1)
        self.assertEqual(len(split_overlap({'train':['a','a']})),1)
        self.assertEqual(split_overlap({'train':['p:2023'],'holdout':['p:2025']}),[])

    def test_scoring_and_hard_failure_override(self):
        metrics={k:{'pass':1.0} for k in WEIGHTS}
        components,total=score(metrics)
        self.assertEqual(total,100)
        self.assertEqual(components,WEIGHTS)
        self.assertFalse(readiness(True,100,['failure'],0,0,0)['MODEL_READY'])
        self.assertFalse(readiness(True,100,[],1,0,0)['MODEL_READY'])
        self.assertFalse(readiness(True,89.99,[],0,0,0)['MODEL_READY'])
        self.assertTrue(readiness(True,90,[],0,0,0)['MODEL_READY'])
        metrics['coverage']={'half':0.5}
        self.assertEqual(score(metrics)[1],90)

    def test_no_appearance_ratings_not_zero_ability(self):
        raw=[{'Id':'1','Nome':'Synthetic','Squadra':'Test','R':'P','Pv':0,'Mv':0,'Fm':0}]
        r=fc_statistics(raw,'2025/26','test','2026-09-01T00:00:00+00:00')[0]
        self.assertIsNone(r['MV']); self.assertEqual(r['raw_MV'],0)
        self.assertEqual(r['rating_missing_reason'],'NO_APPEARANCE')
        raw[0]['Mv']=6
        with self.assertRaises(IntegrityError): fc_statistics(raw,'2025/26','test','2026-09-01T00:00:00+00:00')

    def test_immutable_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/'release'
            write_immutable(dest,{'x.csv':b'example\n'})
            write_immutable(dest,{'x.csv':b'example\n'})
            with self.assertRaises(IntegrityError): write_immutable(dest,{'x.csv':b'changed\n'})

    def test_negative_fantasy_average_is_valid_not_a_negative_count(self):
        raw=[{'Id':'1','Nome':'Synthetic','Squadra':'Test','R':'P','Pv':1,'Mv':3,'Fm':-1}]
        row=fc_statistics(raw,'2025/26','test','2026-09-01T00:00:00+00:00')[0]
        self.assertEqual(row['FM'],-1)
        self.assertEqual(validate_stats(row),[])
        self.assertEqual(row['statistics_scope'],'PLAYER_SEASON_TOTAL')
        raw[0]['Pv']=-1
        with self.assertRaises(IntegrityError): fc_statistics(raw,'2025/26','test','2026-09-01T00:00:00+00:00')


@unittest.skipUnless(os.environ.get('FD2_SOURCE_ROOT') and os.environ.get('FD2_SNAPSHOT_ROOT'),
                     'Pinned local source fixtures not configured')
class RealSourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source=Path(os.environ['FD2_SOURCE_ROOT'])
        cls.snapshots=Path(os.environ['FD2_SNAPSHOT_ROOT'])

    def test_real_workbook_and_wrong_title(self):
        path=self.source/'quotazioni/Quotazioni_Fantacalcio_Stagione_2026_27.xlsx'
        rows,meta=workbook(path,'2026/27')
        self.assertEqual(len(rows),527)
        self.assertEqual(len({r['Id'] for r in rows}),527)
        self.assertIn('Ceduti',meta['sheets'])
        with self.assertRaises(IntegrityError): workbook(path,'2025/26')

    def test_real_advanced_duplicate_headers_and_transfer_grain(self):
        rows,meta=advanced_csv(self.source/'statistiche_avanzate/2025_2026/standard_stats.csv','2025/26')
        self.assertEqual(len(rows),609)
        self.assertIn('Gls#1',meta['fields']); self.assertIn('Gls#2',meta['fields'])
        self.assertEqual(len(duplicates(rows,['source_player_id','season'])),23)
        self.assertEqual(duplicates(rows,['source_player_id','season','club']),[])
        with self.assertRaises(IntegrityError): advanced_csv(self.source/'statistiche_avanzate/2025_2026/standard_stats.csv','2024/25')

    def test_real_live_excluded_players(self):
        index=json.loads((self.snapshots/'index.json').read_text())
        path=self.snapshots/next(x['path'] for x in index if x['source_name']=='fc_quotes')
        rows,_=fc_page(path,'quotes','2026/27')
        self.assertEqual(len(rows),597)
        self.assertEqual(sum(not r['out_of_list'] for r in rows),534)
        stats_path=self.snapshots/next(x['path'] for x in index if x['source_name']=='fc_stats')
        stats,_=fc_page(stats_path,'stats','2026/27')
        self.assertTrue(all(r['out_of_list'] is None for r in stats))
        with self.assertRaises(IntegrityError): fc_page(path,'quotes','2025/26')

    def test_snapshot_metadata_tampering_rejected_before_ingestion(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'index.json').write_text('[]',encoding='utf-8')
            with self.assertRaisesRegex(IntegrityError,'Snapshot index metadata'):
                build(self.source,root)

    def test_complete_release_deterministic_and_fail_closed(self):
        a,report=build(self.source,self.snapshots)
        b,second=build(self.source,self.snapshots)
        self.assertEqual(a,b); self.assertEqual(report,second)
        self.assertTrue(report['AUCTION_POOL_READY'])
        self.assertFalse(report['MODEL_READY'])
        self.assertGreater(report['temporal_rejected_candidates'],0)
        self.assertEqual(report['admitted_temporal_violations'],0)
        self.assertEqual(report['target_leakage_violations'],0)
        self.assertEqual(report['split_overlap_violations'],0)
        self.assertTrue(all(r['left_before']==r['after'] for r in report['join_cardinality_checks']))
        for file,digest in json.loads(a['release_checksums.json']).items():
            self.assertEqual(sha256(a[file]),digest)


if __name__=='__main__':
    unittest.main()
