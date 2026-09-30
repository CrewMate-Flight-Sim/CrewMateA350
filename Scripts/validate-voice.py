import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

# Checks that the grammar's discrete command ids and the TS handlers agree.
# Only literal ids are compared; training phrases are composed from SRGS rules and can't be matched as text.

ROOT = Path(__file__).resolve().parent.parent
GRAMMAR = ROOT / 'voice' / 'grammar.xml'
DISPATCH_TS = ROOT / 'src' / 'voice' / 'commandDispatch.ts'

NS = {'g': 'http://www.w3.org/2001/06/grammar'}
SNAKE_CASE = re.compile(r'^[a-z][a-z0-9_]*$')
PID_TAG = re.compile(r'out\.pid="([^"]*)"')

errors = []
warnings = []


def rule_ids(tree, rule_id):
    rule = tree.find(f".//g:rule[@id='{rule_id}']", NS)
    if rule is None:
        errors.append(f'grammar.xml has no <rule id="{rule_id}">')
        return {}
    ids = {}
    for item in rule.iterfind('.//g:item', NS):
        tag = item.find('g:tag', NS)
        match = PID_TAG.search(tag.text or '') if tag is not None else None
        if match:
            ids.setdefault(match.group(1), (item.text or '').strip())
    return ids


def ts_set(source, name):
    match = re.search(rf'(?:export )?const {name} = new Set\(\[(.*?)\]\)', source, re.S)
    if not match:
        # Optional: not every aircraft app has every command set
        warnings.append(f'commandDispatch.ts has no {name}; skipped')
        return set()
    return set(re.findall(r'"(\w+)"', match.group(1)))


def ts_map_keys(source):
    match = re.search(r'(?:export )?const discreteCommandMap', source)
    start = match.start() if match else -1
    if start < 0:
        errors.append('commandDispatch.ts has no discreteCommandMap')
        return set()
    body = source[start:source.index('\n}\n', start)]
    return set(re.findall(r'^  (\w+):', body, re.M))


tree = ET.parse(GRAMMAR)
ts_source = DISPATCH_TS.read_text(encoding='utf-8')

commands = rule_ids(tree, 'DISCRETE_COMMANDS')
responses = rule_ids(tree, 'CHECKLIST_RESPONSES')
handlers = ts_map_keys(ts_source)

for pid, phrase in sorted(commands.items()):
    if pid not in handlers:
        errors.append(f'DISCRETE_COMMANDS id "{pid}" ("{phrase}") has no discreteCommandMap handler')

for pid, phrase in sorted(responses.items()):
    if not SNAKE_CASE.match(pid):
        errors.append(f'CHECKLIST_RESPONSES id "{pid}" ("{phrase}") is not snake_case')
    if pid in handlers:
        warnings.append(f'CHECKLIST_RESPONSES id "{pid}" has a handler; move it to DISCRETE_COMMANDS')

for name in ('foAwayAllowedCommands', 'checklistAbortCommands'):
    for pid in sorted(ts_set(ts_source, name) - commands.keys()):
        errors.append(f'{name} names "{pid}", which is not a DISCRETE_COMMANDS id')

for key in sorted(handlers - commands.keys()):
    warnings.append(f'discreteCommandMap handler "{key}" is never produced by the grammar')

for line in warnings:
    print(f'[validate-voice] WARN {line}')
for line in errors:
    print(f'[validate-voice] ERROR {line}')

print(
    f'[validate-voice] {len(commands)} command ids, {len(responses)} response ids, '
    f'{len(handlers)} handlers: {len(errors)} errors, {len(warnings)} warnings'
)
sys.exit(1 if errors else 0)
