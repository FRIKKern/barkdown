const {SourceDriver}=require('../app/main/local-barkpark-source');
const {LocalBarkpark}=require('../app/main/local-barkpark');
let driver,lifecycle;
process.on('message',async message=>{
 try {
  if(message.action==='start') {
   driver=new SourceDriver(message.config,message.data,message.secrets);lifecycle=new LocalBarkpark(driver);
   lifecycle.on('status',state=>console.log(JSON.stringify({phase:state.phase,attempts:state.attempts,error:state.error})));
   await lifecycle.start();process.send({ok:true,record:driver.processRecord.read(),pgBin:driver.pgBin,mix:driver.mix,state:lifecycle.status()});
  } else if(message.action==='stop') {await lifecycle.stop();process.send({ok:true},()=>process.disconnect());}
  else throw Error('Unknown owned observation action');
 } catch(error) {
  let cleanupError;try{if(driver?.lease){await driver.stop();await driver.release();}}catch(e){cleanupError=e.message;}
  process.send({ok:false,error:error.message,cleanupError},()=>process.disconnect());
 }
});
