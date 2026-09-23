import test from 'node:test';
import assert from 'node:assert/strict';
import auth from '../main/providers/auth-error.js';
test('specific provider authentication signals are distinguished from quota, transport and tool permission failures',()=>{
  for(const error of [{status:401},{error:{type:'authentication_error'}},{code:'token_expired'},Error('Your access token has expired.'),Error('Not logged in'),Error('Unexpected status 401 Unauthorized')]) assert.equal(auth.authenticationFailure(error),true);
  for(const error of [{status:429},{status:403},Error('Weekly usage limit reached'),Error('Network error during authentication'),Error('Tool not authorized to access file'),Error('Please edit login.ts'),Error('Could not load auth settings'),Error('connection reset')]) assert.equal(auth.authenticationFailure(error),false);
  assert.deepEqual(auth.providerError('codex',{status:401,message:'secret should not be forwarded'}),{type:'error',authProvider:'codex',message:'Your provider session needs attention. Your message is saved above. Review any completed work before sending again.'});
});

test('explicit recovery copies text and images, protects newer drafts and never alters the saved request',async()=>{
  const {restoreFailedMessage,beginSubmission,endSubmission}=await import('../renderer/src/submission-state.js');
  const user={role:'user',text:'Retained request',images:[{id:'image',path:'synthetic.png',name:'kept.png'}]};
  const chat={messages:[user,{role:'assistant',authProvider:'codex',error:'Expired'}],draft:'',draftImages:[]};
  assert.equal(restoreFailedMessage(chat,1),true);assert.equal(chat.draft,user.text);assert.deepEqual(chat.draftImages,user.images);
  chat.draftImages[0].name='changed';assert.equal(user.images[0].name,'kept.png');
  assert.equal(restoreFailedMessage(chat,1),false);assert.equal(chat.draftImages[0].name,'changed');
  chat.draft='';chat.draftImages=[];const pending=beginSubmission(chat);assert.equal(restoreFailedMessage(chat,1),false);endSubmission(chat,pending);
  chat.runId='active';assert.equal(restoreFailedMessage(chat,1),false);chat.runId=null;
  chat.interruption={};assert.equal(restoreFailedMessage(chat,1),false);delete chat.interruption;
  chat.messages[1].authProvider='api';assert.equal(restoreFailedMessage(chat,1),true);
});
