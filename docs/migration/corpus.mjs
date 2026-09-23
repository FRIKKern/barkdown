// Synthetic preparation corpus only. No person’s library, paths or credentials.
const text = (value, marks = []) => ({ type: 'text', text: value, ...(marks.length ? { marks } : {}) });
const paragraph = (...content) => ({ type: 'paragraph', content });
const pdText = value => ({ type: 'text', value });
const cell = (value, header = false, attrs = {}) => ({ type: header ? 'tableHeader' : 'tableCell', attrs, content: [paragraph(text(value))] });
const row = (...content) => ({ type: 'tableRow', content });
const sample = (id, node, expected, note) => ({ id, source: { type: 'doc', content: [node] }, expected, note });
export const cases = [
  sample('plain-unicode', paragraph(text('Notes — café 日本語 🐕')), { blocks: [{ type: 'paragraph', content: [pdText('Notes — café 日本語 🐕')] }] }, 'Exact Unicode text; no Markdown detour.'),
  sample('nested-marks', paragraph(text('Keep emphasis', [{type:'bold'}, {type:'italic'}])), { blocks: [{type:'paragraph',content:[{type:'strong',children:[{type:'em',children:[pdText('Keep emphasis')]}]}]}] }, 'Nested marks have a canonical wrapper order.'),
  sample('underline', paragraph(text('Keep underline', [{type:'underline'}])), {blocks:[{type:'paragraph',content:[{type:'underline',children:[pdText('Keep underline')]}]}]}, 'Structured conversion retains underline; Markdown export alone cannot prove it.'),
  sample('strike-code', paragraph(text('removed',[{type:'strike'}]),text(' literal ',[{type:'code'}])), {blocks:[{type:'paragraph',content:[{type:'strikethrough',children:[pdText('removed')]},{type:'code',value:' literal '}]}]}, 'Inline code and strike remain distinct.'),
  sample('external-link', paragraph(text('Reference',[{type:'link',attrs:{href:'https://example.invalid/reference'}}])), {blocks:[{type:'paragraph',content:[{type:'link',href:'https://example.invalid/reference',children:[pdText('Reference')]}]}]}, 'URL retained; no network request.'),
  sample('internal-link', paragraph(text('Overview',[{type:'link',attrs:{href:'barkdown://doc/overview'}}])), {blocks:[{type:'paragraph',content:[{type:'link',href:'barkdown://doc/overview',children:[pdText('Overview')]}]}], unresolved:['internal-link-target']}, 'Representation survives, but the legacy scheme needs an audited target-ID rewrite before cutover.'),
  sample('hard-break', paragraph(text('Line one'),{type:'hardBreak'},text('Line two')), {blocks:[{type:'paragraph',content:[pdText('Line one'),pdText('\n'),pdText('Line two')]}]}, 'Hard break maps to a newline; later Paper save/reload must prove display semantics.'),
  sample('heading-plain', {type:'heading',attrs:{level:2},content:[text('Section')]}, {blocks:[{type:'heading',level:2,text:'Section'}]}, 'Plain level-two heading.'),
  sample('heading-formatted', {type:'heading',attrs:{level:2},content:[text('Linked heading',[{type:'link',attrs:{href:'barkdown://doc/overview'}},{type:'bold'}])]}, {blocks:[{type:'heading',level:2,content:[{type:'link',href:'barkdown://doc/overview',children:[{type:'strong',children:[pdText('Linked heading')]}]}]}], unresolved:['internal-link-target']}, 'Heading marks survive; internal destinations still need reference-map activation.'),
  sample('heading-rich-external', {type:'heading',attrs:{level:1},content:[text('Rich heading',[{type:'link',attrs:{href:'https://example.invalid/heading'}},{type:'bold'},{type:'italic'}])]}, {blocks:[{type:'heading',level:1,content:[{type:'link',href:'https://example.invalid/heading',children:[{type:'strong',children:[{type:'em',children:[pdText('Rich heading')]}]}]}]}]}, 'External link and nested emphasis retain the native heading content carrier.'),
  sample('heading-aligned', {type:'heading',attrs:{level:3,textAlign:'right'},content:[text('Right heading')]}, {blocks:[{type:'heading',level:3,text:'Right heading',align:'right'}]}, 'Plain heading alignment uses native align without changing its text carrier.'),
  sample('heading-break', {type:'heading',attrs:{level:2},content:[text('Heading first',[{type:'bold'}]),{type:'hardBreak'},text('Heading second')]}, {blocks:[{type:'heading',level:2,content:[{type:'strong',children:[pdText('Heading first')]},pdText('\n'),pdText('Heading second')]}]}, 'Marked heading with a native inline break; source split carriers stay exact through Undo.'),
  sample('heading-deep', {type:'heading',attrs:{level:6},content:[text('Deep section')]}, {blocks:[{type:'heading',level:3,text:'Deep section'}], loss:['heading-level']}, 'Current converter clamps level 6 to 3 even though upstream retains source levels.'),
  sample('paragraph-alignment', {...paragraph(text('Centered')),attrs:{textAlign:'center'}}, {blocks:[{type:'paragraph',content:[pdText('Centered')],align:'center'}]}, 'Centered paragraph retains native alignment.'),
  sample('paragraph-right', {...paragraph(text('Right paragraph',[{type:'underline'}])),attrs:{textAlign:'right'}}, {blocks:[{type:'paragraph',content:[{type:'underline',children:[pdText('Right paragraph')]}],align:'right'}]}, 'Right alignment and underline remain independent.'),
  sample('paragraph-literal-break', paragraph(text('Literal first\nLiteral second',[{type:'bold'}])), {blocks:[{type:'paragraph',content:[{type:'strong',children:[pdText('Literal first\nLiteral second')]}]}]}, 'A literal LF inside one marked carrier exercises DOM normalization and exact saved Undo.'),
  sample('ordered-offset', {type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[paragraph(text('Seventh'))]}]}, {blocks:[{type:'list',ordered:true,items:[[pdText('Seventh')]]}],loss:['list-start']}, 'Current converter drops non-default ordered-list start.'),
  sample('checklist', {type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[paragraph(text('Done'))]},{type:'taskItem',attrs:{checked:false},content:[paragraph(text('Remaining'))]}]}, {blocks:[{type:'list',ordered:false,task:true,items:[{content:[pdText('Done')],checked:true},{content:[pdText('Remaining')],checked:false}]}]}, 'Task state is retained.'),
  sample('nested-list', {type:'bulletList',content:[{type:'listItem',content:[paragraph(text('Parent')),{type:'bulletList',content:[{type:'listItem',content:[paragraph(text('Child'))]}]}]}]}, {blocks:[{type:'list',ordered:false,items:[{content:[pdText('Parent')],children:[{type:'list',ordered:false,items:[[pdText('Child')]]}]}]}]}, 'Parent and child retain their native list hierarchy.'),
  sample('quotation', {type:'blockquote',content:[paragraph(text('Quoted words'))]}, {blocks:[{type:'blockquote',content:[pdText('Quoted words')]}]}, 'Genuine quote identity uses the native blockquote carrier.'),
  sample('nested-mixed-task', {
    type:'orderedList', attrs:{start:1}, content:[
      {type:'listItem',content:[paragraph(text('Mixed parent',[{type:'bold'}])),
        {type:'taskList',content:[{type:'taskItem',attrs:{checked:true},content:[
          paragraph(text('Checked child')),
          {type:'bulletList',content:[{type:'listItem',content:[paragraph(text('Deep leaf'))]}]}
        ]}]}
      ]},
      {type:'listItem',content:[paragraph(text('Ordered sibling'))]}
    ]
  }, {blocks:[{type:'list',ordered:true,items:[
    {content:[{type:'strong',children:[pdText('Mixed parent')]}],children:[
      {type:'list',ordered:false,task:true,items:[{content:[pdText('Checked child')],checked:true,children:[
        {type:'list',ordered:false,items:[[pdText('Deep leaf')]]}
      ]}]}
    ]},
    [pdText('Ordered sibling')]
  ]}]}, 'Three levels preserve rich parent, mixed markers, task checked state and plain sibling.'),
  sample('list-break', {type:'bulletList',content:[{type:'listItem',content:[paragraph(text('List first'),{type:'hardBreak'},text('List second'))]}]}, {blocks:[{type:'list',ordered:false,items:[[pdText('List first'),pdText('\n'),pdText('List second')]]}]}, 'Native list inline break and exact carriers need browser save/Undo proof.'),
  sample('quotation-rich', {type:'blockquote',content:[paragraph(text('Rich quotation',[{type:'bold'},{type:'italic'}]))]}, {blocks:[{type:'blockquote',content:[{type:'strong',children:[{type:'em',children:[pdText('Rich quotation')]}]}]}]}, 'Quote body retains nested marks without becoming a callout.'),
  sample('list-multi-paragraph', {type:'bulletList',content:[{type:'listItem',content:[paragraph(text('First item paragraph')),paragraph(text('Second item paragraph'))]}]}, {error:'multi-paragraph'}, 'Unsupported item paragraphs refuse the entire document.'),
  sample('quote-multi-paragraph', {type:'blockquote',content:[paragraph(text('First quote paragraph')),paragraph(text('Second quote paragraph'))]}, {error:'multi-paragraph'}, 'Separate quote paragraphs cannot be silently flattened into one inline carrier.'),
  sample('code-language', {type:'codeBlock',attrs:{language:'js'},content:[text('const value = 1;\n')]}, {blocks:[{type:'code',lang:'js',value:'const value = 1;\n'}]}, 'Paper uses lang; C046 found and corrected the old language carrier. Trailing newline remains intact.'),
  sample('table-header-align', {type:'table',content:[row(cell('Label',true),cell('Value',true,{align:'right'})),row(cell('A'),cell('1',false,{align:'right'}))]}, {blocks:[{type:'table',head:[[pdText('Label')],{content:[pdText('Value')],align:'right'}],rows:[[[pdText('A')],{content:[pdText('1')],align:'right'}]]}]}, 'Header and per-cell alignment are explicit structured data.'),
  sample('table-span', {type:'table',content:[row(cell('Merged',false,{colspan:2}))]}, {error:'unsupported table cell'}, 'Merged spans cannot pass through the existing converter.'),
  sample('table-width', {type:'table',content:[row(cell('Sized',false,{colwidth:[180]}))]}, {error:'unsupported table cell'}, 'Column width cannot be discarded.'),
  sample('image-local', {type:'image',attrs:{src:'attachments/synthetic.png',alt:'Synthetic green square'}}, {error:'Cannot convert block: image'}, 'Upload, digest mapping and rewritten media URL are separate unimplemented work.'),
  sample('unknown-block', {type:'futureWidget',attrs:{payload:'Preserve opaque source'}}, {error:'Cannot convert block: futureWidget'}, 'Unknown data must remain readable in the retained source, never disappear.'),
  sample('unknown-mark', paragraph(text('Highlighted',[{type:'highlight',attrs:{color:'#ffff00'}}])), {error:'Cannot convert inline mark: highlight'}, 'Unsupported mark is a refusal rather than a flattening pass.'),
];

