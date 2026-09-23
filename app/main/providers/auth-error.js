// Only provider-level failures use this classifier; never tool-result errors.
function authenticationFailure(error) {
  const status = error?.status ?? error?.statusCode;
  if (status === 401 || status === '401') return true;
  const code = error?.code || error?.error?.type || error?.type;
  if (['authentication_error','invalid_api_key','token_expired','invalid_grant'].includes(code)) return true;
  const message = String(error?.message || error || '').trim();
  return /^(?:Error:\s*)?(?:not logged in(?:[.!]|$)|(?:your |the )?(?:access |oauth |refresh )?token (?:has expired|is expired|is invalid)(?:[.!]|$)|invalid api key(?:[.!:]|$)|authentication failed(?:[.!:]|$)|unexpected status(?: code)? 401\b)/i.test(message);
}
function providerError(provider, error) {
  return authenticationFailure(error)
    ? {type:'error',authProvider:provider,message:'Your provider session needs attention. Your message is saved above. Review any completed work before sending again.'}
    : {type:'error',message:error?.message || String(error)};
}
module.exports = { authenticationFailure, providerError };
