import json
import re
import csv
import os
import subprocess

import blobfile as bf


def normalize_url_or_pattern(url):
    if url.startswith('az://'):
        _, _, container, rest = url.split('/', 3)
        url = f'https://{container}.blob.core.windows.net/{rest}'
    return url

def matchespattern(pattern, url):
    pattern = normalize_url_or_pattern(pattern)
    url = normalize_url_or_pattern(url)
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

    result = [parse_line(x) for x in f.read().strip().split("\n")]
    # print(len(result))
    return result


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
    # print('patterns', patterns)
    for pattern in patterns:
        filenames.extend(bf.glob(pattern))
    # print('filenames', filenames)
    return filenames


def get_log_infos(pattern_info, all_filenames):
    log_infos = []
    for x in pattern_info:
        log_pattern = x["pattern"]
        name = x["name"]
        for filename in all_filenames:
            matches, wild_parts = matchespattern(log_pattern, filename)
            # print('matches', log_pattern, filename, matches, wild_parts)
            if matches:
                log_infos.append((":".join([name] + wild_parts), filename))
    return log_infos