export const library = {
  version: 1,
  profiles: [
    { id:'11111111-1111-4111-8111-111111111111',documents:[
      {id:'overview',title:'Overview',rev:4,caseId:'plain-unicode',references:[],revisions:[{rev:1,caseId:'heading-plain'},{rev:4,caseId:'plain-unicode'}],proposals:[{id:'pending-review',baseRev:4,caseId:'nested-marks'}]},
      {id:'linked-note',title:'Linked note',rev:2,caseId:'internal-link',references:['overview'],revisions:[],proposals:[]},
      {id:'unplaced',title:'Unplaced note',rev:1,caseId:'image-local',references:[],revisions:[],proposals:[]}
    ],workspace:{pages:{layoutVersion:2,roots:['linked-note','bp:existing-cloud'],children:{'linked-note':['overview']},expanded:{'linked-note':true},archived:{unplaced:true}},favorites:[{kind:'doc',source:'local',id:'overview',title:'Overview'}],chats:{main:{id:'main',draft:'Keep draft',draftImages:[{path:'attachments/synthetic.png',name:'synthetic.png'}],tabs:[{type:'doc',source:'local',path:['linked-note','overview']}],events:[{target:{kind:'doc',source:'local',id:'overview'}}]},side:{id:'side',parent:'main',draft:'Keep side',tabs:[]}},order:['main','side'],current:'side'},receipts:[{id:'receipt-1',documentId:'overview',beforeRev:3,afterRev:4,beforeCase:'heading-plain'}],media:[{path:'attachments/synthetic.png',mime:'image/png',bytesBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII='}]},
    {id:'22222222-2222-4222-8222-222222222222',documents:[{id:'overview',title:'Different profile overview',rev:1,caseId:'code-language',references:[],revisions:[],proposals:[]}],workspace:{pages:{layoutVersion:2,roots:['overview'],children:{}},favorites:[],chats:{},order:[]},receipts:[],media:[]}
  ]
};
