export type PatternInfo = {name: string, pattern: string};

export function parse_pattern_infos(s: string): Array<PatternInfo> {
  return s.split(new RegExp('\\n|,')).map(x => x.trim()).filter(x => x.length).map(x => {
    let parts = x.split(":");
    let name = parts[0];
    let pattern = parts.slice(1).join(":");
    if (!pattern || pattern.startsWith("/")) {
      pattern = name + ":" + pattern;
      name = pattern;
    }

    return { name: name, pattern: pattern };
  });
}

export function serialize_pattern_infos(pattern_infos: Array<PatternInfo>): string {
  return pattern_infos.map((info) => {
    return info.name + ":" + info.pattern;;
  }).join('\n');
}

export function encode_query_params(dict: {[key: string]: string}): string {
  return Object.keys(dict).map((k: string) => (k + '=' + encodeURIComponent(dict[k] + ''))).join('&');
}

export function parse_query_string() {
    const querystring = window.location.search;
    if (querystring.length === 0) {
      return {};
    }
    if (querystring[0] !== '?') {
      throw new Error("query string " + querystring);
    }
    var result: {[key: string]: string} = {};
    var pairs = querystring.substr(1).split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        result[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return result;
}

