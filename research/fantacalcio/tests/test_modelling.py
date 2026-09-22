"""Synthetic invariants only; these rows never enter a model release."""
import copy
import csv
import json
from pathlib import Path
import tempfile
import unittest
import numpy as np

from research.fantacalcio.modelling.core import (
    FIELDS, event_features, vector, samples, fit, predict, current_update, metrics)
from research.fantacalcio.modelling.experiment import read_rows, select_models, protocol, forecast
from research.fantacalcio.pipeline.integrity import IntegrityError


def synthetic_row(ident, season='2023/24', pv=20):
    return {**{field:0.0 for field in FIELDS},'PV':pv,'goals':3.0,
        'playerRef':f'synthetic:{ident}','season':season,'FM':6.4,'MV':6.0,
        'observed_at':'2026-09-01T14:59:20+00:00','statistics_scope':'PLAYER_SEASON_TOTAL'}


class ModelSafetyTests(unittest.TestCase):
    def test_forbidden_fields_cannot_change_features(self):
        row=synthetic_row(1)
        original=vector(event_features(row))
        row.update(FM=999,MV=-999,FVM=999999,quotation=1000,role='ATT',club='Future Club',injury='future')
        self.assertEqual(original,vector(event_features(row)))
        bad=event_features(row); bad['FM']=6.4
        with self.assertRaises(IntegrityError): vector(bad)

    def test_missing_or_invalid_events_fail(self):
        for value in [None,-1,float('nan')]:
            row=synthetic_row(1); row['goals']=value
            with self.assertRaises(IntegrityError): event_features(row)

    def test_targets_and_predictors_are_separate(self):
        prior=synthetic_row(1)
        target=synthetic_row(1,'2024/25',25); target['FM']=7.1
        first=samples([prior,target],['2024/25'])[0]
        target['FM']=8.5
        second=samples([prior,target],['2024/25'])[0]
        self.assertEqual(first['features'],second['features'])
        self.assertNotEqual(first['target_FM'],second['target_FM'])
        self.assertEqual(samples([target],['2024/25']),[])

    def test_selection_reader_does_not_parse_holdout_outcomes(self):
        with tempfile.TemporaryDirectory() as folder:
            rows=[synthetic_row(1),synthetic_row(1,'2025/26')]
            rows[1]['FM']='DO_NOT_PARSE_HOLDOUT'
            with (Path(folder)/'player_season.csv').open('w',newline='') as handle:
                writer=csv.DictWriter(handle,fieldnames=list(rows[0]))
                writer.writeheader(); writer.writerows(rows)
            result=read_rows(folder,2024)
            self.assertEqual(len(result),1)

    def test_selection_rejects_holdout_records(self):
        with self.assertRaises(IntegrityError):
            select_models([{'target_season':'2025/26'}],[],protocol())

    def test_train_scaler_and_predictions_are_deterministic(self):
        x=np.array([vector(event_features(synthetic_row(i,pv=10+i))) for i in range(12)])
        pv=np.arange(12)+9; fm=np.arange(12)*.05+6
        cfg={'name':'test','kind':'ridge','alpha':10}
        a=fit(cfg,x,pv,fm); b=fit(cfg,x,pv,fm)
        self.assertEqual(a,b)
        before=copy.deepcopy(a)
        predict(a,x*1000)
        self.assertEqual(a,before)
        np.testing.assert_array_equal(predict(a,x)[0],predict(b,x)[0])

    def test_current_update_missing_and_zero_are_distinct(self):
        zero=current_update(20,6.4,{'PV':0,'FM':None},5,10,15)
        self.assertEqual(zero['expected_FM'],6.4)
        self.assertEqual(zero['production_current_weight'],0)
        with self.assertRaises(IntegrityError): current_update(20,6.4,{'PV':2,'FM':None},5,10,15)
        with self.assertRaises(IntegrityError): current_update(20,6.4,{'PV':6,'FM':7},5,10,15)
        with self.assertRaises(IntegrityError): current_update(20,6.4,{'PV':2,'FM':7},39,10,15)

    def test_current_update_weights_follow_evidence(self):
        a=current_update(20,6,{'PV':1,'FM':8},5,10,15)
        b=current_update(20,6,{'PV':5,'FM':8},5,10,15)
        self.assertGreater(b['production_current_weight'],a['production_current_weight'])
        self.assertGreater(b['expected_remaining_PV'],a['expected_remaining_PV'])
        self.assertLess(b['expected_FM'],8)

    def test_zero_target_appearances_are_zero_total_not_missing(self):
        result=metrics(np.array([0.,20.]),np.array([np.nan,6.]),
                       (np.array([0.,20.]),np.array([6.,6.])))
        self.assertEqual(result['total_proxy_mae'],0)
        self.assertEqual(result['rated_n'],1)

    def test_all_player_forecast_and_market_benchmark_invariance(self):
        cfg=protocol()
        pool=[{'playerRef':f'synthetic:{i}','displayName':f'Synthetic {i}',
            'club':'Synthetic','role':['POR','DIF','CEN','ATT'][i%4],
            'FVM':'1','quotation':'1'} for i in range(534)]
        live=[synthetic_row(i,'2026/27',i%6) for i in range(534)]
        selected={'current_update_strengths':{'availability_equivalent_matches':10,
            'production_equivalent_rated_appearances':15},'validation_absolute_error_q80':30}
        model={'mean_target_PV':20,'mean_target_FM':6.3}
        first=forecast(model,live,pool,cfg,selected)
        for row in pool: row['FVM']='999999'; row['quotation']='9999'
        second=forecast(model,live,pool,cfg,selected)
        self.assertEqual([r['projection'] for r in first],[r['projection'] for r in second])
        self.assertEqual({r['overall_rank'] for r in first},set(range(1,535)))
        self.assertEqual(len({r['playerRef'] for r in first}),534)
        self.assertTrue(all(np.isfinite(r['projection']) for r in first))
        self.assertTrue(all(r['confidence']=='LOW' for r in first))


if __name__=='__main__':
    unittest.main()
