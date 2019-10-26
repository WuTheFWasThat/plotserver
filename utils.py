import json
import re
import csv
import os
import subprocess

import blobfile as bf


def matchespattern(pattern, url):
    if pattern.startswith('az://'):
        _, _, container, rest = pattern.split('/', 3)
        pattern = f'https://{container}.blob.core.windows.net/{rest}'
    pattern_parts = pattern.split("/")
    url_parts = url.split("/")
    if len(pattern_parts) != len(url_parts):
        return False, None
    wildcard_parts = []
    for pat_part, url_part in zip(pattern_parts, url_parts):
        if pat_part == "*":
            wildcard_parts.append(url_part)
            continue
        elif pat_part != url_part:
            return False, None
    return True, wildcard_parts


def parse_jsonl(f):
    def parse_line(x):
        # TODO: do these better
        x = re.sub(r"-Infinity\b", "null", x)
        x = re.sub(r"\bInfinity\b", "null", x)
        x = re.sub(r"\bNaN\b", "null", x)
        return json.loads(x)

    return [parse_line(x) for x in f.read().strip().split("\n")]


def parse_csv(f):
    # spamreader = csv.reader(f, delimiter=' ', quotechar='|')
    return [row for row in csv.DictReader(f)]


PARSERS = {
    ".jsonl": parse_jsonl,
    ".json": parse_jsonl,
    ".csv": parse_csv,
}


def load_data(filenames):
    results = dict()
    for filename in filenames:
        try:
            _, ext = os.path.splitext(filename)
            assert ext in PARSERS, f"Extension {ext} unimplemented, PRs welcome!"
            with bf.BlobFile(filename, "r") as f:
                results[filename] = PARSERS[ext](f)
        except Exception as e:
            print(f"Failed to load {filename}: {e}")
    return results


def get_matches_for_patterns(patterns):
    filenames = []
    for pattern in patterns:
        filenames.extend(bf.glob(pattern))
    return filenames


def get_log_infos(pattern_info, all_filenames):
    log_infos = []
    for x in pattern_info:
        log_pattern = x["pattern"]
        name = x["name"]
        for filename in all_filenames:
            matches, wild_parts = matchespattern(log_pattern, filename)
            if matches:
                log_infos.append((":".join([name] + wild_parts), filename))
    return log_infos
