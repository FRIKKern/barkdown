import sys,pathlib
text=pathlib.Path(sys.argv[1]).read_text()
start=text.index('section "33.')
end=text.rindex('\nif [ "$HERMETIC" -eq 1 ]; then')
assert start<end
section=text[start:end]
assert 'RC_TALLY_REACHED=1' not in section
print(section,end='')
