import React from 'react';
import './App.css';
import PlotComponent, {PlotData, PlotComponentProps, PlotGroups, DEFAULT_PLOTLY_COLORS, DASH_STYLE_CYCLE} from './Plot';
// import { debounce } from 'lodash';
import {
  parse_pattern_infos, serialize_pattern_infos, PatternInfo ,
  encode_query_params, parse_query_string,
} from './Utils';


type AppProps = {
  all_data: PlotData,
  update_pattern_infos: (pattern_infos: Array<PatternInfo>) => void,
  pattern_infos: Array<PatternInfo>,
};
type StringSet = {[k: string]: boolean};
type AppState = {
  nameRegex: string,
  groupRegex: string,
  averageRegex: string,
  default_x_key: string,
  possible_keys: StringSet,
  plot_states: Array<Partial<PlotComponentProps>>
  plot_states_str: string,
};

function get_relevant_keys(all_data: PlotData, re: string | null) {
  const possible_keys: StringSet = {};

  for (let name in all_data.runs) {
    if (re !== null && !name.match(re)) {
      console.log('didnt match ', name)
      continue;
    }
    all_data.runs[name].forEach((obj: any) => {
      for (let possible_key of Object.keys(obj)) {
        possible_keys[possible_key] = true;
      }
    });
  };
  possible_keys['index'] = true;
  console.log('possible keys', possible_keys);

  let default_x_key = 'index';
  for (let k of ['step', 'steps', 'example', 'examples', 'elapsed_steps', 'iter', 'Iter', 'Steps', 'Step', 'elapsed_tokens']) {
    if (default_x_key === 'index' && possible_keys[k]) {
      default_x_key = k;
      break;
    }
  }
  return {
    possible_keys: possible_keys,
    default_x_key: default_x_key,
  };
}


function generateDefaultPlotStates(x_key: string, possible_keys: StringSet) {
    const plot_states: Array<Partial<PlotComponentProps>> = []
    if (x_key) {
      for (let k in possible_keys) {
        if (k !== x_key && k !== 'index') {
          const plot_state = {
            y_keys: [k],
          };
          plot_states.push(plot_state);
        }
      }
    }
    return plot_states
}


type PlotStateEditorProps = {text: string, buttonText: string, onSubmit: (text: string) => void};
type PlotStateEditorState = {text: string};
class PlotStateEditor extends React.Component<PlotStateEditorProps, PlotStateEditorState> {
  constructor(props: PlotStateEditorProps) {
    super(props);
    this.state = {
      text: this.props.text
    };
  }

  handleStateChange(event: any) { // KeyboardEvent
    this.setState({ text: event.target.value });
  }

  componentDidUpdate(oldProps: PlotStateEditorProps) {
    if (oldProps.text !== this.props.text) {
      this.setState({
        text: this.props.text
      });
    }
  }

