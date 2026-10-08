// Assistant tools operate on a captured foreground view. Provider work can outlive that view,
// but its app/browser connection must never borrow the profile the person selected afterward.
function createAssistantOwner({ service, gate }) {
  const refused = () => Object.assign(new Error('The assistant’s profile view is no longer active. Start a new turn in the selected profile.'), { code: 'profile_changed' });
  function capture(profileId) {
    const current = service()?.view();
    if (!current) return profileId == null ? null : { profileId, generation: null };
    if (profileId === undefined) return { ...current };
    return { profileId, generation: profileId === current.profileId ? current.generation : null };
  }
  async function run(owner, invoke, { tool, args } = {}) {
    const current = service();
    if (!current) { if (owner) throw refused(); return invoke(); }
    try { current.validate(owner); } catch { throw refused(); }
    // This command performs selection itself. The renderer checks its captured owner before
    // selecting; holding the ordinary request gate here would make it wait on its own request.
    if (tool === 'app' && String(args?.command).toLowerCase() === 'profile.switch') return invoke();
    let entered = false;
    try { return await gate().request(owner, async () => {
      entered = true;
      const value = await invoke();
      // Selection may have started while this command awaited an owned renderer request.
      // Nested requests then refuse; do not report success for a partly completed command.
      try { gate().assertCurrent(owner); } catch { throw refused(); }
      return value;
    }); }
    catch (error) { if (!entered) throw refused(); throw error; }
  }
  return Object.freeze({ capture, run });
}
module.exports = { createAssistantOwner };
