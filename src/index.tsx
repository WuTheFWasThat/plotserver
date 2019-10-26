import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { PatternInfo, parse_query_string } from './Utils';

let SERVER: string = process.env.REACT_APP_SERVER_ADDRESS || "";
let dev_mode = process.env.NODE_ENV === 'development';
let serverless = dev_mode && (!SERVER);
console.log("dev mode?", dev_mode, "serverless?", serverless, "server:", SERVER);

async function render() {
  const query_dict = parse_query_string();

  async function fetch_data(pattern_infos: Array<PatternInfo>) {
    let result: any;
    if (serverless) {
      result = {
        'baseline:s1': [
          {'step': 0, 'valid_acc': 5, 'train_acc': 3, },
          {'step': 1, 'valid_acc': 2, 'train_acc': 1.5, },
          {'step': 3, 'valid_acc': 4, 'train_acc': 1, },
        ],
        'baseline:s2': [
          {'step': 0, 'valid_acc': 6, 'train_acc': 4},
          {'step': 1, 'valid_acc': 3, 'train_acc': 2},
          {'step': 3, 'valid_acc': 5, 'train_acc': 0.5, },
        ],
        'change:s1': [
          {'step': 0, 'valid_acc': 4, 'train_acc': 1, },
          {'step': 1, 'valid_acc': 1, 'train_acc': 2, },
          {'step': 2, 'valid_acc': 2, 'train_acc': 1, },
        ],
        'change:s2': [
          {'step': 0, 'valid_acc': 4.5, 'train_acc': 2},
          {'step': 1, 'valid_acc': 2, 'train_acc': 1},
          {'step': 2, 'valid_acc': 1, 'train_acc': 0, },
        ],
      };
    } else {
      try {
        const response = await fetch(SERVER + '/plot_data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: JSON.stringify({
            pattern_infos: pattern_infos,
          }),
        });
        result = (await response.json()).result;
      } catch (e) {
        alert(e);
        throw e
      }
    }
    return {
      id: Math.random(),
      runs: result,
    };
  }

  async function get_default_pattern_infos(): Promise<Array<PatternInfo>> {
    let result: Array<PatternInfo>;
    if (serverless) {
      result = [
        {name: 'baseline', pattern: 'gs://data-bucket/results/baseline/s*/log.jsonl'},
        {name: 'change', pattern: 'gs://data-bucket/results/exp1/s*/log.jsonl'},
      ];
    } else {
      if (query_dict.pattern_infos) {
        return JSON.parse(query_dict.pattern_infos);
      }
      try {
        const response = await fetch(SERVER + '/default_pattern_infos');
        result = (await response.json()).result;
      } catch (e) {
        alert(e);
        throw e
      }
    }
    return result;
  }

  async function fetch_and_rerender(pattern_infos: Array<PatternInfo>) {
    const data = await fetch_data(pattern_infos);
    ReactDOM.render(
      React.createElement(App, {
        all_data: data,
        update_pattern_infos: fetch_and_rerender,
        pattern_infos: pattern_infos,
      }),
      document.getElementById('main')
    );
  }

  const pattern_infos = await get_default_pattern_infos();
  await fetch_and_rerender(pattern_infos);
}

render();
