# Packaged source input guard

The [actual builder/ASAR probe](result.json) reproduces an empty tracked Git diff while both synthetic untracked and Git-ignored files enter the real manifest's package matchers and ASAR. The controlled archive and producer are retained; the miniature repository is private. This does not establish that the prior reviewed installer contained unexpected content.

The producer now refuses these inputs before building and after assembly, allows only four known regenerated renderer outputs, rejects package pattern expansion pending review and checks package directories for links. [Eleven controls](controls.json) preserve all seven previous refusals and original bytes. Actual rebuilt NSIS payload proof and full root verification follow the implementation commit. No installer execution, real content, publication or A5 acceptance.
