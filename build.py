# Inlines src/ into one self-contained index.html (and build/test.html, which exposes game state for the tools).
import os
os.makedirs('build', exist_ok=True)
src='src/'
core=open(src+'core.js').read()
core=core[:core.index("if (typeof module")]
core=core.replace("'use strict';\n","",1)
t=open(src+'index.tpl.html').read()
t=t.replace("(function(){\n/*CORE*/","(function(){\n'use strict';\n"+core)
t=t.replace("/*GL*/",open(src+'gl.js').read()).replace("/*UI*/",open(src+'ui.js').read())
open('index.html','w').write(t)
print(len(t),'bytes')

open('build/test.html','w').write(t.replace("})();\n</script>","window.__tsd={Sky,get S(){return S},get M(){return M},simulate,frameUI,checks,calc};\n})();\n</script>"))
