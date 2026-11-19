// The one made-up person and workspace that demo pages show. The concept mocks carry {{demo.*}} tokens that
// fill() replaces when scripts/build.cjs writes the previews (and when a test loads a raw concept); the status
// screenshots take their quote attribution from here too. scripts/demo-names.cjs allows only these names in
// a badge, workspace title, byline or quote attribution, so a real name cannot slip back into a demo page.
const person = Object.freeze({ name: 'Robin Vale', first: 'Robin', initials: 'RV' });
const workspace = Object.freeze({ name: 'Harbor Lab' });
// A quote in the status screenshots is attributed to a document, not a person.
const quoteSource = 'Release notes';
// Agents the concepts show by name. They are not people, but the check lists them so nothing else passes.
const agents = Object.freeze([
  Object.freeze({ name: 'Ada', initials: 'A' }),
  Object.freeze({ name: 'Barkdown', initials: 'b' }),
]);

const values = Object.freeze({
  'demo.person': person.name,
  'demo.first': person.first,
  'demo.initials': person.initials,
  'demo.workspace': workspace.name,
});
const TOKEN = /\{\{\s*demo\.[A-Za-z]+\s*\}\}/;

function fill(text) {
  return text.replace(/\{\{\s*(demo\.[A-Za-z]+)\s*\}\}/g, (token, key) => {
    if (!Object.hasOwn(values, key)) throw Error('Unknown demo token ' + token);
    return values[key];
  });
}

module.exports = { person, workspace, quoteSource, agents, values, TOKEN, fill };
