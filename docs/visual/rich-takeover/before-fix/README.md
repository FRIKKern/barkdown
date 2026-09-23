# Mounted selection failure before E003

At unchanged upstream bb3bd299d, the real mounted Paper canvas collapsed selected text for formatting-only changes, link destination changes, another list item edit and another table cell edit. The fifth case, a multiline update in a separate paragraph, passed. [Original failure output](mounted-baseline.txt) is retained. These are mounted JSDOM selection tests, not live screenshots or server proof.
