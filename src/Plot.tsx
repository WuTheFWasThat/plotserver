import React from 'react';
// import Plot from 'react-plotly.js';
const Plot = createPlotlyComponent(Plotly);

type SingleRunData = any;
export type PlotData = {
  id: number,
  runs: {[key: string]: SingleRunData},
};
export type PlotGroups = Array<{
  runs: Array<string>,
  groupKey: string,
  averageKey: string,
  color: string,
}>;
export type PlotComponentProps = {
  all_data: PlotData,
  groups: PlotGroups,
  x_key: string,
  y_keys: Array<string>,
  // TODO: make some of this changeable via state?
  smoothing: number,
};
export type PlotComponentState = {};
type Point = {
  x: number,
  y: number,
}

function smoothing(vals: Array<number>, smooth_factor: number) {
    let last = vals[0];
    const smoothed = [];
    for (let val of vals) {
        let smoothed_val: number = last * smooth_factor + (1 - smooth_factor) * val
        smoothed.push(smoothed_val);
        last = smoothed_val
    }
    return smoothed
}

export const DASH_STYLE_CYCLE = ['solid', 'dash', 'dot', 'dashdot'];
export const DEFAULT_PLOTLY_COLORS = [
  'rgb(31, 119, 180)', 'rgb(255, 127, 14)',
  'rgb(44, 160, 44)', 'rgb(214, 39, 40)',
  'rgb(148, 103, 189)', 'rgb(140, 86, 75)',
  'rgb(227, 119, 194)',
  'rgb(188, 189, 34)', 'rgb(23, 190, 207)'
]

function get_moments(xs: Array<number>) {
  var total = 0;
  for(var i = 0; i < xs.length; i++) {
      total += xs[i];
  }
  return {
    mean: total / xs.length
  };
}

function average_plots(datas: Array<Array<Point>>): Array<Point> {
  if (datas.length === 1) {
    // avoid re-sorting
    // TODO: instead have a separate key for data order?
    return datas[0];
  }
  let shared_x : {[x: number]: Array<number>} = {};
  datas.forEach(data => {
    data.forEach(p => {
      shared_x[p.x] = shared_x[p.x] || [];
      shared_x[p.x].push(p.y)
    })
  });
  let shared_points: Array<Point> = [];
  for (let [x, ys] of Object.entries(shared_x)) {
    if (ys.length !== datas.length) {
      continue;
    }
    let moments = get_moments(ys);
    shared_points.push({
      x: parseFloat(x),
      y: moments.mean,
    })
  }
  shared_points.sort(function(a, b){return a.x-b.x});
  return shared_points;
}

class PlotComponent extends React.Component<PlotComponentProps, PlotComponentState> {
  constructor(props: PlotComponentProps) {
    super(props);

    this.state = {
      smoothing: this.props.smoothing || 0.0,
    };
  }

  shouldComponentUpdate(nextProps: PlotComponentProps, nextState: PlotComponentState): boolean {
    // for (let key in nextProps) {
    for (let key of Object.keys(nextProps)) {
      if (key === "all_data") {
        if (nextProps.all_data.id !== this.props.all_data.id) {
          return true;
        }
      } else {
        if (JSON.stringify((nextProps as any)[key]) !== JSON.stringify((this.props as any)[key])) {
          return true;
        }
      }
    }
    return false;
  }

  render() {
    const plot_data: Array<any> = [];
    this.props.groups.forEach((group) => {
      const to_plot: {[y_key: string]: Array<Array<Point>>} = {};
      let color = group.color;
      group.runs.forEach((run: string) => {
        const all_x = this.props.all_data.runs[run].map((obj: any, i: number) => {
          if (this.props.x_key in obj) {
            return obj[this.props.x_key];
          } else if (this.props.x_key === 'index') {
            return i;
          }
          return null;
        });
        this.props.y_keys.forEach((k, i) => {
          to_plot[k] = to_plot[k] || [];
          let all_y = this.props.all_data.runs[run].map((obj: any) => obj[k]);

          const ps: Array<Point> = [];
          for (let i = 0; i < all_x.length; i++) {
            if (all_x[i] !== undefined && all_y[i] !== undefined) {
              ps.push({
                x: all_x[i],
                y: all_y[i],
              });
            }
          }

          to_plot[k].push(ps);
        });
      });

      this.props.y_keys.forEach((k, i) => {
        const dash = DASH_STYLE_CYCLE[i % DASH_STYLE_CYCLE.length];
        if (to_plot[k] === undefined) {
          return;
        }
        const data = average_plots(to_plot[k]);

        const displayName = (
          group.runs.length === 1 ? group.runs[0] :
          // NOTE: should actually be based on whether regexes are equal?
          group.averageKey === group.groupKey ? group.averageKey :
          group.averageKey + ' ' + group.groupKey
        );
        const trace = {
          x: data.map((p) => p.x),
          y: smoothing(data.map((p) => p.y), this.props.smoothing),
          // make hover info not truncate https://github.com/plotly/plotly.js/issues/460
          hoverlabel: {namelength :-1},
          mode: 'lines',
          legendgroup: group.groupKey,
          // type: 'scatter',
          name: displayName, // + ' ' + k,
          line: {
            color: color,
            dash: dash,
          },
        };
        plot_data.push(trace);
      })
    });

    let ytitle = this.props.y_keys.join(' + ');
    const layout = {
      title: '',
      hovermode: 'x',
      hoverdistance: -1,
      hoverlabel: {
        font: {
          size: 10,
        },
      },
      xaxis: {
        title: this.props.x_key,
      },
      yaxis: {
        title: ytitle,
      },
      legend: {
        x: 1,
        y: 0.5,
        font: {
          size: 6,
        }
      },
    };
    console.log('Plotly layout', layout);
    //  data: plot_data,
    //  layout: layout
    return (
      <Plot
        data={plot_data}
        layout={layout}
      />
    );
  }
}

export default PlotComponent;
