import os
import threading
import time

from collections import defaultdict
import fire
from flask import Flask, jsonify, request
import blobfile

import utils


def main(
        logs=None,
        port=6006,
        flask_debug=True,
        dev_mode=False,
        static_dir=None,
        # data returned shouldn't be more than this many seconds stale
        max_stale=5 * 60,
):

    if static_dir is None:
        static_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), "build")
    print("static dir", static_dir)
    app = Flask(__name__, static_url_path="/", static_folder=static_dir)

    if dev_mode:
        @app.after_request
        def add_headers(response):
            response.headers.add("Access-Control-Allow-Origin", "*")
            response.headers.add("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS")
            response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
            response.headers.add(
                "Access-Control-Expose-Headers",
                "Content-Type,Content-Length,Authorization,X-Pagination",
            )
            return response

    if logs is not None:
        default_pattern_infos = []
        for x in logs.split(","):
            if ":" in x and x.split(':', 1)[1][0] != '/':
                name, log_pattern = x.split(":", 1)
            else:
                name = log_pattern = x
            default_pattern_infos.append(dict(name=name, pattern=log_pattern))
        print('names and patterns', default_pattern_infos)
    else:
        default_pattern_infos = []

    # TODO: dict from pattern to how recently we asked for it, use a cache?
    watch_patterns = defaultdict(dict)
    # filename to data
    all_run_data = dict()
    run_data_lock = threading.Lock()

    # TODO: dict from pattern to how recently we asked for it, use a cache?
    def load_data(patterns):
        print('Fetching data for patterns', patterns)
        nonlocal all_run_data
        filenames = utils.get_matches_for_patterns(patterns)
        # print('Loading filenames', filenames)
        results_by_filename = utils.load_data(filenames)
        with run_data_lock:
            all_run_data.update(results_by_filename)
        t = time.time()
        for x in patterns:
            watch_patterns[x]['last_loaded'] = t
        return results_by_filename

    def get_data(pattern_infos):
        nonlocal all_run_data
        t = time.time()
        for x in pattern_infos:
            watch_patterns[x['pattern']]['last_requested'] = t

        load_data([x['pattern'] for x in pattern_infos if time.time() - watch_patterns[x['pattern']].get('last_loaded', 0) > max_stale])
        log_infos = utils.get_log_infos(pattern_infos, all_run_data.keys())
        results_by_name = {
            name: all_run_data[filename]
            for (name, filename) in log_infos
        }
        return results_by_name

    def refresh_data():
        print("updating data")
        default_patterns = {x["pattern"] for x in default_pattern_infos}
        patterns_to_load = set(default_patterns)
        for p in watch_patterns:
            if (time.time() - watch_patterns[p]['last_requested'] > 60 * 60):
                if p not in default_patterns:
                    del watch_patterns[p]
            # keep data no more than 5 mins stale, also keep stuff recently requested (10m) super up to date
            elif time.time() - watch_patterns[p].get('last_loaded', 0) > max_stale or (time.time() - watch_patterns[p]['last_requested'] < 60 * 10):
                patterns_to_load.add(p)
        load_data(list(patterns_to_load))

    def refresh_data_loop():
        while True:
            refresh_data()
            time.sleep(5)

    refresh_data()
    t = threading.Thread(target=refresh_data_loop)
    t.start()

    @app.route("/")
    def root():
        return app.send_static_file("index.html")

    @app.route("/default_pattern_infos")
    def get_default_pattern_infos():
        # NOTE: maybe no lock needed due to GIL?
        # with run_data_lock:
        return jsonify(result=default_pattern_infos)

    @app.route("/plot_data", methods=["GET", "POST"])
    def plot_data():
        pattern_infos = request.get_json().get('pattern_infos', default_pattern_infos)
        # NOTE: maybe no lock needed due to GIL?
        # with run_data_lock:
        return jsonify(result=get_data(pattern_infos))

    app.run(host="0.0.0.0", port=port, debug=flask_debug)


if __name__ == "__main__":
    fire.Fire(main)
