// Origin is a statement about the managed runtime lease, never a server claim.
function catalogOrigin(config, managed) {
  const cloud = { kind: 'cloud' };
  if (!managed || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(managed.profileId || '') || managed.profileId !== managed.connectionProfileId) return cloud;
  const connection = managed.connection;
  if (!connection || config.viaCli || connection.viaCli || !connection.token) return cloud;
  if (['server', 'token', 'dataset'].some(key => config[key] !== connection[key])) return cloud;
  return { kind: 'local', profileId: managed.profileId };
}
module.exports = { catalogOrigin };
