const {chromium}=require('../app/tests/lib/playwright.mjs');
exports.launch=()=>chromium.launch({headless:true,...(process.env.BARKDOWN_BROWSER_CHANNEL?{channel:process.env.BARKDOWN_BROWSER_CHANNEL}:{})});
