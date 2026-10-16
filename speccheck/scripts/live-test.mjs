// Zero-value transactions on GenLayer's simulated Studionet only.
// These two auxiliary wallets are test actors, never independent customers.
import {createClient,createAccount,generatePrivateKey} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {assertExecutionSucceeded,terminalStatus} from '../src/receipt.js';

const config=JSON.parse(await readFile(new URL('../public/deployment.json',import.meta.url),'utf8'));
if(config.chainId!==61999 || !config.deployed) throw new Error('Requires the deployed Studionet contract.');
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
const keyPath=new URL('../.local/test-wallets.json',import.meta.url);
let keys;
try{keys=JSON.parse(await readFile(keyPath,'utf8'));}catch{keys={buyer:generatePrivateKey(),supplier:generatePrivateKey()};await writeFile(keyPath,JSON.stringify(keys),{mode:0o600});}
const buyer=createClient({chain:studionet,account:createAccount(keys.buyer)});
const supplier=createClient({chain:studionet,account:createAccount(keys.supplier)});
const reader=createClient({chain:studionet});
const transcriptPath=new URL(`../.local/live-transcript-${config.address.toLowerCase()}.json`,import.meta.url);
let transcript=[];
try {transcript=JSON.parse(await readFile(transcriptPath,'utf8'));}catch{}
async function read(method,args=[]) {return JSON.parse(await reader.readContract({address:config.address,functionName:method,args}));}
async function wait(hash){
  for(let i=0;i<120;i++){
    const r=await reader.getTransaction({hash});
    if(terminalStatus(r)){assertExecutionSucceeded(r);return r;}
    if(i%6===0) console.log(JSON.stringify({hash,status:r.statusName}));
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(`Still pending: ${hash}. Rerun resumes the same hash.`);
}
async function write(label,client,method,args){
  const prior=transcript.find(x=>x.label===label);
  let hash=prior?.hash;
  if(!hash){
    hash=await client.writeContract({address:config.address,functionName:method,args,value:0n,leaderOnly:false});
    transcript.push({label,hash,method,args,status:'PENDING',actor:client.account.address});
    await writeFile(transcriptPath,JSON.stringify(transcript,null,2));
  }
  console.log(JSON.stringify({label,hash}));
  const r=await wait(hash);
  const item=transcript.find(x=>x.label===label);
  item.status=r.statusName; item.execution='SUCCESS';
  item.votes=r.consensus_data?.votes || {};
  item.leaderOnly=r.leader_only;
  item.createdAt=r.created_at;
  await writeFile(transcriptPath,JSON.stringify(transcript,null,2));
  return hash;
}
const id='demo-rfq-industrial-usb-hub-v1';
const requirements=[
  'The hub must have four USB-A data ports.',
  'The enclosure must be metal.',
  'The supplier must provide a warranty of at least 24 months.'
];
await write('Create immutable RFQ',buyer,'create_request',[id,'Industrial USB hub — public synthetic RFQ',JSON.stringify(requirements)]);
const examples=[
  {id:'demo-offer-match-v1',label:'Sample A · complete offer',expected:'COMPATIBLE',text:'Product: industrial desktop USB hub.\nConnectivity: four USB-A data ports.\nEnclosure: aluminum metal housing.\nWarranty: 24 months provided by the supplier.'},
  {id:'demo-offer-conflict-v1',label:'Sample B · explicit conflict',expected:'INCOMPATIBLE',text:'Product: industrial desktop USB hub.\nConnectivity: four USB-A data ports.\nEnclosure: plastic housing, not metal.\nWarranty: 24 months provided by the supplier.'},
  {id:'demo-offer-missing-v1',label:'Sample C · missing warranty',expected:'INCOMPLETE',text:'Product: industrial desktop USB hub.\nConnectivity: four USB-A data ports.\nEnclosure: aluminum metal housing.\nShipping: standard export packaging.'}
];
for(const sample of examples){
  await write(`Submit ${sample.id}`,supplier,'submit_offer',[sample.id,id,sample.label,sample.text]);
  await write(`Evaluate ${sample.id}`,buyer,'evaluate_offer',[sample.id]);
  const result=await read('get_offer',[sample.id]);
  if(result.verdict!==sample.expected) throw new Error(`Unexpected model result for ${sample.id}: ${result.verdict}; expected ${sample.expected}.`);
  if(result.evidence!==sample.text) throw new Error('Immutable evidence read-back mismatch.');
  console.log(JSON.stringify({id:sample.id,verdict:result.verdict,items:result.items}));
}
await write('Select compatible offer',buyer,'select_offer',[id,examples[0].id]);
const request=await read('get_request',[id]);
if(request.status!=='SELECTED'||request.selected_offer_id!==examples[0].id) throw new Error('Selection read-back failed.');
const offers=await read('get_offers',[id]);
for(const item of transcript){
  const r=await reader.getTransaction({hash:item.hash});
  assertExecutionSucceeded(r); item.status=r.statusName;
}
for(const offer of offers) offer.evaluation_hash=transcript.find(t=>t.label===`Evaluate ${offer.id}`)?.hash;
const demo={explorer:config.explorer,network:config.network,chainId:config.chainId,contractAddress:config.address,recordedAt:new Date().toISOString(),notice:'Public synthetic examples. Both auxiliary test wallets are controlled by this project; they are not customers. Results verify submitted text only, not actual goods or supplier identity.',actors:{buyer:buyer.account.address,supplier:supplier.account.address},requests:[request],offers,transactions:transcript};
await mkdir(new URL('../public/evidence/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/evidence/demo.json',import.meta.url),JSON.stringify(demo,null,2));
console.log(JSON.stringify({completed:true,requests:1,offers:3,verdicts:offers.map(x=>x.verdict),state:request.status,output:'public/evidence/demo.json'}));