  render() {
    return (
      <div>
        <textarea value={this.state.text} onChange={this.handleStateChange.bind(this)}
          style={{width: '100%', minHeight: '200px'}}
        />
        <button onClick={this.props.onSubmit.bind(this, this.state.text)}>{this.props.buttonText || 'Submit'}</button>
      </div>
    );
  }
}

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);

    const query_dict = parse_query_string();
    const relevant_keys = get_relevant_keys(this.props.all_data, null)
    let default_x_key = query_dict.default_x_key || relevant_keys.default_x_key;

    console.log(query_dict.plot_states);
    const plot_states = query_dict.plot_states ? JSON.parse(query_dict.plot_states) : generateDefaultPlotStates(default_x_key, relevant_keys.possible_keys);
    this.state = {
      nameRegex: query_dict.nameRegex || '',
      groupRegex: query_dict.groupRegex || '',
      averageRegex: query_dict.averageRegex || '',
      possible_keys: relevant_keys.possible_keys,
      default_x_key: default_x_key,
      plot_states: plot_states,
      plot_states_str: JSON.stringify(plot_states, null, 2),
    };
    this.updateQueryParams();
  }

  componentDidUpdate(prevProps: AppProps) {
    this.updateQueryParams();
    if (this.props.all_data.id !== prevProps.all_data.id) {
      console.log('Data changed!');
      const relevant_keys = get_relevant_keys(this.props.all_data, null);
      const newState: AppState = {
        possible_keys: relevant_keys.possible_keys,
        default_x_key: this.state.default_x_key || relevant_keys.default_x_key,
      } as AppState;
      console.log('here', this.state.plot_states.length)
      if (!this.state.plot_states.length) {
        newState.plot_states = generateDefaultPlotStates(newState.default_x_key, newState.possible_keys);
        newState.plot_states_str = JSON.stringify(newState.plot_states, null, 2);
      }
      this.setState(newState as any)
    }
  }

  getGroupsInfo(nameRegex: string, groupRegex: string, averageRegex: string): {num_runs: number, groups: PlotGroups} {
    let re: RegExp;
    let gre: RegExp;
    let av_re: RegExp;
    try {
      re = new RegExp(nameRegex || '.*');
      av_re = new RegExp(averageRegex || '(.*)');
      gre = new RegExp(groupRegex || averageRegex || '(.*)');
    } catch (e) {
      console.log('ERROR', e);
      return this.getGroupsInfo('', '', '');
    }
    const groups: PlotGroups = [];

    let num_runs = 0;
    // averageKey -> groupKey -> list of runs
    const groupKeyToRuns: {[averageKey: string]: {[groupKey: string]: Array<string>}} = {};
    Object.keys(this.props.all_data.runs).forEach((run) => {
      const match = run.match(gre);
      const ave_match = run.match(av_re);
      let averageKey: string;
      if (ave_match === null) {
        averageKey = '<NOMATCH>';
      } else {
        averageKey = ave_match.slice(1).join('');
      }
      let groupKey: string;
      if (match === null) {
        groupKey = '<NOMATCH>';
      } else {
        groupKey = match.slice(1).join('');
      }
      console.log('run ', run, 'ave', averageKey, 'key', groupKey)
      groupKeyToRuns[averageKey] = groupKeyToRuns[averageKey] || {};
      groupKeyToRuns[averageKey][groupKey] = groupKeyToRuns[averageKey][groupKey] || [];
      // NOTE: make the group even if the runs don't match, so that
      // coloring is consistent
      if (!run.match(re)) {
        console.log('name key fails to match ', run, nameRegex)
        return;
      }
      num_runs++;
      groupKeyToRuns[averageKey][groupKey].push(run)
    });
    console.log('group key to runs', groupKeyToRuns);

    let color_i = 0;
    let groupKeyToColor: {[groupKey: string]: string} = {
      '<NOMATCH>': 'grey',
    };
    Object.keys(groupKeyToRuns).forEach((averageKey) => {
      Object.keys(groupKeyToRuns[averageKey]).forEach((groupKey) => {
        let color: string;
        if (groupKeyToColor[groupKey] !== undefined) {
          color = groupKeyToColor[groupKey];
        } else {
          color = DEFAULT_PLOTLY_COLORS[color_i];
          color_i = (color_i + 1) % DEFAULT_PLOTLY_COLORS.length;
          groupKeyToColor[groupKey] = color;
        }
        console.log('color', color)
        groups.push({
          runs: groupKeyToRuns[averageKey][groupKey],
          groupKey: groupKey,
          averageKey: averageKey,
          color: color,
        });
      })
    });
    return {
      num_runs: num_runs,
      groups: groups,
    };
  }

  updateQueryParams() {
    const d: any = {
      pattern_infos: JSON.stringify(this.props.pattern_infos),
      plot_states: JSON.stringify(this.state.plot_states),
      default_x_key: this.state.default_x_key,
      nameRegex: this.state.nameRegex,
      groupRegex: this.state.groupRegex,
      averageRegex: this.state.averageRegex,
    }
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname + '?' + encode_query_params(d);
    window.history.pushState({ path: newurl }, '', newurl);
  }

  updateState(update: any) {

    if (update.plot_states !== undefined) {
      update.plot_states_str = JSON.stringify(update.plot_states, null, 2);
    }

    this.setState(update);
    console.log('update', update);

    setImmediate(() => {
      this.updateQueryParams();
    });
  }

  handleStateChange(key: string, event: any) { // KeyboardEvent
    const update: any = {};
    update[key] = event.target.value;
    this.updateState(update);
  }

  showError(err: any) {
    // TODO: better
    console.error(err);
    alert(err);
  }

  setCustomPlotState(plot_states_str: string) { // KeyboardEvent
    try {
      const plot_states = JSON.parse(plot_states_str)
      this.updateState({
        plot_states: plot_states,
        plot_states_str: JSON.stringify(plot_states, null, 2),
      });
      console.log('updated state!', JSON.stringify(plot_states, null, 2));
    } catch (error) {
      this.showError(error);
    }
  }

  resetCustomPlotState() { // KeyboardEvent
    const plot_states = this.state.plot_states;
    this.updateState({
      plot_states: plot_states,
      plot_states_str: JSON.stringify(plot_states, null, 2),
    });
  }

  setDefaultPlotState() {
    const plot_states = generateDefaultPlotStates(this.state.default_x_key, this.state.possible_keys);
    this.updateState({
      plot_states: plot_states,
      plot_states_str: JSON.stringify(plot_states, null, 2),
    });
  }

  render() {
    const groupInfo = this.getGroupsInfo(this.state.nameRegex, this.state.groupRegex, this.state.averageRegex);
    const total_runs = Object.keys(this.props.all_data.runs).length;
    console.log('rerender');

    return (
      <div>
        <div>
          Plot data sources (one name:pattern on each line)
          <PlotStateEditor text={serialize_pattern_infos(this.props.pattern_infos)} buttonText='reload plot data' onSubmit={
            (text) => {
              try {
                const pattern_infos = parse_pattern_infos(text);
                this.props.update_pattern_infos(pattern_infos);
              } catch (error) {
                this.showError(error);
              }
            }
          }/>
        </div>

        <div style={{backgroundColor: (groupInfo.num_runs === 0 && total_runs > 0 ? 'red' : 'none')}}>
          Filter runs by regexp
          <input type="text" value={this.state.nameRegex} onChange={this.handleStateChange.bind(this, 'nameRegex')} />
          ({groupInfo.num_runs} of {total_runs} total runs)
        </div>
        <div>
          Group runs by regexp
          <input type="text" value={this.state.groupRegex} onChange={this.handleStateChange.bind(this, 'groupRegex')} />
        </div>
        <div>
          Average runs by regexp
          <input type="text" value={this.state.averageRegex} onChange={this.handleStateChange.bind(this, 'averageRegex')} />
        </div>

        <div>
          Default X axis:
          <select value={this.state.default_x_key} onChange={this.handleStateChange.bind(this, 'default_x_key')}>
            <option value=''>&mdash;</option>
            {
              Object.keys(this.state.possible_keys).map((key) => (
                <option key={key} value={key}>{key}</option>
              ))
            }
          </select>
          <button onClick={this.setDefaultPlotState.bind(this)}>Generate default plots</button>
        </div>

        <PlotStateEditor text={this.state.plot_states_str} buttonText='load custom plot state' onSubmit={
          this.setCustomPlotState.bind(this)
        }/>
        <button onClick={this.resetCustomPlotState.bind(this)}>Reset to current plot state</button>

        {
          this.state.plot_states.map((plot_state, plot_i) => {
            const handlePlotStateChange = (keys: Array<string>, event: any) => { // KeyboardEvent
              const value: any = event.target.value;
              const new_plot_state = plot_state;
              let d: any = new_plot_state;
              for (let i = 0; i < keys.length -1; i++) {
                d = d[keys[i]];
              }
              d[keys[keys.length-1]] = value;

              // TODO: use keyof
              const new_plot_states = this.state.plot_states.slice();
              new_plot_states[plot_i] = new_plot_state;
              this.updateState({plot_states: new_plot_states});
            }

            return (
              <div className="flex"
                key={JSON.stringify(plot_state)}
              >
                <div style={{flexGrow: 0}}>
                  <div>
                    Smoothing:
                    <input type="number" min={0} max={0.999} step={0.001} value={plot_state.smoothing || 0} onChange={handlePlotStateChange.bind(this, ['smoothing'])} />
                  </div>


                  <div>
                    X axis:
                    <select value={plot_state.x_key || 'index'} onChange={handlePlotStateChange.bind(this, ['x_key'])}>
                      <option value=''>None</option>
                      {
                        Object.keys(this.state.possible_keys).map((key) => (
                          <option key={key} value={key}>{key}</option>
                        ))
                      }
                    </select>
                  </div>

                  {
                    DASH_STYLE_CYCLE.map((style, i) => {
                      return (
                        <div key={style}>
                          Y axis ({style}):
                          <select value={(plot_state.y_keys || [])[i] || ''} onChange={handlePlotStateChange.bind(this, ['y_keys', i + ''])}>
                            <option value=''>&mdash;</option>
                            {
                              Object.keys(this.state.possible_keys).map((key) => (
                                <option key={key} value={key}>{key}</option>
                              ))
                            }
                          </select>
                        </div>
                      );
                    })
                  }
                </div>

                <PlotComponent
                    all_data={this.props.all_data}
                    groups={groupInfo.groups}
                    x_key={plot_state.x_key || this.state.default_x_key}
                    y_keys={plot_state.y_keys || []}
                    smoothing={plot_state.smoothing || 0}
              />
              </div>
            );
          })
        }
      </div>
    );
  }
}

export default App;
