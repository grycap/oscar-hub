/*! highlight.js | BSD-3-Clause | See highlight-LICENSE.txt */
import hljs from 'highlight.js/lib/core';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';

hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);

export function highlightCode(content, language) {
  return hljs.highlight(content, { language, ignoreIllegals: true }).value;
}
